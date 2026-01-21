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
  getMonthlySavingsRate,
  getMerchantFrequency,
  getAssets,
  getLiabilities,
} from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const spendingByCategory = getSpendingByCategory(startDate, endDate);
    const monthlyTotals = getMonthlyTotals(startDate, endDate);
    const topMerchants = getTopMerchants(50, startDate, endDate);
    const totalBalance = getTotalBalance();
    const stats = getTransactionStats(startDate, endDate);
    const netWorthHistory = getNetWorthHistory();
    const latestBalances = getLatestBalances();
    const monthlyExpensesByCategory = getMonthlyExpensesByCategory();
    const subscriptions = getSubscriptions(2);
    const savingsRateData = getMonthlySavingsRate(12);
    const merchantFrequency = getMerchantFrequency(20);
    // Calculate net worth including assets and liabilities
    const accountsTotal = latestBalances.reduce((sum, b) => sum + b.balance, 0);
    const assets = getAssets();
    const liabilities = getLiabilities();
    const totalAssetsValue = assets.reduce((sum, a) => sum + a.current_value, 0);
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

    const currentMonthIncome = currentMonthTransactions
      .filter((tx) => tx.amount > 0 && !tx.is_transfer)
      .reduce((sum, tx) => sum + tx.amount, 0);

    const currentMonthExpenses = currentMonthTransactions
      .filter((tx) => tx.amount < 0 && !tx.is_transfer && tx.category !== 'Investing')
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

    const lastMonthExpenses = lastMonthTransactions
      .filter((tx) => tx.amount < 0 && !tx.is_transfer && tx.category !== 'Investing')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const expensesTrend =
      lastMonthExpenses !== 0
        ? ((currentMonthExpenses - lastMonthExpenses) / Math.abs(lastMonthExpenses)) * 100
        : 0;

    // Calculate current month spending by category
    const currentMonthSpendingByCategory = currentMonthTransactions
      .filter((tx) => tx.amount < 0 && !tx.is_transfer && tx.category && tx.category !== 'Investing')
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
      currentMonth: {
        income: currentMonthIncome,
        expenses: currentMonthExpenses,
        invested: currentMonthInvested,
        net: currentMonthIncome + currentMonthExpenses,
        expensesTrend,
      },
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
        current: savingsRateData.length > 0 ? savingsRateData[0].rate : 0,
        history: savingsRateData,
      },
      merchantFrequency,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
