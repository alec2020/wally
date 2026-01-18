import { NextRequest, NextResponse } from 'next/server';
import {
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getTransactionStats,
  addUserPreference,
} from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      category: searchParams.get('category') || undefined,
      accountId: searchParams.get('accountId')
        ? parseInt(searchParams.get('accountId')!)
        : undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit')
        ? parseInt(searchParams.get('limit')!)
        : undefined,
      offset: searchParams.get('offset')
        ? parseInt(searchParams.get('offset')!)
        : undefined,
    };

    const transactions = getTransactions(filters);
    const stats = getTransactionStats();

    return NextResponse.json({
      transactions,
      stats,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    const existing = getTransactionById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    updateTransaction(id, updates);

    // Learn from category corrections - generate a natural language preference
    if (updates.category && updates.category !== existing.category) {
      const merchantName = updates.merchant || existing.merchant || existing.description;
      const category = updates.category;
      const subcategory = updates.subcategory ?? existing.subcategory;
      const isTransfer = updates.is_transfer ?? existing.is_transfer ?? false;

      // Generate natural language instruction
      let instruction = `"${merchantName}" should be categorized as ${category}`;
      if (subcategory) {
        instruction += ` / ${subcategory}`;
      }
      if (isTransfer) {
        instruction += ' (mark as transfer)';
      }

      addUserPreference(instruction, 'learned');
    }

    const updated = getTransactionById(id);

    return NextResponse.json({ transaction: updated });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    const existing = getTransactionById(parseInt(id));
    if (!existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    deleteTransaction(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}
