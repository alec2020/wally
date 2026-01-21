'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccountCoverage {
  id: number;
  name: string;
  type: string;
  institution: string | null;
  coverage: Record<string, boolean>;
  statements: Array<{ periodStart: string; periodEnd: string }>;
}

interface CoverageData {
  accounts: AccountCoverage[];
  months: string[];
}

interface MissingStatementsTrackerProps {
  refreshTrigger?: number;
}

export function MissingStatementsTracker({ refreshTrigger }: MissingStatementsTrackerProps) {
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchCoverage() {
      try {
        const response = await fetch('/api/accounts/coverage');
        const coverageData = await response.json();
        setData(coverageData);
      } catch (error) {
        console.error('Failed to fetch coverage data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchCoverage();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center text-muted-foreground">
            Loading statement coverage...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.accounts.length === 0) {
    return null; // Don't show the tracker if no accounts have uploaded statements
  }

  // Calculate missing statements count
  let totalMissing = 0;
  let accountsWithMissing = 0;

  data.accounts.forEach(account => {
    const missingCount = data.months.filter(month => !account.coverage[month]).length;
    if (missingCount > 0) {
      totalMissing += missingCount;
      accountsWithMissing++;
    }
  });

  // Group accounts by type
  const creditCards = data.accounts.filter(a => a.type === 'credit_card');
  const bankAccounts = data.accounts.filter(a => a.type === 'bank');

  // Format month for display (YYYY-MM -> "Jan", "Feb", etc.)
  // Use UTC to avoid timezone issues
  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year, monthNum - 1, 15)); // Use middle of month to avoid edge cases
    return date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  };

  const formatMonthYear = (month: string) => {
    const [year, monthNum] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year, monthNum - 1, 15));
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  };

  const renderAccountGroup = (accounts: AccountCoverage[], title: string) => {
    if (accounts.length === 0) return null;

    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        {accounts.map(account => (
          <div key={account.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{account.name}</span>
              {account.institution && (
                <Badge variant="outline" className="text-xs">
                  {account.institution}
                </Badge>
              )}
            </div>
            <div className="flex gap-1">
              {data.months.map(month => (
                <div
                  key={month}
                  className={cn(
                    'flex flex-col items-center justify-center rounded px-2 py-1 text-xs',
                    account.coverage[month]
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  )}
                  title={`${formatMonthYear(month)}: ${account.coverage[month] ? 'Covered' : 'Missing'}`}
                >
                  <span className="font-medium">{formatMonth(month)}</span>
                  {account.coverage[month] ? (
                    <CheckCircle2 className="h-3 w-3 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 mt-0.5" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Statement Coverage
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-8 px-2"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="flex items-center gap-3 mb-4">
          {totalMissing === 0 ? (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              All statements uploaded
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {totalMissing} missing statement{totalMissing !== 1 ? 's' : ''} across {accountsWithMissing} account{accountsWithMissing !== 1 ? 's' : ''}
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            Last 12 months
          </span>
        </div>

        {/* Expanded coverage grid */}
        {expanded && (
          <div className="space-y-6 pt-4 border-t">
            {renderAccountGroup(creditCards, 'Credit Cards')}
            {renderAccountGroup(bankAccounts, 'Bank Accounts')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
