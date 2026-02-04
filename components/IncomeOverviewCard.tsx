'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import {
  BanknotesIcon,
  ShieldCheckIcon,
  BuildingLibraryIcon,
} from '@heroicons/react/24/outline';

interface IncomeOverviewCardProps {
  monthlyTotals: { month: string; income: number; expenses: number; invested: number }[];
}

export function IncomeOverviewCard({ monthlyTotals }: IncomeOverviewCardProps) {
  const sorted = [...monthlyTotals].sort((a, b) => b.month.localeCompare(a.month));
  const recent = sorted.filter((m) => m.income > 0).slice(0, 3);
  if (recent.length === 0) return null;

  const count = recent.length;
  const avgIncome = recent.reduce((s, m) => s + m.income, 0) / count;
  const avgExpenses = recent.reduce((s, m) => s + Math.abs(m.expenses), 0) / count;
  const avgInvested = recent.reduce((s, m) => s + m.invested, 0) / count;
  const avgSaved = avgIncome - avgExpenses;

  const rows = [
    { label: 'Take-Home Pay', amount: avgIncome, icon: BanknotesIcon, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/40' },
    { label: 'Saved', amount: Math.max(0, avgSaved), icon: ShieldCheckIcon, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40' },
    { label: 'Invested', amount: avgInvested, icon: BuildingLibraryIcon, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
  ];

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <Card className="py-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold text-foreground tracking-tight">
            Income & Savings
          </CardTitle>
          <p className="text-sm text-muted-foreground/70 mt-0.5">Last 3-month average</p>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="text-4xl font-bold tracking-tight text-foreground mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {formatCurrency(avgIncome)}<span className="text-lg font-medium text-muted-foreground">/mo</span>
        </div>
        <div className="space-y-2">
          {rows.map((row, i) => {
            const Icon = row.icon;
            const pct = total > 0 ? (row.amount / total) * 100 : 0;
            return (
              <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-muted/40">
                <div className={`flex-shrink-0 rounded-lg p-2 ${row.bg}`}>
                  <Icon className={`h-4 w-4 ${row.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground">{row.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground tabular-nums whitespace-nowrap ml-3">
                      {formatCurrency(row.amount)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${row.bg.replace(/\/40/g, '')} ${row.color}`}
                      style={{ width: `${pct}%`, backgroundColor: 'currentColor', opacity: 0.5 }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
