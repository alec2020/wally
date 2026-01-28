'use client';

import { Pie, PieChart, Cell, Label } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { formatCurrency } from '@/lib/utils';

interface IncomeExpensesChartProps {
  income: number;
  expenses: number;
  saved: number;
  savingsRate: number;
}

export function IncomeExpensesChart({ income, expenses, saved, savingsRate }: IncomeExpensesChartProps) {
  // Handle edge case: no income
  if (income <= 0) {
    return (
      <Card className="h-[480px] flex flex-col">
        <CardHeader>
          <CardTitle>Income Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">No income data for this period</p>
        </CardContent>
      </Card>
    );
  }

  // Handle overspending case (negative savings)
  const isOverspent = saved < 0;
  const displaySaved = Math.max(0, saved);

  const chartData = isOverspent
    ? [{ name: 'Expenses', value: expenses, fill: '#f43f5e' }]
    : [
        { name: 'Expenses', value: expenses, fill: '#f43f5e' },
        { name: 'Saved', value: displaySaved, fill: '#10b981' },
      ];

  const chartConfig: ChartConfig = {
    Expenses: {
      label: 'Expenses',
      color: '#f43f5e',
    },
    Saved: {
      label: 'Saved',
      color: '#10b981',
    },
  };

  const displayRate = Math.round(savingsRate);
  const rateLabel = isOverspent ? `${displayRate}%` : `${displayRate}%`;

  return (
    <Card className="h-[480px] flex flex-col">
      <CardHeader>
        <CardTitle>Income Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        {/* Donut Chart - fills available space */}
        <div className="flex-1 min-h-0">
          <ChartContainer config={chartConfig} className="w-full h-full">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="name"
                    hideLabel
                    valueFormatter={(value) => formatCurrency(value)}
                  />
                }
              />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="50%"
                outerRadius="80%"
                paddingAngle={2}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className={`fill-foreground text-3xl font-bold ${isOverspent ? 'fill-rose-500' : ''}`}
                          >
                            {rateLabel}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                            className="fill-muted-foreground text-sm"
                          >
                            {isOverspent ? 'overspent' : 'saved'}
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>

        {/* Stats row at bottom */}
        <div className="flex justify-between items-end pt-4 border-t mt-4">
          <div>
            <p className="text-sm text-muted-foreground">Income</p>
            <p className="text-lg font-semibold">{formatCurrency(income)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Expenses</p>
            <p className="text-lg font-semibold text-rose-500">{formatCurrency(expenses)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">{isOverspent ? 'Overspent' : 'Saved'}</p>
            <p className={`text-lg font-semibold ${isOverspent ? 'text-rose-500' : 'text-emerald-500'}`}>
              {isOverspent ? `-${formatCurrency(Math.abs(saved))}` : formatCurrency(saved)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
