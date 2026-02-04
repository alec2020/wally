'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { IncomeExpensesChart } from '@/components/charts/IncomeExpensesChart';
import { SpendingTrendChart } from '@/components/charts/SpendingTrendChart';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn, formatCurrency, formatMonth } from '@/lib/utils';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CurrencyDollarIcon,
  ArrowTrendingDownIcon,
  ReceiptPercentIcon,
  BanknotesIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, subDays, differenceInDays } from 'date-fns';
import { useScreenshotMode } from '@/lib/screenshot-mode';
import { generateFakeAnalytics } from '@/lib/fake-data';

interface AnalyticsData {
  spendingByCategory: { category: string; total: number }[];
  monthlyTotals: { month: string; income: number; expenses: number }[];
  topMerchants: { merchant: string; total: number; count: number }[];
  stats: {
    totalTransactions: number;
    totalIncome: number;
    totalExpenses: number;
    uncategorized: number;
  };
  periodAnalytics: {
    totalSpent: number;
    avgDailySpend: number;
    daysInPeriod: number;
    largestExpense: {
      description: string;
      amount: number;
      date: string;
      category: string;
    } | null;
  };
  subscriptions: {
    merchant: string;
    avgAmount: number;
    monthlyAmount: number;
    frequency: number;
    billingCycle: 'monthly' | 'annual' | 'quarterly';
    lastSeen: string;
  }[];
  savingsRate: {
    current: number;
    income: number;
    expenses: number;
    saved: number;
  };
  merchantFrequency: {
    merchant: string;
    visits: number;
    totalSpent: number;
    avgPerVisit: number;
    lastVisit: string;
  }[];
  spendingTrend6Months: { month: string; income: number; expenses: number }[];
}

