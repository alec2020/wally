import { NextRequest, NextResponse } from 'next/server';
import {
  getLiabilityPaymentRules,
  getLiabilityPaymentRuleById,
  createLiabilityPaymentRule,
  updateLiabilityPaymentRule,
  deleteLiabilityPaymentRule,
  getLiabilityById,
} from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const liabilityId = searchParams.get('liabilityId');

    const rules = getLiabilityPaymentRules(
      liabilityId ? parseInt(liabilityId) : undefined
    );

    return NextResponse.json({ rules });
  } catch (error) {
    console.error('Error fetching liability payment rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch liability payment rules' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      liability_id,
      match_merchant,
      match_description,
      match_account_id,
      rule_description,
      auto_apply = true,
      is_active = true,
    } = body;

    if (!liability_id) {
      return NextResponse.json(
        { error: 'liability_id is required' },
        { status: 400 }
      );
    }

    if (!rule_description) {
      return NextResponse.json(
        { error: 'rule_description is required' },
        { status: 400 }
      );
    }

    if (!match_merchant && !match_description) {
      return NextResponse.json(
        { error: 'At least one of match_merchant or match_description is required' },
        { status: 400 }
      );
    }

    // Verify liability exists
    const liability = getLiabilityById(liability_id);
    if (!liability) {
      return NextResponse.json(
        { error: 'Liability not found' },
        { status: 404 }
      );
    }

    const id = createLiabilityPaymentRule({
      liability_id,
      match_merchant: match_merchant || null,
      match_description: match_description || null,
      match_account_id: match_account_id || null,
      rule_description,
      auto_apply,
      is_active,
    });

    const rule = getLiabilityPaymentRuleById(id);

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error('Error creating liability payment rule:', error);
    return NextResponse.json(
      { error: 'Failed to create liability payment rule' },
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
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const existing = getLiabilityPaymentRuleById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    updateLiabilityPaymentRule(id, updates);
    const updated = getLiabilityPaymentRuleById(id);

    return NextResponse.json({ rule: updated });
  } catch (error) {
    console.error('Error updating liability payment rule:', error);
    return NextResponse.json(
      { error: 'Failed to update liability payment rule' },
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
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const existing = getLiabilityPaymentRuleById(parseInt(id));
    if (!existing) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    deleteLiabilityPaymentRule(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting liability payment rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete liability payment rule' },
      { status: 500 }
    );
  }
}
