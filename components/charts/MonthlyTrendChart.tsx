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
  invested: number;
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
  invested: {
    label: 'Invested',
    color: '#3b82f6',
  },
} satisfies ChartConfig;

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  const chartData = [...data].reverse().map((item) => ({
    month: formatMonth(item.month),
    income: item.income,
    expenses: Math.abs(item.expenses),
    invested: item.invested,
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
          <AreaChart data={chartData} accessibilityLayer margin={{ left: -5 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              tick={({ x, y, payload, index }) => (
                <text
                  x={x}
                  y={y}
                  dy={12}
                  fontSize={12}
                  textAnchor={index === chartData.length - 1 ? 'end' : index === 0 ? 'start' : 'middle'}
                  fill="currentColor"
                  className="text-muted-foreground"
                >
                  {payload.value}
                </text>
              )}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              width={40}
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
            <Area
              type="monotone"
              dataKey="invested"
              stackId="3"
              stroke="var(--color-invested)"
              fill="var(--color-invested)"
              fillOpacity={0.3}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
