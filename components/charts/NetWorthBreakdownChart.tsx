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
import { formatCurrency } from '@/lib/utils';

interface BreakdownItem {
  name: string;
  value: number;
  color: string;
  type: 'asset' | 'liability' | 'account';
}

interface NetWorthBreakdownChartProps {
  data: BreakdownItem[];
}

export function NetWorthBreakdownChart({ data }: NetWorthBreakdownChartProps) {
  const chartData = data.map((item) => ({
    name: item.name,
    value: Math.abs(item.value),
    fill: item.color,
    type: item.type,
  }));

  const chartConfig = data.reduce((acc, item) => {
    acc[item.name] = {
      label: item.name,
      color: item.color,
    };
    return acc;
  }, {} as ChartConfig);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Net Worth Breakdown</CardTitle>
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
        <CardTitle>Net Worth Breakdown</CardTitle>
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
              cy="45%"
              innerRadius={60}
              outerRadius={110}
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
