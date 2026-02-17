import { NextRequest, NextResponse } from 'next/server';
import {
  getSpendingByCategory,
  getMonthlyTotals,
  getTopMerchants,
  getTotalBalance,
  getTransactionStats,
  getTransactions,
  getNetWorthHistory,
  getLatestBalances,
  getMonthlyExpensesByCategory,
  getSubscriptions,
  getSavingsRateForPeriod,
  getMerchantFrequency,
  getAssets,
  getLiabilities,
  getRecentCategoryExpenses,
} from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const spendingByCategory = getSpendingByCategory(startDate, endDate);
    const monthlyTotals = getMonthlyTotals(startDate, endDate);
    const spendingTrend6Months = getMonthlyTotals(
      new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString().split('T')[0],
      new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
    );
    const topMerchants = getTopMerchants(50, startDate, endDate);
    const totalBalance = getTotalBalance();
    const stats = getTransactionStats(startDate, endDate);
    const netWorthHistory = getNetWorthHistory();
    const latestBalances = getLatestBalances();
    const monthlyExpensesByCategory = getMonthlyExpensesByCategory();
    // When filtering by date range, use minOccurrences=1 since we're looking at a specific period
    // When viewing all time, use minOccurrences=2 to filter out one-off miscategorized payments
    const subscriptions = getSubscriptions(startDate && endDate ? 1 : 2, startDate, endDate);
    const savingsRateData = getSavingsRateForPeriod(startDate, endDate);
    const mfNow = new Date();
    const merchantFreqStart = new Date(mfNow.getFullYear(), mfNow.getMonth() - 5, 1).toISOString().split('T')[0];
    const merchantFreqEnd = new Date(mfNow.getFullYear(), mfNow.getMonth() + 1, 0).toISOString().split('T')[0];
    const merchantFrequency = getMerchantFrequency(20, merchantFreqStart, merchantFreqEnd);
    // Calculate net worth including assets and liabilities
    const accountsTotal = latestBalances.reduce((sum, b) => sum + b.balance, 0);
    const assets = getAssets();
    const liabilities = getLiabilities();
    const totalAssetsValue = assets.reduce((sum, a) => sum + a.current_value, 0);
    const liabilitiesWithPayments = liabilities.filter(l => l.monthly_payment && l.monthly_payment > 0);
    const housingExpenses = getRecentCategoryExpenses('Housing');
    // Filter subscriptions to only those seen in the last 3 months
    const subNow = new Date();
    const threeMonthsAgo = new Date(subNow.getFullYear(), subNow.getMonth() - 2, 1).toISOString().split('T')[0];
    const recentSubscriptions = subscriptions.filter(s => s.lastSeen >= threeMonthsAgo);
    const liabilitiesForNetWorth = liabilities
      .filter((l) => !l.exclude_from_net_worth)
      .reduce((sum, l) => sum + l.current_balance, 0);
    const currentNetWorth = accountsTotal + totalAssetsValue - liabilitiesForNetWorth;
    const netWorthUpdatedAt = latestBalances.length > 0
      ? latestBalances.reduce((latest, b) => b.month > latest ? b.month : latest, latestBalances[0].month)
      : null;

    // Calculate period-specific analytics
    const periodTransactions = getTransactions({ startDate, endDate });

    // Calculate days in period for average daily spend
    let daysInPeriod = 1;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      daysInPeriod = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    } else if (periodTransactions.length > 0) {
      // "All Time" - calculate from earliest to latest transaction
      const dates = periodTransactions.map(tx => tx.date).sort();
      const earliest = new Date(dates[0]);
      const latest = new Date(dates[dates.length - 1]);
      daysInPeriod = Math.max(1, Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    }

    // Calculate total spent (absolute expenses)
    const totalSpent = Math.abs(stats.totalExpenses);

    // Calculate average daily spend
    const avgDailySpend = totalSpent / daysInPeriod;

    // Find largest expense
    const expenseTransactions = periodTransactions.filter(tx => tx.amount < 0 && !tx.is_transfer);
    const largestExpense = expenseTransactions.length > 0
      ? expenseTransactions.reduce((max, tx) =>
          Math.abs(tx.amount) > Math.abs(max.amount) ? tx : max
        )
      : null;

    // Calculate current month stats
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

    const currentMonthTransactions = getTransactions({
      startDate: currentMonthStart,
      endDate: currentMonthEnd,
    });

    // Income: Only positive amounts categorized as 'Income'
    const currentMonthIncome = currentMonthTransactions
      .filter((tx) => tx.amount > 0 && !tx.is_transfer && tx.category === 'Income')
      .reduce((sum, tx) => sum + tx.amount, 0);

    // Expenses: All negative amounts + positive amounts in non-Income categories (credits/refunds offset)
    const currentMonthExpenses = currentMonthTransactions
      .filter((tx) => !tx.is_transfer && tx.category !== 'Investing' && (
        tx.amount < 0 ||
        (tx.amount > 0 && tx.category && tx.category !== 'Income')
      ))
      .reduce((sum, tx) => sum + tx.amount, 0);

    const currentMonthInvested = currentMonthTransactions
      .filter((tx) => tx.category === 'Investing')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    // Calculate last month stats for comparison
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .split('T')[0];
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      .toISOString()
      .split('T')[0];

    const lastMonthTransactions = getTransactions({
      startDate: lastMonthStart,
      endDate: lastMonthEnd,
    });

    // Expenses: All negative amounts + positive amounts in non-Income categories (credits/refunds offset)
    const lastMonthExpenses = lastMonthTransactions
      .filter((tx) => !tx.is_transfer && tx.category !== 'Investing' && (
        tx.amount < 0 ||
        (tx.amount > 0 && tx.category && tx.category !== 'Income')
      ))
      .reduce((sum, tx) => sum + tx.amount, 0);

    const lastMonthIncome = lastMonthTransactions
      .filter((tx) => tx.amount > 0 && !tx.is_transfer && tx.category === 'Income')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const lastMonthInvested = lastMonthTransactions
      .filter((tx) => tx.category === 'Investing')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const hasCurrentMonthData = currentMonthTransactions.length > 0;

    const expensesTrend =
      lastMonthExpenses !== 0
        ? ((currentMonthExpenses - lastMonthExpenses) / Math.abs(lastMonthExpenses)) * 100
        : 0;

    // Calculate last month spending by category
    const lastMonthSpendingByCategory = lastMonthTransactions
      .filter((tx) => !tx.is_transfer && tx.category && tx.category !== 'Investing' && tx.category !== 'Income')
      .reduce((acc, tx) => {
        const category = tx.category!;
        const existing = acc.find((c) => c.category === category);
        if (existing) {
          existing.total += tx.amount;
        } else {
          acc.push({ category, total: tx.amount });
        }
        return acc;
      }, [] as { category: string; total: number }[])
      .sort((a, b) => a.total - b.total);

    // Calculate current month spending by category
    // Include both negative amounts (purchases) and positive amounts (credits/refunds)
    const currentMonthSpendingByCategory = currentMonthTransactions
      .filter((tx) => !tx.is_transfer && tx.category && tx.category !== 'Investing' && tx.category !== 'Income')
      .reduce((acc, tx) => {
        const category = tx.category!;
        const existing = acc.find((c) => c.category === category);
        if (existing) {
          existing.total += tx.amount;
        } else {
          acc.push({ category, total: tx.amount });
        }
        return acc;
      }, [] as { category: string; total: number }[])
      .sort((a, b) => a.total - b.total); // Most negative (highest spending) first

    // Get recent transactions
    const recentTransactions = getTransactions({ limit: 5 });

    return NextResponse.json({
      spendingByCategory,
      currentMonthSpendingByCategory,
      monthlyTotals,
      monthlyExpensesByCategory,
      topMerchants,
      totalBalance,
      stats,
      netWorthHistory,
      currentNetWorth,
      netWorthUpdatedAt,
      hasCurrentMonthData,
      currentMonth: {
        income: currentMonthIncome,
        expenses: currentMonthExpenses,
        invested: currentMonthInvested,
        net: currentMonthIncome + currentMonthExpenses,
        expensesTrend,
      },
      lastMonth: {
        income: lastMonthIncome,
        expenses: lastMonthExpenses,
        invested: lastMonthInvested,
        net: lastMonthIncome + lastMonthExpenses,
        label: new Date(now.getFullYear(), now.getMonth() - 1, 15).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      },
      lastMonthSpendingByCategory,
      recentTransactions,
      // New analytics data for redesigned page
      periodAnalytics: {
        totalSpent,
        avgDailySpend,
        daysInPeriod,
        largestExpense: largestExpense ? {
          description: largestExpense.description,
          amount: Math.abs(largestExpense.amount),
          date: largestExpense.date,
          category: largestExpense.category,
        } : null,
      },
      // New analytics features
      subscriptions,
      savingsRate: {
        current: savingsRateData.rate,
        income: savingsRateData.income,
        expenses: savingsRateData.expenses,
        saved: savingsRateData.saved,
      },
      merchantFrequency,
      spendingTrend6Months,
      recentSubscriptions: recentSubscriptions.map(s => ({
        merchant: s.merchant,
        monthlyAmount: s.monthlyAmount,
      })),
      liabilitiesWithPayments: liabilitiesWithPayments.map(l => ({
        name: l.name,
        type: l.type,
        monthlyPayment: l.monthly_payment!,
      })),
      housingExpenses: housingExpenses.map(h => ({
        name: h.merchant,
        amount: h.total,
      })),
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
