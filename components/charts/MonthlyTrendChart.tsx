'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { formatCurrency, formatMonth } from '@/lib/utils';

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

interface MonthlyTrendChartProps {
  data: MonthlyData[];
}

const chartConfig = {
  income: {
    label: 'Income',
    color: '#22c55e',
  },
  expenses: {
    label: 'Expenses',
    color: '#ef4444',
  },
} satisfies ChartConfig;

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  const chartData = [...data].reverse().map((item) => ({
    month: formatMonth(item.month),
    income: item.income,
    expenses: Math.abs(item.expenses),
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Trends</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center">
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  valueFormatter={(value) => formatCurrency(value)}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              type="monotone"
              dataKey="income"
              stackId="1"
              stroke="var(--color-income)"
              fill="var(--color-income)"
              fillOpacity={0.3}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stackId="2"
              stroke="var(--color-expenses)"
              fill="var(--color-expenses)"
              fillOpacity={0.3}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
