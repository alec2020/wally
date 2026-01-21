'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { formatCurrency, formatMonth } from '@/lib/utils';

interface NetWorthData {
  month: string;
  balance: number;
}

interface NetWorthChartProps {
  data: NetWorthData[];
}

const chartConfig = {
  netWorth: {
    label: 'Net Worth',
    color: '#10b981',
  },
} satisfies ChartConfig;

export function NetWorthChart({ data }: NetWorthChartProps) {
  const chartData = [...data].reverse().map((item) => ({
    month: formatMonth(item.month),
    netWorth: item.balance,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center">
        <p className="text-muted-foreground">No net worth data available</p>
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[320px] w-full">
      <AreaChart data={chartData} accessibilityLayer>
        <defs>
          <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
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
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          fontSize={12}
          width={50}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              valueFormatter={(value) => formatCurrency(value)}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="netWorth"
          stroke="#10b981"
          strokeWidth={2.5}
          fill="url(#netWorthGradient)"
          dot={false}
          activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
