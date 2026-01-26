import { NextRequest, NextResponse } from 'next/server';
import {
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getTransactionStats,
  upsertPreferenceForMerchant,
  getLiabilityPaymentByTransactionId,
  reversePaymentFromLiability,
  processTransactionForLiabilityPayments,
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
    const { id, ids, ...updates } = body;

    // Bulk update: { ids: number[], ...updates }
    if (ids && Array.isArray(ids)) {
      const updatedTransactions = [];
      for (const txId of ids) {
        const existing = getTransactionById(txId);
        if (!existing) continue;

        // Check if this transaction has an associated liability payment
        const existingPayment = getLiabilityPaymentByTransactionId(txId);

        // If amount is being changed and there's an applied payment, reverse it
        if (updates.amount !== undefined && updates.amount !== existing.amount && existingPayment) {
          if (existingPayment.status === 'applied') {
            reversePaymentFromLiability(existingPayment.id);
          }
        }

        updateTransaction(txId, updates);

        // Learn from category corrections for bulk updates too
        if (updates.category && updates.category !== existing.category) {
          const merchantName = updates.merchant || existing.merchant || existing.description;
          const category = updates.category;
          const isTransfer = updates.is_transfer ?? existing.is_transfer ?? false;

          let instruction = `"${merchantName}" should be categorized as ${category}`;
          if (isTransfer) {
            instruction += ' (mark as transfer)';
          }

          upsertPreferenceForMerchant(merchantName, instruction, 'learned');
        }

        // If amount was changed and there was a payment, re-process
        if (updates.amount !== undefined && updates.amount !== existing.amount && existingPayment) {
          processTransactionForLiabilityPayments(txId);
        }

        const updated = getTransactionById(txId);
        if (updated) updatedTransactions.push(updated);
      }

      return NextResponse.json({ transactions: updatedTransactions, count: updatedTransactions.length });
    }

    // Single update: { id, ...updates }
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

    // Check if this transaction has an associated liability payment
    const existingPayment = getLiabilityPaymentByTransactionId(id);

    // If amount is being changed and there's an applied payment, reverse it
    if (updates.amount !== undefined && updates.amount !== existing.amount && existingPayment) {
      if (existingPayment.status === 'applied') {
        reversePaymentFromLiability(existingPayment.id);
        // After reversal, re-process for liability payments with the new amount
        // This will be done after the transaction is updated
      }
    }

    updateTransaction(id, updates);

    // Learn from category corrections - generate a natural language preference
    // Uses upsert to avoid duplicate rules for the same merchant
    if (updates.category && updates.category !== existing.category) {
      const merchantName = updates.merchant || existing.merchant || existing.description;
      const category = updates.category;
      const isTransfer = updates.is_transfer ?? existing.is_transfer ?? false;

      // Generate natural language instruction
      let instruction = `"${merchantName}" should be categorized as ${category}`;
      if (isTransfer) {
        instruction += ' (mark as transfer)';
      }

      upsertPreferenceForMerchant(merchantName, instruction, 'learned');
    }

    // If amount was changed and there was a payment, re-process for new amount
    if (updates.amount !== undefined && updates.amount !== existing.amount && existingPayment) {
      processTransactionForLiabilityPayments(id);
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
    const idsParam = searchParams.get('ids');

    // Bulk delete: ?ids=1,2,3
    if (idsParam) {
      const ids = idsParam.split(',').map(Number).filter(n => !isNaN(n));
      let deletedCount = 0;

      for (const txId of ids) {
        const existing = getTransactionById(txId);
        if (!existing) continue;

        // Check if this transaction has an associated liability payment
        const existingPayment = getLiabilityPaymentByTransactionId(txId);
        if (existingPayment && existingPayment.status === 'applied') {
          reversePaymentFromLiability(existingPayment.id);
        }

        deleteTransaction(txId);
        deletedCount++;
      }

      return NextResponse.json({ success: true, count: deletedCount });
    }

    // Single delete: ?id=X
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

    // Check if this transaction has an associated liability payment
    const existingPayment = getLiabilityPaymentByTransactionId(parseInt(id));
    if (existingPayment && existingPayment.status === 'applied') {
      // Reverse the payment before deleting the transaction
      reversePaymentFromLiability(existingPayment.id);
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
