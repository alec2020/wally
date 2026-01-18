import { NextRequest, NextResponse } from 'next/server';
import {
  getSnapshotsWithAccounts,
  upsertMonthlySnapshot,
  deleteSnapshot,
  getLatestBalances,
  getNetWorthHistory,
} from '@/lib/db';

export async function GET() {
  try {
    const snapshots = getSnapshotsWithAccounts();
    const latestBalances = getLatestBalances();
    const netWorthHistory = getNetWorthHistory();

    // Calculate current net worth (sum of latest balances)
    const currentNetWorth = latestBalances.reduce((sum, b) => sum + b.balance, 0);

    return NextResponse.json({
      snapshots,
      latestBalances,
      netWorthHistory,
      currentNetWorth,
    });
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { month, accountId, balance } = body;

    if (!month || !accountId || balance === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: month, accountId, balance' },
        { status: 400 }
      );
    }

    // Validate month format (YYYY-MM-01)
    const monthRegex = /^\d{4}-\d{2}-01$/;
    if (!monthRegex.test(month)) {
      return NextResponse.json(
        { error: 'Month must be in YYYY-MM-01 format' },
        { status: 400 }
      );
    }

    const id = upsertMonthlySnapshot(month, accountId, balance);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error creating/updating snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to save snapshot' },
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
        { error: 'Missing snapshot id' },
        { status: 400 }
      );
    }

    deleteSnapshot(parseInt(id, 10));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to delete snapshot' },
      { status: 500 }
    );
  }
}
