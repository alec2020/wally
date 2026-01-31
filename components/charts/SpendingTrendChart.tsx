'use client';

import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ReferenceArea } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { formatCurrency, formatMonth } from '@/lib/utils';

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

interface SpendingTrendChartProps {
  data: MonthlyData[];
  selectedStartDate?: string;
  selectedEndDate?: string;
}

const chartConfig = {
  spending: {
    label: 'Spending',
    color: '#f97316',
  },
} satisfies ChartConfig;

export function SpendingTrendChart({ data, selectedStartDate, selectedEndDate }: SpendingTrendChartProps) {
  const chartData = useMemo(() => {
    return [...data].reverse().map((item) => ({
      month: formatMonth(item.month),
      rawMonth: item.month,
      spending: Math.abs(item.expenses),
    }));
  }, [data]);

  // Determine which months fall within the selected date range
  const selectedMonths = useMemo(() => {
    if (!selectedStartDate || !selectedEndDate) return new Set<string>();
    const startMonth = selectedStartDate.slice(0, 7);
    const endMonth = selectedEndDate.slice(0, 7);
    const selected = new Set<string>();
    for (const item of chartData) {
      if (item.rawMonth >= startMonth && item.rawMonth <= endMonth) {
        selected.add(item.month);
      }
    }
    return selected;
  }, [selectedStartDate, selectedEndDate, chartData]);

  // Find contiguous ranges of selected months for ReferenceArea
  const referenceAreas = useMemo(() => {
    if (selectedMonths.size === 0) return [];
    const areas: { x1: string; x2: string }[] = [];
    let rangeStart: string | null = null;
    let rangeLast: string | null = null;
    for (const item of chartData) {
      if (selectedMonths.has(item.month)) {
        if (!rangeStart) rangeStart = item.month;
        rangeLast = item.month;
      } else {
        if (rangeStart && rangeLast) {
          areas.push({ x1: rangeStart, x2: rangeLast });
        }
        rangeStart = null;
        rangeLast = null;
      }
    }
    if (rangeStart && rangeLast) {
      areas.push({ x1: rangeStart, x2: rangeLast });
    }
    return areas;
  }, [chartData, selectedMonths]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending Trends</CardTitle>
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
        <CardTitle>Spending Trends</CardTitle>
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
                  fontWeight={selectedMonths.has(payload.value) ? 700 : 400}
                  textAnchor={index === chartData.length - 1 ? 'end' : index === 0 ? 'start' : 'middle'}
                  fill="currentColor"
                  className={selectedMonths.has(payload.value) ? 'text-foreground' : 'text-muted-foreground'}
                >
                  {payload.value}
                </text>
              )}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              width={45}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  valueFormatter={(value) => formatCurrency(value)}
                />
              }
            />
            <defs>
              <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            {referenceAreas.map((area, i) => (
              <ReferenceArea
                key={i}
                x1={area.x1}
                x2={area.x2}
                fill="#f97316"
                fillOpacity={0.08}
                strokeOpacity={0}
              />
            ))}
            <Area
              type="monotone"
              dataKey="spending"
              stroke="#f97316"
              strokeWidth={2}
              fill="url(#spendingGradient)"
              dot={({ cx, cy, payload }) => {
                const isSelected = selectedMonths.has(payload.month);
                return isSelected ? (
                  <circle
                    key={payload.month}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill="#f97316"
                    stroke="white"
                    strokeWidth={2}
                  />
                ) : (
                  <circle key={payload.month} cx={cx} cy={cy} r={0} fill="none" />
                );
              }}
              activeDot={{ r: 5, strokeWidth: 2 }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
