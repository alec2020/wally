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
import { formatCurrency, formatMonth, getCategoryColor, getCategoryColorFromList } from '@/lib/utils';

interface MonthlyExpenseData {
  month: string;
  category: string;
  total: number;
}

interface CategoryInfo {
  name: string;
  color: string | null;
}

interface MonthlyExpenseTrendsChartProps {
  data: MonthlyExpenseData[];
  categories?: CategoryInfo[];
}

export function MonthlyExpenseTrendsChart({ data, categories: categoriesProp = [] }: MonthlyExpenseTrendsChartProps) {
  const getColor = (category: string) =>
    categoriesProp.length > 0
      ? getCategoryColorFromList(category, categoriesProp)
      : getCategoryColor(category);

  // Get unique categories and months
  const categoryNames = [...new Set(data.map((d) => d.category))];
  const months = [...new Set(data.map((d) => d.month))].sort();

  // Take last 12 months
  const recentMonths = months.slice(-12);

  // Transform data into chart format: { month: 'Jan', Housing: 1000, Food: 500, ... }
  const chartData = recentMonths.map((month) => {
    const monthData: Record<string, string | number> = {
      month: formatMonth(month),
    };
    categoryNames.forEach((category) => {
      const entry = data.find((d) => d.month === month && d.category === category);
      monthData[category] = entry?.total || 0;
    });
    return monthData;
  });

  // Build chart config dynamically based on categories
  const chartConfig: ChartConfig = {};
  categoryNames.forEach((category) => {
    chartConfig[category] = {
      label: category,
      color: getColor(category),
    };
  });

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Expense Trends</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[400px] items-center justify-center">
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Expense Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
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
                  valueFormatter={(value) => formatCurrency(value as number)}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {categoryNames.map((category) => (
              <Area
                key={category}
                type="monotone"
                dataKey={category}
                stroke={getColor(category)}
                fill={getColor(category)}
                fillOpacity={0.1}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
