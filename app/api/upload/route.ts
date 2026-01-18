import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, detectCSVFormat } from '@/lib/parsers';
import {
  createAccount,
  getAccounts,
  createTransactionsBatch,
  isDuplicateTransaction,
} from '@/lib/db';
import { categorizeTransactions, categorizeWithRules } from '@/lib/categorize';

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
    }) => ({
      account_id: accountId,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      category: tx.category || null,
      subcategory: tx.subcategory || null,
      merchant: tx.merchant || null,
      is_transfer: tx.isTransfer || false,
      notes: null,
      raw_data: tx.rawData || null,
    }));

    const inserted = createTransactionsBatch(dbTransactions);

    return NextResponse.json({
      success: true,
      message: `Imported ${inserted} transactions`,
      imported: inserted,
      accountId,
      institution,
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

    // Mark duplicates
    const transactionsWithDuplicateFlag = parseResult.transactions.map((tx) => ({
      ...tx,
      isDuplicate: isDuplicateTransaction(tx.date, tx.amount, tx.description),
    }));

    const duplicateCount = transactionsWithDuplicateFlag.filter((tx) => tx.isDuplicate).length;
    const newTransactions = transactionsWithDuplicateFlag.filter((tx) => !tx.isDuplicate);

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
    }

    // Categorize all non-duplicate transactions
    let categorizedTransactions: CategorizedTransaction[] = newTransactions.map(tx => ({
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      category: tx.category || null,
      subcategory: null,
      merchant: tx.merchant || null,
      isTransfer: false,
      rawData: tx.rawData,
    }));

    if (newTransactions.length > 0) {
      // Try AI categorization if API key is available
      if (process.env.OPENAI_API_KEY) {
        try {
          const categorizations = await categorizeTransactions(
            newTransactions.map((tx) => ({
              description: tx.description,
              amount: tx.amount,
              date: tx.date,
            }))
          );

          categorizedTransactions = newTransactions.map((tx, i) => ({
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            rawData: tx.rawData,
            category: categorizations[i]?.category || tx.category || null,
            subcategory: categorizations[i]?.subcategory || null,
            merchant: categorizations[i]?.merchant || tx.merchant || null,
            isTransfer: categorizations[i]?.isTransfer || false,
          }));
        } catch (error) {
          console.error('AI categorization failed, using rules:', error);
          // Fall back to rule-based categorization
          categorizedTransactions = newTransactions.map((tx) => {
            const result = categorizeWithRules(tx.description, tx.amount);
            return {
              date: tx.date,
              description: tx.description,
              amount: tx.amount,
              rawData: tx.rawData,
              category: tx.category || result.category,
              subcategory: result.subcategory || null,
              merchant: tx.merchant || result.merchant,
              isTransfer: result.isTransfer || false,
            };
          });
        }
      } else {
        // Use rule-based categorization
        categorizedTransactions = newTransactions.map((tx) => {
          const result = categorizeWithRules(tx.description, tx.amount);
          return {
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            rawData: tx.rawData,
            category: tx.category || result.category,
            subcategory: result.subcategory || null,
            merchant: tx.merchant || result.merchant,
            isTransfer: result.isTransfer || false,
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
