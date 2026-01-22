'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatCard } from '@/components/StatCard';
import { SpendingPieChart } from '@/components/charts/SpendingPieChart';
import { MonthlyTrendChart } from '@/components/charts/MonthlyTrendChart';
import { MonthlyExpenseTrendsChart } from '@/components/charts/MonthlyExpenseTrendsChart';
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
  monthlyTotals: { month: string; income: number; expenses: number; invested: number }[];
  monthlyExpensesByCategory: { month: string; category: string; total: number }[];
  totalBalance: number;
  currentNetWorth: number;
  netWorthUpdatedAt: string | null;
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
}

export default function Dashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isScreenshotMode } = useScreenshotMode();

  useEffect(() => {
    if (isScreenshotMode) {
      setData(generateFakeAnalytics() as AnalyticsData);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const response = await fetch('/api/analytics');
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Your financial overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Net Worth"
          value={data.currentNetWorth}
          subtitle={data.netWorthUpdatedAt ? `Updated ${new Date(data.netWorthUpdatedAt + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : undefined}
          icon={BanknotesIcon}
        />
        <StatCard
          title="Income"
          value={data.currentMonth.income}
          subtitle="This month"
          icon={ArrowTrendingUpIcon}
        />
        <StatCard
          title="Expenses"
          value={Math.abs(data.currentMonth.expenses)}
          subtitle="This month"
          icon={ArrowTrendingDownIcon}
          variant="negative"
        />
        <StatCard
          title="Invested"
          value={data.currentMonth.invested}
          subtitle="This month"
          icon={BuildingLibraryIcon}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <SpendingPieChart data={data.currentMonthSpendingByCategory} />
        <MonthlyTrendChart data={data.monthlyTotals} />
      </div>

      {/* Monthly Expense Trends */}
      <MonthlyExpenseTrendsChart data={data.monthlyExpensesByCategory} />
    </div>
  );
}
