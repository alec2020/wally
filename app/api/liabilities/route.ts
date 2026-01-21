import { NextRequest, NextResponse } from 'next/server';
import {
  getLiabilities,
  getLiabilityById,
  createLiability,
  updateLiability,
  deleteLiability,
  getTotalLiabilitiesBalance,
  LiabilityType,
} from '@/lib/db';

export async function GET() {
  try {
    const liabilities = getLiabilities();
    const totalBalance = getTotalLiabilitiesBalance();

    return NextResponse.json({
      liabilities,
      totalBalance,
    });
  } catch (error) {
    console.error('Error fetching liabilities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch liabilities' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, original_amount, current_balance, interest_rate, monthly_payment, start_date, exclude_from_net_worth, notes } = body;

    if (!name || !type || original_amount === undefined || current_balance === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, original_amount, current_balance' },
        { status: 400 }
      );
    }

    const validTypes: LiabilityType[] = ['auto_loan', 'mortgage', 'personal_loan', 'student_loan', 'other'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid liability type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const id = createLiability({
      name,
      type,
      original_amount,
      current_balance,
      interest_rate: interest_rate ?? null,
      monthly_payment: monthly_payment ?? null,
      start_date: start_date ?? null,
      exclude_from_net_worth: exclude_from_net_worth ?? false,
      notes: notes ?? null,
    });

    const liability = getLiabilityById(id);

    return NextResponse.json({ success: true, liability });
  } catch (error) {
    console.error('Error creating liability:', error);
    return NextResponse.json(
      { error: 'Failed to create liability' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing liability id' },
        { status: 400 }
      );
    }

    const existing = getLiabilityById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Liability not found' },
        { status: 404 }
      );
    }

    if (updates.type) {
      const validTypes: LiabilityType[] = ['auto_loan', 'mortgage', 'personal_loan', 'student_loan', 'other'];
      if (!validTypes.includes(updates.type)) {
        return NextResponse.json(
          { error: `Invalid liability type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    updateLiability(id, updates);
    const liability = getLiabilityById(id);

    return NextResponse.json({ success: true, liability });
  } catch (error) {
    console.error('Error updating liability:', error);
    return NextResponse.json(
      { error: 'Failed to update liability' },
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
        { error: 'Missing liability id' },
        { status: 400 }
      );
    }

    const existing = getLiabilityById(parseInt(id, 10));
    if (!existing) {
      return NextResponse.json(
        { error: 'Liability not found' },
        { status: 404 }
      );
    }

    deleteLiability(parseInt(id, 10));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting liability:', error);
    return NextResponse.json(
      { error: 'Failed to delete liability' },
      { status: 500 }
    );
  }
}
