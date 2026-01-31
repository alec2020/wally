'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatCurrency } from '@/lib/utils';
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface ComparisonProps {
  pctDiff: number;
  dollarDiff?: number;
  periodLabel?: string;
}

interface StatCardProps {
  title: string;
  subtitle?: string;
  value: number;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  trend?: number;
  comparison?: ComparisonProps;
  format?: 'currency' | 'number' | 'percent';
  className?: string;
  neutral?: boolean;
  variant?: 'auto' | 'positive' | 'negative';
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
  comparison,
  format = 'currency',
  className,
  neutral = false,
  variant = 'auto',
}: StatCardProps) {
  const animatedValue = useCountUp(value, 800);
  const animatedPctDiff = useCountUp(comparison?.pctDiff ?? 0, 800);

  const formattedValue =
    format === 'currency'
      ? formatCurrency(animatedValue)
      : format === 'percent'
      ? `${animatedValue.toFixed(1)}%`
      : Math.round(animatedValue).toLocaleString();

  const isPositive = variant === 'auto' ? value >= 0 : variant === 'positive';
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
        <div className="flex items-center justify-between gap-2">
          <div
            className={cn(
              'text-4xl font-bold tracking-tight',
              neutral
                ? 'text-foreground'
                : !isPositive
                ? 'text-red-600 dark:text-red-500'
                : 'text-emerald-600 dark:text-emerald-500'
            )}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {formattedValue}
          </div>
          {comparison && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full cursor-default',
                  comparison.pctDiff <= 0
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                )}>
                  {comparison.pctDiff <= 0 ? (
                    <ArrowTrendingDownIcon className="h-3 w-3" />
                  ) : (
                    <ArrowTrendingUpIcon className="h-3 w-3" />
                  )}
                  <span>{comparison.pctDiff > 0 ? '+' : ''}{animatedPctDiff.toFixed(1)}%</span>
                </div>
              </TooltipTrigger>
              {comparison.dollarDiff != null && (
                <TooltipContent>
                  {comparison.dollarDiff > 0 ? '+' : ''}{formatCurrency(comparison.dollarDiff)} vs {comparison.periodLabel || 'previous period'}
                </TooltipContent>
              )}
            </Tooltip>
          )}
        </div>
        {trend !== undefined && (
          <div className="mt-1 flex items-center gap-1 text-xs">
            {trendIsPositive ? (
              <ArrowTrendingUpIcon className="h-3 w-3 text-emerald-600 dark:text-emerald-500" />
            ) : (
              <ArrowTrendingDownIcon className="h-3 w-3 text-red-600 dark:text-red-500" />
            )}
            <span
              className={cn(
                trendIsPositive ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'
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
