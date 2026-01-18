'use client';

import { Pie, PieChart, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { getCategoryColor, formatCurrency } from '@/lib/utils';

interface SpendingData {
  category: string;
  total: number;
}

interface SpendingPieChartProps {
  data: SpendingData[];
}

export function SpendingPieChart({ data }: SpendingPieChartProps) {
  const chartData = data.map((item) => ({
    name: item.category,
    value: Math.abs(item.total),
    fill: getCategoryColor(item.category),
  }));

  const chartConfig = data.reduce((acc, item) => {
    acc[item.category] = {
      label: item.category,
      color: getCategoryColor(item.category),
    };
    return acc;
  }, {} as ChartConfig);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending by Category</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center">
          <p className="text-muted-foreground">No spending data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
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
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="name" className="flex-wrap" />}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
