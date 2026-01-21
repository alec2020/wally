import { NextResponse } from 'next/server';
import { getAccountCoverage } from '@/lib/db';

export async function GET() {
  try {
    const coverage = getAccountCoverage();
    return NextResponse.json(coverage);
  } catch (error) {
    console.error('Failed to get account coverage:', error);
    return NextResponse.json(
      { error: 'Failed to get account coverage' },
      { status: 500 }
    );
  }
}
