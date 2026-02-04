'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import {
  HomeIcon,
  TruckIcon,
  AcademicCapIcon,
  CreditCardIcon,
  BanknotesIcon,
  SwatchIcon,
} from '@heroicons/react/24/outline';

interface RecurringExpensesCardProps {
  subscriptions: { merchant: string; monthlyAmount: number }[];
  liabilities: { name: string; type: string; monthlyPayment: number }[];
  housingExpenses: { name: string; amount: number }[];
}

interface GroupedRow {
  label: string;
  amount: number;
  detail?: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
  bg: string;
}

const liabilityConfig: Record<string, { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; color: string; bg: string }> = {
  auto_loan: { icon: TruckIcon, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  student_loan: { icon: AcademicCapIcon, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/40' },
  mortgage: { icon: HomeIcon, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
  personal_loan: { icon: BanknotesIcon, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/40' },
  other: { icon: CreditCardIcon, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800/40' },
};

export function RecurringExpensesCard({ subscriptions, liabilities, housingExpenses }: RecurringExpensesCardProps) {
  const rows: GroupedRow[] = [];

  // Housing
  const housingTotal = housingExpenses.reduce((sum, h) => sum + h.amount, 0);
  if (housingTotal > 0) {
    const detail = housingExpenses.length === 1 ? housingExpenses[0].name : undefined;
    rows.push({ label: 'Housing', amount: housingTotal, detail, icon: HomeIcon, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/40' });
  }

  // Liabilities
  for (const l of liabilities) {
    const config = liabilityConfig[l.type] || liabilityConfig.other;
    rows.push({ label: l.name, amount: l.monthlyPayment, icon: config.icon, color: config.color, bg: config.bg });
  }

  // Subscriptions
  const subsTotal = subscriptions.reduce((sum, s) => sum + s.monthlyAmount, 0);
  if (subsTotal > 0) {
    rows.push({
      label: 'Subscriptions',
      amount: subsTotal,
      detail: `${subscriptions.length} active`,
      icon: SwatchIcon,
      color: 'text-pink-600 dark:text-pink-400',
      bg: 'bg-pink-100 dark:bg-pink-900/40',
    });
  }

  rows.sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((sum, r) => sum + r.amount, 0);

  if (rows.length === 0) return null;

  return (
    <Card className="py-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold text-foreground tracking-tight">
            Baseline Expenses
          </CardTitle>
          <p className="text-sm text-muted-foreground/70 mt-0.5">Fixed monthly costs</p>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="text-4xl font-bold tracking-tight text-foreground mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {formatCurrency(total)}<span className="text-lg font-medium text-muted-foreground">/mo</span>
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
                      {row.detail && (
                        <span className="text-xs text-muted-foreground ml-1.5">{row.detail}</span>
                      )}
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
