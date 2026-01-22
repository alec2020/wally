import { NextRequest, NextResponse } from 'next/server';
import {
  getLiabilityPayments,
  getLiabilityPaymentById,
  applyPaymentToLiability,
  applyPendingPayment,
  reversePaymentFromLiability,
  skipPendingPayment,
  getPendingPaymentCount,
  getLiabilityPaymentByTransactionId,
  LiabilityPaymentStatus,
} from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const liabilityId = searchParams.get('liabilityId');
    const transactionId = searchParams.get('transactionId');
    const status = searchParams.get('status') as LiabilityPaymentStatus | null;
    const countOnly = searchParams.get('countOnly') === 'true';

    // If requesting just the pending count
    if (countOnly) {
      const count = getPendingPaymentCount(
        liabilityId ? parseInt(liabilityId) : undefined
      );
      return NextResponse.json({ count });
    }

    // If looking up by transaction ID
    if (transactionId) {
      const payment = getLiabilityPaymentByTransactionId(parseInt(transactionId));
      return NextResponse.json({ payment: payment || null });
    }

    const filters: {
      liabilityId?: number;
      status?: LiabilityPaymentStatus;
    } = {};

    if (liabilityId) {
      filters.liabilityId = parseInt(liabilityId);
    }
    if (status) {
      filters.status = status;
    }

    const payments = getLiabilityPayments(filters);
    const pendingCount = getPendingPaymentCount(
      liabilityId ? parseInt(liabilityId) : undefined
    );

    return NextResponse.json({ payments, pendingCount });
  } catch (error) {
    console.error('Error fetching liability payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch liability payments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transaction_id, liability_id, rule_id, auto_apply = false } = body;

    if (!transaction_id || !liability_id) {
      return NextResponse.json(
        { error: 'transaction_id and liability_id are required' },
        { status: 400 }
      );
    }

    const result = applyPaymentToLiability(
      transaction_id,
      liability_id,
      rule_id || null,
      auto_apply
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ payment: result.payment }, { status: 201 });
  } catch (error) {
    console.error('Error creating liability payment:', error);
    return NextResponse.json(
      { error: 'Failed to create liability payment' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Payment ID is required' },
        { status: 400 }
      );
    }

    if (!action || !['apply', 'reverse', 'skip'].includes(action)) {
      return NextResponse.json(
        { error: 'Valid action is required: apply, reverse, or skip' },
        { status: 400 }
      );
    }

    const existing = getLiabilityPaymentById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    let result: { success: boolean; error?: string };

    switch (action) {
      case 'apply':
        result = applyPendingPayment(id);
        break;
      case 'reverse':
        result = reversePaymentFromLiability(id);
        break;
      case 'skip':
        result = skipPendingPayment(id);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    const updated = getLiabilityPaymentById(id);
    return NextResponse.json({ payment: updated });
  } catch (error) {
    console.error('Error updating liability payment:', error);
    return NextResponse.json(
      { error: 'Failed to update liability payment' },
      { status: 500 }
    );
  }
}
