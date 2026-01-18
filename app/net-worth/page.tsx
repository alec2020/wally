'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { formatCurrency, formatMonth } from '@/lib/utils';
import { Save, Trash2 } from 'lucide-react';
import { useScreenshotMode } from '@/lib/screenshot-mode';
import { generateFakeSnapshots, generateFakeAccounts } from '@/lib/fake-data';

interface Account {
  id: number;
  name: string;
  type: string;
}

interface LatestBalance {
  account_id: number;
  account_name: string;
  account_type: string;
  balance: number;
  month: string;
}

interface Snapshot {
  id: number;
  month: string;
  account_id: number;
  balance: number;
  account_name: string;
  account_type: string;
}

interface SnapshotData {
  snapshots: Snapshot[];
  latestBalances: LatestBalance[];
  netWorthHistory: { month: string; balance: number }[];
  currentNetWorth: number;
}

export default function NetWorthPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [snapshotData, setSnapshotData] = useState<SnapshotData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [balances, setBalances] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { isScreenshotMode } = useScreenshotMode();

  // Generate month options (current month + last 12 months)
  const monthOptions = Array.from({ length: 13 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    return month;
  });

  const fetchData = useCallback(async () => {
    if (isScreenshotMode) {
      const fakeAccounts = generateFakeAccounts();
      const fakeSnapshots = generateFakeSnapshots();
      const netWorthAccounts = fakeAccounts.filter(
        a => a.type === 'bank' || a.type === 'brokerage'
      );
      setAccounts(netWorthAccounts as Account[]);
      setSnapshotData(fakeSnapshots as SnapshotData);
      if (!selectedMonth) {
        setSelectedMonth(monthOptions[0]);
      }
      setIsLoading(false);
      return;
    }

    try {
      const [accountsRes, snapshotsRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/snapshots'),
      ]);
      const accountsData = await accountsRes.json();
      const snapshotsData = await snapshotsRes.json();

      // Only show bank and brokerage accounts for net worth (not credit cards)
      const netWorthAccounts = (accountsData.accounts || []).filter(
        (a: Account) => a.type === 'bank' || a.type === 'brokerage'
      );
      setAccounts(netWorthAccounts);
      setSnapshotData(snapshotsData);

      // Set default month to current month
      if (!selectedMonth) {
        setSelectedMonth(monthOptions[0]);
      }

      // Pre-fill balances for selected month if they exist
      const monthSnapshots = snapshotsData.snapshots.filter(
        (s: Snapshot) => s.month === selectedMonth
      );
      const initialBalances: Record<number, string> = {};
      monthSnapshots.forEach((s: Snapshot) => {
        initialBalances[s.account_id] = s.balance.toString();
      });
      setBalances(initialBalances);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, monthOptions, isScreenshotMode]);

  useEffect(() => {
    fetchData();
  }, []);

  // Update balances when month changes
  useEffect(() => {
    if (snapshotData && selectedMonth) {
      const monthSnapshots = snapshotData.snapshots.filter(
        (s) => s.month === selectedMonth
      );
      const newBalances: Record<number, string> = {};
      monthSnapshots.forEach((s) => {
        newBalances[s.account_id] = s.balance.toString();
      });
      setBalances(newBalances);
    }
  }, [selectedMonth, snapshotData]);

  const handleSaveBalances = async () => {
    setIsSaving(true);
    try {
      // Save all non-empty balances
      const promises = Object.entries(balances)
        .filter(([_, value]) => value !== '' && !isNaN(parseFloat(value)))
        .map(([accountId, balance]) =>
          fetch('/api/snapshots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              month: selectedMonth,
              accountId: parseInt(accountId, 10),
              balance: parseFloat(balance),
            }),
          })
        );

      await Promise.all(promises);
      await fetchData();
    } catch (error) {
      console.error('Failed to save balances:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSnapshot = async (id: number) => {
    try {
      await fetch(`/api/snapshots?id=${id}`, { method: 'DELETE' });
      await fetchData();
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const currentNetWorth = snapshotData?.currentNetWorth ?? 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Net Worth</h1>
        <p className="text-muted-foreground mt-1">Track your account balances over time</p>
      </div>

      {/* Net Worth Card with Chart */}
      <Card className="mb-8">
        <CardContent>
          <p className="text-sm text-muted-foreground">Your net worth is</p>
          <p className="text-4xl font-bold text-foreground tracking-tight">
            {formatCurrency(currentNetWorth)}
          </p>
        </CardContent>
        {snapshotData?.netWorthHistory && snapshotData.netWorthHistory.length > 0 ? (
          <CardContent>
            <NetWorthChart data={snapshotData.netWorthHistory} />
          </CardContent>
        ) : (
          <CardContent>
            <div className="flex h-[200px] items-center justify-center">
              <p className="text-muted-foreground">Add monthly balances below to see your net worth over time</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Account Balances */}
      <Card>
        <CardHeader>
          <CardTitle>Account Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => (
                    <SelectItem key={month} value={month}>
                      {formatMonth(month)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {accounts.map((account) => (
              <div key={account.id}>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  {account.name}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-[140px] pl-7"
                    value={balances[account.id] ?? ''}
                    onChange={(e) =>
                      setBalances((prev) => ({
                        ...prev,
                        [account.id]: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            ))}
            <Button onClick={handleSaveBalances} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
          {accounts.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No accounts found. Upload a statement first to create accounts.
            </p>
          )}
        </CardContent>

        {/* History Table */}
        {snapshotData?.snapshots && snapshotData.snapshots.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshotData.snapshots.map((snapshot) => (
                  <TableRow key={snapshot.id}>
                    <TableCell className="py-2">{formatMonth(snapshot.month)}</TableCell>
                    <TableCell className="py-2">{snapshot.account_name}</TableCell>
                    <TableCell className="py-2 text-right font-medium">
                      {formatCurrency(snapshot.balance)}
                    </TableCell>
                    <TableCell className="py-2">
                      <button
                        onClick={() => handleDeleteSnapshot(snapshot.id)}
                        className="p-1 hover:bg-muted rounded transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
