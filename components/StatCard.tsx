'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatCurrency } from '@/lib/utils';
import { LucideIcon, TrendingDown, TrendingUp } from 'lucide-react';

interface StatCardProps {
  title: string;
  subtitle?: string;
  value: number;
  icon: LucideIcon;
  trend?: number;
  format?: 'currency' | 'number' | 'percent';
  className?: string;
  neutral?: boolean;
}

function useCountUp(target: number, duration: number = 1000) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const startTime = performance.now();
    const startValue = 0;

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (target - startValue) * easeOut;

      setCurrent(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }, [target, duration]);

  return current;
}

export function StatCard({
  title,
  subtitle,
  value,
  icon: Icon,
  trend,
  format = 'currency',
  className,
  neutral = false,
}: StatCardProps) {
  const animatedValue = useCountUp(value, 800);

  const formattedValue =
    format === 'currency'
      ? formatCurrency(animatedValue)
      : format === 'percent'
      ? `${animatedValue.toFixed(1)}%`
      : Math.round(animatedValue).toLocaleString();

  const isPositive = value >= 0;
  const trendIsPositive = trend && trend > 0;

  return (
    <Card className={cn('py-4', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold text-foreground tracking-tight">
            {title}
          </CardTitle>
          {subtitle && (
            <p className="text-sm text-muted-foreground/70 mt-0.5">{subtitle}</p>
          )}
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'text-4xl font-bold tracking-tight',
            neutral
              ? 'text-foreground'
              : !isPositive
              ? 'text-red-600'
              : 'text-primary'
          )}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {formattedValue}
        </div>
        {trend !== undefined && (
          <div className="mt-1 flex items-center gap-1 text-xs">
            {trendIsPositive ? (
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            <span
              className={cn(
                trendIsPositive ? 'text-emerald-600' : 'text-red-600'
              )}
            >
              {trendIsPositive ? '+' : ''}
              {trend.toFixed(1)}% from last month
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
