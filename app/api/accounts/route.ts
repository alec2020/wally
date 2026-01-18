import { NextRequest, NextResponse } from 'next/server';
import {
  getAccounts,
  createAccount,
  getAccountById,
  getTransactions,
  getMonthlySnapshots,
  createMonthlySnapshot,
} from '@/lib/db';

export async function GET() {
  try {
    const accounts = getAccounts();

    // Calculate current balance for each account
    const accountsWithBalances = accounts.map((account) => {
      const transactions = getTransactions({ accountId: account.id });
      const balance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
      return {
        ...account,
        balance,
        transactionCount: transactions.length,
      };
    });

    return NextResponse.json({ accounts: accountsWithBalances });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, institution } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }

    const validTypes = ['bank', 'credit_card', 'brokerage'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid account type' },
        { status: 400 }
      );
    }

    const id = createAccount(name, type, institution || null);
    const account = getAccountById(id);

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
