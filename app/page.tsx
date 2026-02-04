'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatCard } from '@/components/StatCard';
import { SpendingPieChart } from '@/components/charts/SpendingPieChart';
import { MonthlyTrendChart } from '@/components/charts/MonthlyTrendChart';
import { MonthlyExpenseTrendsChart } from '@/components/charts/MonthlyExpenseTrendsChart';
import { RecurringExpensesCard } from '@/components/RecurringExpensesCard';
import { IncomeOverviewCard } from '@/components/IncomeOverviewCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowUpTrayIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
} from '@heroicons/react/24/outline';
import { useScreenshotMode } from '@/lib/screenshot-mode';
import { generateFakeAnalytics } from '@/lib/fake-data';

interface AnalyticsData {
  spendingByCategory: { category: string; total: number }[];
  currentMonthSpendingByCategory: { category: string; total: number }[];
  lastMonthSpendingByCategory: { category: string; total: number }[];
  recentSubscriptions?: { merchant: string; monthlyAmount: number }[];
  liabilitiesWithPayments?: { name: string; type: string; monthlyPayment: number }[];
  housingExpenses?: { name: string; amount: number }[];
  monthlyTotals: { month: string; income: number; expenses: number; invested: number }[];
  monthlyExpensesByCategory: { month: string; category: string; total: number }[];
  totalBalance: number;
  currentNetWorth: number;
  netWorthUpdatedAt: string | null;
  hasCurrentMonthData: boolean;
  stats: {
    totalTransactions: number;
    totalIncome: number;
    totalExpenses: number;
    uncategorized: number;
  };
  currentMonth: {
    income: number;
    expenses: number;
    invested: number;
    net: number;
    expensesTrend: number;
  };
  lastMonth: {
    income: number;
    expenses: number;
    invested: number;
    net: number;
    label: string;
  };
}

interface Category {
  id: number;
  name: string;
  color: string | null;
}

export default function Dashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isScreenshotMode } = useScreenshotMode();

  useEffect(() => {
    if (isScreenshotMode) {
      setData(generateFakeAnalytics() as AnalyticsData);
      setCategories([
        { id: 1, name: 'Income', color: '#22c55e' },
        { id: 2, name: 'Housing', color: '#3b82f6' },
        { id: 3, name: 'Transportation', color: '#f59e0b' },
        { id: 4, name: 'Groceries', color: '#84cc16' },
        { id: 5, name: 'Food', color: '#ef4444' },
        { id: 6, name: 'Shopping', color: '#8b5cf6' },
        { id: 7, name: 'Entertainment', color: '#ec4899' },
        { id: 8, name: 'Health', color: '#14b8a6' },
        { id: 9, name: 'Travel', color: '#06b6d4' },
        { id: 10, name: 'Financial', color: '#64748b' },
        { id: 11, name: 'Subscriptions', color: '#f97316' },
        { id: 12, name: 'Investing', color: '#10b981' },
        { id: 13, name: 'Other', color: '#94a3b8' },
      ]);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [analyticsRes, categoriesRes] = await Promise.all([
          fetch('/api/analytics'),
          fetch('/api/categories'),
        ]);
        const analyticsResult = await analyticsRes.json();
        const categoriesResult = await categoriesRes.json();
        setData(analyticsResult);
        setCategories(categoriesResult.categories || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isScreenshotMode]);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
            <div className="h-80 bg-muted rounded"></div>
            <div className="h-80 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.stats.totalTransactions === 0) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Your financial overview</p>
        </div>
        <Card className="max-w-xl mx-auto">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ArrowUpTrayIcon className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No transactions yet</h3>
            <p className="text-muted-foreground mb-6 text-center">
              Upload your first bank or credit card statement to get started
            </p>
            <Link href="/upload">
              <Button>
                <ArrowUpTrayIcon className="mr-2 h-4 w-4" />
                Upload Statement
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const showMonth = data.hasCurrentMonthData ? data.currentMonth : data.lastMonth;
  const monthLabel = data.hasCurrentMonthData ? 'This month' : data.lastMonth.label;
  const pieData = data.hasCurrentMonthData ? data.currentMonthSpendingByCategory : data.lastMonthSpendingByCategory;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Your financial overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-7 mb-8">
        <StatCard
          title="Net Worth"
          value={data.currentNetWorth}
          subtitle={data.netWorthUpdatedAt ? `Updated ${new Date(data.netWorthUpdatedAt + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : undefined}
          icon={BanknotesIcon}
        />
        <StatCard
          title="Income"
          value={showMonth.income}
          subtitle={monthLabel}
          icon={ArrowTrendingUpIcon}
        />
        <StatCard
          title="Expenses"
          value={Math.abs(showMonth.expenses)}
          subtitle={monthLabel}
          icon={ArrowTrendingDownIcon}
          variant="negative"
        />
        <StatCard
          title="Invested"
          value={showMonth.invested}
          subtitle={monthLabel}
          icon={BuildingLibraryIcon}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7 mb-8">
        <SpendingPieChart data={pieData} categories={categories} />
        <MonthlyTrendChart data={data.monthlyTotals} />
      </div>

      {/* Monthly Expense Trends */}
      <div className="mb-8">
        <MonthlyExpenseTrendsChart data={data.monthlyExpensesByCategory} categories={categories} />
      </div>

      {/* Recurring Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
        <RecurringExpensesCard
          subscriptions={data.recentSubscriptions || []}
          liabilities={data.liabilitiesWithPayments || []}
          housingExpenses={data.housingExpenses || []}
        />
        <IncomeOverviewCard monthlyTotals={data.monthlyTotals} />
      </div>
    </div>
  );
}