type DatePreset = 'this-month' | 'last-month' | 'last-3-months' | 'last-6-months' | 'this-year' | 'all' | 'custom';

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [prevPeriodSpent, setPrevPeriodSpent] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [preset, setPreset] = useState<DatePreset>('this-month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [categoryScrolled, setCategoryScrolled] = useState(false);
  const { isScreenshotMode } = useScreenshotMode();

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (preset) {
      case 'this-month':
        return {
          startDate: format(startOfMonth(currentMonth), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(currentMonth), 'yyyy-MM-dd'),
        };
      case 'last-month':
        const lastMonth = subMonths(now, 1);
        return {
          startDate: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
        };
      case 'last-3-months':
        return {
          startDate: format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
        };
      case 'last-6-months':
        return {
          startDate: format(startOfMonth(subMonths(now, 5)), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
        };
      case 'this-year':
        return {
          startDate: format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd'),
          endDate: format(new Date(now.getFullYear(), 11, 31), 'yyyy-MM-dd'),
        };
      case 'custom':
        if (customDateRange.from && customDateRange.to) {
          return {
            startDate: format(customDateRange.from, 'yyyy-MM-dd'),
            endDate: format(customDateRange.to, 'yyyy-MM-dd'),
          };
        }
        return { startDate: undefined, endDate: undefined };
      case 'all':
      default:
        return { startDate: undefined, endDate: undefined };
    }
  }, [preset, currentMonth, customDateRange]);

  const merchantFreqRange = useMemo(() => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      label: `${startDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} – ${endDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}`,
    };
  }, []);

  const prevDateRange = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) return null;
    const start = new Date(dateRange.startDate + 'T12:00:00');
    const end = new Date(dateRange.endDate + 'T12:00:00');
    const days = differenceInDays(end, start) + 1;
    const prevEnd = subDays(start, 1);
    const prevStart = subDays(prevEnd, days - 1);
    const sameMonth = prevStart.getMonth() === prevEnd.getMonth() && prevStart.getFullYear() === prevEnd.getFullYear();
    const label = sameMonth
      ? format(prevStart, 'MMMM yyyy')
      : `${format(prevStart, 'MMM yyyy')} - ${format(prevEnd, 'MMM yyyy')}`;
    return {
      startDate: format(prevStart, 'yyyy-MM-dd'),
      endDate: format(prevEnd, 'yyyy-MM-dd'),
      label,
    };
  }, [dateRange]);

  useEffect(() => {
    if (isScreenshotMode) {
      setData(generateFakeAnalytics() as AnalyticsData);
      setPrevPeriodSpent(null);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (dateRange.startDate) params.set('startDate', dateRange.startDate);
        if (dateRange.endDate) params.set('endDate', dateRange.endDate);

        const fetches: Promise<Response>[] = [fetch(`/api/analytics?${params.toString()}`)];

        if (prevDateRange) {
          const prevParams = new URLSearchParams();
          prevParams.set('startDate', prevDateRange.startDate);
          prevParams.set('endDate', prevDateRange.endDate);
          fetches.push(fetch(`/api/analytics?${prevParams.toString()}`));
        }

        const responses = await Promise.all(fetches);
        const result = await responses[0].json();
        setData(result);

        if (responses[1]) {
          const prevResult = await responses[1].json();
          setPrevPeriodSpent(prevResult.periodAnalytics?.totalSpent ?? null);
        } else {
          setPrevPeriodSpent(null);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [dateRange, prevDateRange, isScreenshotMode]);

  const handlePrevMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
    setPreset('this-month');
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
    setPreset('this-month');
  };

  const displayDateRange = useMemo(() => {
    if (preset === 'this-month') {
      return format(currentMonth, 'MMMM yyyy');
    }
    if (preset === 'last-month') {
      return format(subMonths(new Date(), 1), 'MMMM yyyy');
    }
    if (preset === 'custom' && customDateRange.from && customDateRange.to) {
      return `${format(customDateRange.from, 'MMM d, yyyy')} - ${format(customDateRange.to, 'MMM d, yyyy')}`;
    }
    const labels: Record<DatePreset, string> = {
      'this-month': '',
      'last-month': '',
      'last-3-months': 'Last 3 Months',
      'last-6-months': 'Last 6 Months',
      'this-year': 'This Year',
      'all': 'All Time',
      'custom': 'Custom Range',
    };
    return labels[preset];
  }, [preset, currentMonth, customDateRange]);

  // Calculate month-over-month changes (limit to 6 months)
  const monthlyChanges = useMemo(() => {
    if (!data) return [];
    return data.monthlyTotals.slice(0, -1).slice(0, 6).map((month, index) => {
      const prevMonth = data.monthlyTotals[index + 1];
      const expenseChange = prevMonth.expenses !== 0
        ? ((month.expenses - prevMonth.expenses) / Math.abs(prevMonth.expenses)) * 100
        : 0;
      const incomeChange = prevMonth.income !== 0
        ? ((month.income - prevMonth.income) / prevMonth.income) * 100
        : 0;
      return {
        month: month.month,
        income: month.income,
        expenses: Math.abs(month.expenses),
        incomeChange,
        expenseChange,
        net: month.income + month.expenses,
      };
    });
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-muted rounded"></div>
            ))}
          </div>
          <div className="h-80 bg-muted rounded"></div>
          <div className="h-80 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Failed to load analytics data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header + Date Filter */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Deep dive into your spending patterns
          </p>
        </div>

        <div className="flex items-center gap-2">
          {preset === 'this-month' && (
            <>
              <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium min-w-[140px] text-center">
                {displayDateRange}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextMonth}
                disabled={currentMonth >= startOfMonth(new Date())}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {preset !== 'this-month' && displayDateRange}
                {preset === 'this-month' && 'Change'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="end">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={preset === 'this-month' ? 'default' : 'outline'}
                    size="sm"
                    className={preset === 'this-month' ? 'bg-foreground text-background hover:bg-foreground/90' : ''}
                    onClick={() => {
                      setCurrentMonth(new Date());
                      setPreset('this-month');
                    }}
                  >
                    This Month
                  </Button>
                  <Button
                    variant={preset === 'last-month' ? 'default' : 'outline'}
                    size="sm"
                    className={preset === 'last-month' ? 'bg-foreground text-background hover:bg-foreground/90' : ''}
                    onClick={() => setPreset('last-month')}
                  >
                    Last Month
                  </Button>
                  <Button
                    variant={preset === 'last-3-months' ? 'default' : 'outline'}
                    size="sm"
                    className={preset === 'last-3-months' ? 'bg-foreground text-background hover:bg-foreground/90' : ''}
                    onClick={() => setPreset('last-3-months')}
                  >
                    Last 3 Months
                  </Button>
                  <Button
                    variant={preset === 'last-6-months' ? 'default' : 'outline'}
                    size="sm"
                    className={preset === 'last-6-months' ? 'bg-foreground text-background hover:bg-foreground/90' : ''}
                    onClick={() => setPreset('last-6-months')}
                  >
                    Last 6 Months
                  </Button>
                  <Button
                    variant={preset === 'this-year' ? 'default' : 'outline'}
                    size="sm"
                    className={preset === 'this-year' ? 'bg-foreground text-background hover:bg-foreground/90' : ''}
                    onClick={() => setPreset('this-year')}
                  >
                    This Year
                  </Button>
                  <Button
                    variant={preset === 'all' ? 'default' : 'outline'}
                    size="sm"
                    className={preset === 'all' ? 'bg-foreground text-background hover:bg-foreground/90' : ''}
                    onClick={() => setPreset('all')}
                  >
                    All Time
                  </Button>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Custom Range</p>
                  <Calendar
                    mode="range"
                    selected={{ from: customDateRange.from, to: customDateRange.to }}
                    onSelect={(range) => {
                      setCustomDateRange({ from: range?.from, to: range?.to });
                      if (range?.from && range?.to) {
                        setPreset('custom');
                      }
                    }}
                    numberOfMonths={1}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Period Summary Row - 4 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-7">
        <StatCard
          title="Total Spent"
          value={data.periodAnalytics.totalSpent}
          icon={CurrencyDollarIcon}
          neutral
          comparison={prevPeriodSpent != null && prevPeriodSpent > 0 && prevDateRange ? {
            pctDiff: ((data.periodAnalytics.totalSpent - prevPeriodSpent) / prevPeriodSpent) * 100,
            dollarDiff: data.periodAnalytics.totalSpent - prevPeriodSpent,
            periodLabel: prevDateRange.label,
          } : undefined}
        />
        <StatCard
          title="Avg Daily Spend"
          value={data.periodAnalytics.avgDailySpend}
          icon={ArrowTrendingDownIcon}
          neutral
        />
        <StatCard
          title="Transactions"
          value={data.stats.totalTransactions}
          icon={ReceiptPercentIcon}
          format="number"
          neutral
        />
        <StatCard
          title="Savings Rate"
          value={data.savingsRate.current}
          icon={BanknotesIcon}
          format="percent"
        />
      </div>

      {/* Category Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
        <IncomeExpensesChart
          income={data.savingsRate.income}
          expenses={data.savingsRate.expenses}
          saved={data.savingsRate.saved}
          savingsRate={data.savingsRate.current}
        />

        <Card className="h-[480px] flex flex-col">
          <CardHeader>
            <CardTitle>Category Details</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            {data.spendingByCategory.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No spending data for this period</p>
            ) : (
              <div className="relative h-full">
                <div
                  className="space-y-3 h-full overflow-y-auto pr-2 pb-6"
                  onScroll={(e) => setCategoryScrolled(e.currentTarget.scrollTop > 0)}
                >
                  {data.spendingByCategory.map((cat) => {
                    const percentage = data.stats.totalExpenses !== 0
                      ? Math.abs(cat.total / data.stats.totalExpenses) * 100
                      : 0;
                    // Build the link URL with category and date filters
                    const params = new URLSearchParams();
                    params.set('category', cat.category);
                    if (dateRange.startDate) params.set('startDate', dateRange.startDate);
                    if (dateRange.endDate) params.set('endDate', dateRange.endDate);
                    const href = `/transactions?${params.toString()}`;

                    return (
                      <Link
                        key={cat.category}
                        href={href}
                        className="block space-y-1.5 p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{cat.category}</span>
                          <span className="text-muted-foreground">
                            {formatCurrency(Math.abs(cat.total))} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </Link>
                    );
                  })}
                </div>
                {data.spendingByCategory.length > 6 && !categoryScrolled && (
                  <div className="absolute bottom-0 left-0 right-0 flex justify-center pointer-events-none">
                    <ChevronDownIcon className="h-5 w-5 text-muted-foreground animate-bounce" />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions & Month-over-Month Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
        {/* Subscriptions Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Subscriptions</CardTitle>
              {data.subscriptions && data.subscriptions.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(data.subscriptions.reduce((sum, sub) => sum + sub.monthlyAmount, 0))}/mo
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!data.subscriptions || data.subscriptions.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No subscriptions detected yet. Categorize recurring payments as &quot;Subscriptions&quot;.
              </p>
            ) : (
              <div className="space-y-1">
                {data.subscriptions.map((sub, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-1 hover:bg-muted/50 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm truncate">{sub.merchant}</span>
                      {sub.billingCycle !== 'monthly' && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({sub.billingCycle === 'annual' ? 'annual' : 'quarterly'})
                        </span>
                      )}
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <span className="text-sm font-medium">
                        {formatCurrency(sub.avgAmount)}
                        <span className="text-xs text-muted-foreground font-normal">
                          /{sub.billingCycle === 'annual' ? 'yr' : sub.billingCycle === 'quarterly' ? 'qtr' : 'mo'}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Month-over-Month Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Month-over-Month Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyChanges.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Need at least 2 months of data
              </p>
            ) : (
              <div className="space-y-2">
                {monthlyChanges.map((month) => (
                  <div
                    key={month.month}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <div className="font-medium">{formatMonth(month.month)}</div>
                      <div className="text-sm text-muted-foreground">
                        Net: {formatCurrency(month.net)}
                      </div>
                    </div>
                    <div className="flex gap-6">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Income</div>
                        <div className="font-semibold text-emerald-600 dark:text-emerald-500">
                          {formatCurrency(month.income)}
                        </div>
                        {month.incomeChange !== 0 && (
                          <div className={cn(
                            'text-xs font-medium',
                            month.incomeChange > 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'
                          )}>
                            {month.incomeChange > 0 ? '+' : ''}{month.incomeChange.toFixed(1)}%
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Expenses</div>
                        <div className="font-semibold text-red-600 dark:text-red-500">
                          {formatCurrency(month.expenses)}
                        </div>
                        {month.expenseChange !== 0 && (
                          <div className={cn(
                            'text-xs font-medium',
                            month.expenseChange < 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'
                          )}>
                            {month.expenseChange > 0 ? '+' : ''}{month.expenseChange.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Spending Trends Chart */}
      <SpendingTrendChart data={data.spendingTrend6Months} selectedStartDate={dateRange.startDate} selectedEndDate={dateRange.endDate} />

      {/* Merchant Frequency Section - Sorted by Visits */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BuildingStorefrontIcon className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Most Visited Merchants</CardTitle>
            </div>
            <span className="text-sm text-muted-foreground">
              {merchantFreqRange.label}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {!data.merchantFrequency || data.merchantFrequency.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No merchant visit data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Merchant</th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Visits</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Total Spent</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Avg/Visit</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Last Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.merchantFrequency.slice(0, 10).map((merchant, index) => {
                    const merchantLink = `/transactions?search=${encodeURIComponent(merchant.merchant)}&startDate=${merchantFreqRange.startDate}&endDate=${merchantFreqRange.endDate}`;
                    return (
                    <tr key={index} className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => window.location.href = merchantLink}>
                      <td className="py-3 px-2">
                        <span className="font-medium truncate max-w-[200px] block">{merchant.merchant}</span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="inline-flex items-center justify-center min-w-[32px] h-6 px-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-full text-sm font-medium">
                          {merchant.visits}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right font-medium text-red-600 dark:text-red-500">
                        {formatCurrency(merchant.totalSpent)}
                      </td>
                      <td className="py-3 px-2 text-right text-muted-foreground">
                        {formatCurrency(merchant.avgPerVisit)}
                      </td>
                      <td className="py-3 px-2 text-right text-sm text-muted-foreground">
                        {(() => {
                          // Parse date without timezone issues
                          const [year, month, day] = merchant.lastVisit.split('-').map(Number);
                          return format(new Date(year, month - 1, day), 'MMM d');
                        })()}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Merchants by Spend Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Merchants by Spend</CardTitle>
        </CardHeader>
        <CardContent>
          {data.topMerchants.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No merchant data for this period</p>
          ) : (
            <div className="space-y-3">
              {data.topMerchants.map((merchant, index) => {
                const maxSpend = Math.abs(data.topMerchants[0].total);
                const percentage = maxSpend !== 0
                  ? (Math.abs(merchant.total) / maxSpend) * 100
                  : 0;
                return (
                  <div key={index} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground font-mono text-sm w-7">
                          #{index + 1}
                        </span>
                        <span className="font-medium truncate max-w-[300px]">
                          {merchant.merchant}
                        </span>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {merchant.count} txn{merchant.count !== 1 ? 's' : ''}
                        </span>
                        <span className="font-semibold text-red-600 dark:text-red-500 w-24 text-right">
                          {formatCurrency(Math.abs(merchant.total))}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden ml-10">
                      <div
                        className="h-full bg-red-400 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
