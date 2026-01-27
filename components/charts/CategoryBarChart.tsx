'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { getCategoryColor, getCategoryColorFromList, formatCurrency } from '@/lib/utils';

interface CategoryData {
  category: string;
  total: number;
}

interface CategoryInfo {
  name: string;
  color: string | null;
}

interface CategoryBarChartProps {
  data: CategoryData[];
  title?: string;
  categories?: CategoryInfo[];
}

export function CategoryBarChart({
  data,
  title = 'Spending by Category',
  categories = [],
}: CategoryBarChartProps) {
  const getColor = (category: string) =>
    categories.length > 0
      ? getCategoryColorFromList(category, categories)
      : getCategoryColor(category);

  const chartData = data.map((item) => ({
    name: item.category,
    amount: Math.abs(item.total),
    fill: getColor(item.category),
  }));

  const chartConfig = data.reduce((acc, item) => {
    acc[item.category] = {
      label: item.category,
      color: getColor(item.category),
    };
    return acc;
  }, {} as ChartConfig);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
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
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={chartData} layout="vertical" accessibilityLayer>
            <CartesianGrid horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => {
                if (value === 0) return '$0';
                if (value < 1000) return `$${value}`;
                const k = value / 1000;
                return k >= 10 ? `$${k.toFixed(0)}k` : `$${k.toFixed(1)}k`;
              }}
            />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={100}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="name"
                  hideLabel
                  valueFormatter={(value) => formatCurrency(value)}
                />
              }
            />
            <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
