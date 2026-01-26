import { NextRequest, NextResponse } from 'next/server';
import { categorizeTransactions, categorizeWithRules } from '@/lib/categorize';
import { getTransactions, updateTransaction } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionIds, useAI = true } = body;

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json(
        { error: 'Transaction IDs are required' },
        { status: 400 }
      );
    }

    // Get uncategorized transactions
    const allTransactions = getTransactions();
    const transactionsToProcess = allTransactions.filter(
      (tx) => transactionIds.includes(tx.id) && !tx.category
    );

    if (transactionsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No uncategorized transactions to process',
        processed: 0,
      });
    }

    let categorizations;

    if (useAI && process.env.OPENAI_API_KEY) {
      try {
        categorizations = await categorizeTransactions(
          transactionsToProcess.map((tx) => ({
            description: tx.description,
            amount: tx.amount,
            date: tx.date,
          }))
        );
      } catch (error) {
        console.error('AI categorization failed:', error);
        // Fall back to rules
        categorizations = transactionsToProcess.map((tx) =>
          categorizeWithRules(tx.description, tx.amount)
        );
      }
    } else {
      categorizations = transactionsToProcess.map((tx) =>
        categorizeWithRules(tx.description, tx.amount)
      );
    }

    // Update transactions with categories
    let processed = 0;
    for (let i = 0; i < transactionsToProcess.length; i++) {
      const tx = transactionsToProcess[i];
      const cat = categorizations[i];

      updateTransaction(tx.id, {
        category: cat.category,
        merchant: cat.merchant,
      });
      processed++;
    }

    return NextResponse.json({
      success: true,
      message: `Categorized ${processed} transactions`,
      processed,
    });
  } catch (error) {
    console.error('Categorization error:', error);
    return NextResponse.json(
      { error: 'Failed to categorize transactions' },
      { status: 500 }
    );
  }
}

// Recategorize all uncategorized transactions
export async function PUT(request: NextRequest) {
  try {
    const allTransactions = getTransactions();
    const uncategorized = allTransactions.filter((tx) => !tx.category);

    if (uncategorized.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No uncategorized transactions',
        processed: 0,
      });
    }

    let categorizations;

    if (process.env.OPENAI_API_KEY) {
      try {
        categorizations = await categorizeTransactions(
          uncategorized.map((tx) => ({
            description: tx.description,
            amount: tx.amount,
            date: tx.date,
          }))
        );
      } catch (error) {
        console.error('AI categorization failed:', error);
        categorizations = uncategorized.map((tx) =>
          categorizeWithRules(tx.description, tx.amount)
        );
      }
    } else {
      categorizations = uncategorized.map((tx) =>
        categorizeWithRules(tx.description, tx.amount)
      );
    }

    let processed = 0;
    for (let i = 0; i < uncategorized.length; i++) {
      const tx = uncategorized[i];
      const cat = categorizations[i];

      updateTransaction(tx.id, {
        category: cat.category,
        merchant: cat.merchant,
      });
      processed++;
    }

    return NextResponse.json({
      success: true,
      message: `Categorized ${processed} transactions`,
      processed,
    });
  } catch (error) {
    console.error('Recategorization error:', error);
    return NextResponse.json(
      { error: 'Failed to recategorize transactions' },
      { status: 500 }
    );
  }
}
