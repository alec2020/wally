import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, detectCSVFormat } from '@/lib/parsers';
import {
  createAccount,
  getAccounts,
  createTransactionsBatch,
  isDuplicateTransaction,
  createStatementUpload,
  upsertPreferenceForMerchant,
  getTransactions,
  processTransactionForLiabilityPayments,
} from '@/lib/db';
import { categorizeTransactions, categorizeWithRules } from '@/lib/categorize';
import { processPDF } from '@/lib/parsers/pdf';

// Transaction import endpoint - accepts pre-categorized transactions from preview
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      transactions,
      accountId: accountIdParam,
      accountName,
      accountType,
      institution,
      statementPeriodStart,
      statementPeriodEnd,
      filename,
    } = body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: 'No transactions provided' },
        { status: 400 }
      );
    }

    // Get or create account
    let accountId: number | null = null;

    if (accountIdParam) {
      // Use existing account by ID
      accountId = parseInt(accountIdParam);
    } else {
      // Create or find account by name
      const finalAccountName = accountName || `${institution || 'Unknown'} Account`;
      const existingAccounts = getAccounts();
      const existingAccount = existingAccounts.find(
        (a) => a.name.toLowerCase() === finalAccountName.toLowerCase()
      );

      if (existingAccount) {
        accountId = existingAccount.id;
      } else {
        accountId = createAccount(
          finalAccountName,
          accountType || 'bank',
          institution || null
        );
      }
    }

    // Insert transactions - categories already set from preview, just insert
    const dbTransactions = transactions.map((tx: {
      date: string;
      description: string;
      amount: number;
      category?: string;
      subcategory?: string;
      merchant?: string;
      isTransfer?: boolean;
      rawData?: string;
      originalCategory?: string;
    }) => ({
      account_id: accountId,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      category: tx.category || null,
      subcategory: tx.subcategory || null,
      merchant: tx.merchant || null,
      is_transfer: tx.isTransfer || false,
      subscription_frequency: null,
      notes: null,
      raw_data: tx.rawData || null,
    }));

    const inserted = createTransactionsBatch(dbTransactions);

    // Learn from user corrections made in the preview
    // Only learn from the final category choice (not intermediate changes)
    // Uses upsert to avoid duplicates for the same merchant
    for (const tx of transactions) {
      const finalCategory = tx.category;
      const originalCategory = tx.originalCategory;

      // Only learn if user changed the category from what AI suggested
      if (finalCategory && finalCategory !== originalCategory) {
        const merchantName = tx.merchant || tx.description;

        // Generate natural language instruction
        let instruction = `"${merchantName}" should be categorized as ${finalCategory}`;
        if (tx.subcategory) {
          instruction += ` / ${tx.subcategory}`;
        }
        if (tx.isTransfer) {
          instruction += ' (mark as transfer)';
        }

        upsertPreferenceForMerchant(merchantName, instruction, 'learned');
      }
    }

    // Save statement upload record if we have period dates
    if (accountId && statementPeriodStart && statementPeriodEnd) {
      createStatementUpload({
        accountId,
        periodStart: statementPeriodStart,
        periodEnd: statementPeriodEnd,
        filename: filename || undefined,
        transactionCount: inserted,
      });
    }

    // Process newly imported transactions for liability payments
    // Get the most recently imported transactions for this account
    const recentTransactions = getTransactions({
      accountId: accountId ?? undefined,
      limit: inserted,
    });

    let paymentsCreated = 0;
    for (const tx of recentTransactions) {
      const result = processTransactionForLiabilityPayments(tx.id);
      if (result.matched) {
        paymentsCreated += result.payments.length;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${inserted} transactions${paymentsCreated > 0 ? `, ${paymentsCreated} liability payment(s) detected` : ''}`,
      imported: inserted,
      accountId,
      institution,
      paymentsDetected: paymentsCreated,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}

// Preview endpoint - parse, categorize, and return all transactions for review
export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const isPDF = fileName.endsWith('.pdf');

    // Define the shape of categorized transactions
    interface CategorizedTransaction {
      date: string;
      description: string;
      amount: number;
      category: string | null;
      subcategory: string | null;
      merchant: string | null;
      isTransfer: boolean;
      rawData: string;
      originalCategory: string | null; // AI's initial suggestion, used to detect user corrections
      isDuplicate?: boolean; // Whether this transaction matches an existing one
      includeDuplicate?: boolean; // User override to include a duplicate anyway
    }

    // Handle PDF files
    if (isPDF) {
      const arrayBuffer = await file.arrayBuffer();
      const pdfResult = await processPDF(arrayBuffer);

      if (!pdfResult.success) {
        return NextResponse.json({
          detected: false,
          institution: pdfResult.institution,
          parserName: 'PDF Statement',
          success: false,
          error: pdfResult.error,
          transactionCount: 0,
          duplicateCount: 0,
          transactions: [],
          accountType: pdfResult.accountType,
        });
      }

      // Mark duplicates and add originalCategory for learning
      // Return ALL transactions with isDuplicate flag so user can review and override
      const transactionsWithFlags = pdfResult.transactions.map((tx) => ({
        ...tx,
        isDuplicate: isDuplicateTransaction(tx.date, tx.amount, tx.description),
        includeDuplicate: false, // User can toggle this to include duplicates
        originalCategory: tx.category || null, // Store AI's initial suggestion
      }));

      const duplicateCount = transactionsWithFlags.filter((tx) => tx.isDuplicate).length;

      return NextResponse.json({
        detected: true,
        institution: pdfResult.institution,
        parserName: `${pdfResult.institution} PDF`,
        success: true,
        transactionCount: pdfResult.transactions.length,
        duplicateCount,
        transactions: transactionsWithFlags, // Return all, including duplicates
        accountType: pdfResult.accountType,
        statementPeriodStart: pdfResult.statementPeriodStart,
        statementPeriodEnd: pdfResult.statementPeriodEnd,
      });
    }

    // Handle CSV files (existing logic)
    const csvContent = await file.text();

    // Detect format
    const detection = detectCSVFormat(csvContent);

    // Parse for preview
    const parseResult = parseCSV(csvContent);

    if (!parseResult.success) {
      return NextResponse.json({
        detected: detection.detected,
        institution: detection.institution,
        parserName: detection.parserName,
        success: false,
        error: parseResult.error,
        transactionCount: 0,
        duplicateCount: 0,
        transactions: [],
        accountType: parseResult.accountType,
      });
    }

    // Mark duplicates - return ALL transactions with isDuplicate flag so user can review
    const transactionsWithDuplicateFlag = parseResult.transactions.map((tx) => ({
      ...tx,
      isDuplicate: isDuplicateTransaction(tx.date, tx.amount, tx.description),
      includeDuplicate: false,
    }));

    const duplicateCount = transactionsWithDuplicateFlag.filter((tx) => tx.isDuplicate).length;

    // Categorize ALL transactions (including duplicates, so user can review them properly)
    let categorizedTransactions: (CategorizedTransaction & { isDuplicate: boolean; includeDuplicate: boolean })[] =
      transactionsWithDuplicateFlag.map(tx => ({
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        category: tx.category || null,
        subcategory: null,
        merchant: tx.merchant || null,
        isTransfer: false,
        rawData: tx.rawData,
        originalCategory: tx.category || null,
        isDuplicate: tx.isDuplicate,
        includeDuplicate: tx.includeDuplicate,
      }));

    if (transactionsWithDuplicateFlag.length > 0) {
      // Try AI categorization if API key is available
      if (process.env.OPENAI_API_KEY) {
        try {
          const categorizations = await categorizeTransactions(
            transactionsWithDuplicateFlag.map((tx) => ({
              description: tx.description,
              amount: tx.amount,
              date: tx.date,
            }))
          );

          categorizedTransactions = transactionsWithDuplicateFlag.map((tx, i) => {
            const category = categorizations[i]?.category || tx.category || null;
            return {
              date: tx.date,
              description: tx.description,
              amount: tx.amount,
              rawData: tx.rawData,
              category,
              subcategory: categorizations[i]?.subcategory || null,
              merchant: categorizations[i]?.merchant || tx.merchant || null,
              isTransfer: categorizations[i]?.isTransfer || false,
              originalCategory: category,
              isDuplicate: tx.isDuplicate,
              includeDuplicate: tx.includeDuplicate,
            };
          });
        } catch (error) {
          console.error('AI categorization failed, using rules:', error);
          // Fall back to rule-based categorization
          categorizedTransactions = transactionsWithDuplicateFlag.map((tx) => {
            const result = categorizeWithRules(tx.description, tx.amount);
            const category = tx.category || result.category;
            return {
              date: tx.date,
              description: tx.description,
              amount: tx.amount,
              rawData: tx.rawData,
              category,
              subcategory: result.subcategory || null,
              merchant: tx.merchant || result.merchant,
              isTransfer: result.isTransfer || false,
              originalCategory: category,
              isDuplicate: tx.isDuplicate,
              includeDuplicate: tx.includeDuplicate,
            };
          });
        }
      } else {
        // Use rule-based categorization
        categorizedTransactions = transactionsWithDuplicateFlag.map((tx) => {
          const result = categorizeWithRules(tx.description, tx.amount);
          const category = tx.category || result.category;
          return {
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            rawData: tx.rawData,
            category,
            subcategory: result.subcategory || null,
            merchant: tx.merchant || result.merchant,
            isTransfer: result.isTransfer || false,
            originalCategory: category,
            isDuplicate: tx.isDuplicate,
            includeDuplicate: tx.includeDuplicate,
          };
        });
      }
    }

    return NextResponse.json({
      detected: detection.detected,
      institution: detection.institution,
      parserName: detection.parserName,
      success: true,
      transactionCount: parseResult.transactions.length,
      duplicateCount,
      transactions: categorizedTransactions, // All categorized non-duplicate transactions
      accountType: parseResult.accountType,
    });
  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json(
      { error: 'Failed to preview file' },
      { status: 500 }
    );
  }
}
