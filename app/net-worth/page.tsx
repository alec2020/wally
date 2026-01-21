'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { NetWorthBreakdownChart } from '@/components/charts/NetWorthBreakdownChart';
import { StatCard } from '@/components/StatCard';
import {
  formatCurrency,
  formatMonth,
  getAssetTypeLabel,
  getAssetTypeColor,
  getLiabilityTypeLabel,
  getLiabilityTypeColor,
  calculatePayoffProgress,
  calculateMonthsToPayoff,
  calculateAssetChange,
  AssetType,
  LiabilityType,
} from '@/lib/utils';
import { Save, Trash2, Plus, Pencil, Car, Watch, Home, Star, Box } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useScreenshotMode } from '@/lib/screenshot-mode';
import { generateFakeSnapshots, generateFakeAccounts, generateFakeAssets, generateFakeLiabilities } from '@/lib/fake-data';

function useCountUp(target: number, duration: number = 800) {
  const [current, setCurrent] = useState(0);
  const prevTarget = useRef(target);

  useEffect(() => {
    const startValue = prevTarget.current !== target ? 0 : current;
    prevTarget.current = target;
    const startTime = performance.now();

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

interface Asset {
  id: number;
  name: string;
  type: AssetType;
  purchase_price: number | null;
  purchase_date: string | null;
  current_value: number;
  notes: string | null;
}

interface Liability {
  id: number;
  name: string;
  type: LiabilityType;
  original_amount: number;
  current_balance: number;
  interest_rate: number | null;
  monthly_payment: number | null;
  start_date: string | null;
  exclude_from_net_worth: boolean;
  notes: string | null;
}

const assetTypeIcons: Record<AssetType, React.ReactNode> = {
  vehicle: <Car className="h-5 w-5" />,
  jewelry: <Watch className="h-5 w-5" />,
  real_estate: <Home className="h-5 w-5" />,
  collectible: <Star className="h-5 w-5" />,
  other: <Box className="h-5 w-5" />,
};

export default function NetWorthPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [snapshotData, setSnapshotData] = useState<SnapshotData | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [totalAssetsValue, setTotalAssetsValue] = useState(0);
  const [totalLiabilitiesBalance, setTotalLiabilitiesBalance] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [balances, setBalances] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { isScreenshotMode } = useScreenshotMode();

  // Asset dialog state
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [assetForm, setAssetForm] = useState({
    name: '',
    type: 'vehicle' as AssetType,
    current_value: '',
    purchase_price: '',
    purchase_date: '',
    notes: '',
  });

  // Liability dialog state
  const [liabilityDialogOpen, setLiabilityDialogOpen] = useState(false);
  const [editingLiability, setEditingLiability] = useState<Liability | null>(null);
  const [liabilityForm, setLiabilityForm] = useState({
    name: '',
    type: 'auto_loan' as LiabilityType,
    original_amount: '',
    current_balance: '',
    interest_rate: '',
    monthly_payment: '',
    start_date: '',
    exclude_from_net_worth: false,
    notes: '',
  });

  // Calculate net worth (must be before any early returns for hooks)
  const accountsTotal = snapshotData?.currentNetWorth ?? 0;
  const liabilitiesForNetWorth = liabilities
    .filter((l) => !l.exclude_from_net_worth)
    .reduce((sum, l) => sum + l.current_balance, 0);
  const totalNetWorth = accountsTotal + totalAssetsValue - liabilitiesForNetWorth;
  const animatedNetWorth = useCountUp(totalNetWorth);

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
      const fakeAssets = generateFakeAssets();
      const fakeLiabilities = generateFakeLiabilities();

      const netWorthAccounts = fakeAccounts.filter(
        a => a.type === 'bank' || a.type === 'brokerage'
      );
      setAccounts(netWorthAccounts as Account[]);
      setSnapshotData(fakeSnapshots as SnapshotData);
      setAssets(fakeAssets);
      setLiabilities(fakeLiabilities);
      setTotalAssetsValue(fakeAssets.reduce((sum, a) => sum + a.current_value, 0));
      setTotalLiabilitiesBalance(fakeLiabilities.reduce((sum, l) => sum + l.current_balance, 0));

      if (!selectedMonth) {
        setSelectedMonth(monthOptions[0]);
      }
      setIsLoading(false);
      return;
    }

    try {
      const [accountsRes, snapshotsRes, assetsRes, liabilitiesRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/snapshots'),
        fetch('/api/assets'),
        fetch('/api/liabilities'),
      ]);
      const accountsData = await accountsRes.json();
      const snapshotsData = await snapshotsRes.json();
      const assetsData = await assetsRes.json();
      const liabilitiesData = await liabilitiesRes.json();

      // Only show bank and brokerage accounts for net worth (not credit cards)
      const netWorthAccounts = (accountsData.accounts || []).filter(
        (a: Account) => a.type === 'bank' || a.type === 'brokerage'
      );
      setAccounts(netWorthAccounts);
      setSnapshotData(snapshotsData);
      setAssets(assetsData.assets || []);
      setLiabilities(liabilitiesData.liabilities || []);
      setTotalAssetsValue(assetsData.totalValue || 0);
      setTotalLiabilitiesBalance(liabilitiesData.totalBalance || 0);

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

  // Asset handlers
  const openAssetDialog = (asset?: Asset) => {
    if (asset) {
      setEditingAsset(asset);
      setAssetForm({
        name: asset.name,
        type: asset.type,
        current_value: asset.current_value.toString(),
        purchase_price: asset.purchase_price?.toString() || '',
        purchase_date: asset.purchase_date || '',
        notes: asset.notes || '',
      });
    } else {
      setEditingAsset(null);
      setAssetForm({
        name: '',
        type: 'vehicle',
        current_value: '',
        purchase_price: '',
        purchase_date: '',
        notes: '',
      });
    }
    setAssetDialogOpen(true);
  };

  const handleSaveAsset = async () => {
    const payload = {
      name: assetForm.name,
      type: assetForm.type,
      current_value: parseFloat(assetForm.current_value),
      purchase_price: assetForm.purchase_price ? parseFloat(assetForm.purchase_price) : null,
      purchase_date: assetForm.purchase_date || null,
      notes: assetForm.notes || null,
    };

    try {
      if (editingAsset) {
        await fetch('/api/assets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingAsset.id, ...payload }),
        });
      } else {
        await fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setAssetDialogOpen(false);
      await fetchData();
    } catch (error) {
      console.error('Failed to save asset:', error);
    }
  };

  const handleDeleteAsset = async (id: number) => {
    try {
      await fetch(`/api/assets?id=${id}`, { method: 'DELETE' });
      await fetchData();
    } catch (error) {
      console.error('Failed to delete asset:', error);
    }
  };

  // Liability handlers
  const openLiabilityDialog = (liability?: Liability) => {
    if (liability) {
      setEditingLiability(liability);
      setLiabilityForm({
        name: liability.name,
        type: liability.type,
        original_amount: liability.original_amount.toString(),
        current_balance: liability.current_balance.toString(),
        interest_rate: liability.interest_rate?.toString() || '',
        monthly_payment: liability.monthly_payment?.toString() || '',
        start_date: liability.start_date || '',
        exclude_from_net_worth: liability.exclude_from_net_worth,
        notes: liability.notes || '',
      });
    } else {
      setEditingLiability(null);
      setLiabilityForm({
        name: '',
        type: 'auto_loan',
        original_amount: '',
        current_balance: '',
        interest_rate: '',
        monthly_payment: '',
        start_date: '',
        exclude_from_net_worth: false,
        notes: '',
      });
    }
    setLiabilityDialogOpen(true);
  };

  const handleSaveLiability = async () => {
    const payload = {
      name: liabilityForm.name,
      type: liabilityForm.type,
      original_amount: parseFloat(liabilityForm.original_amount),
      current_balance: parseFloat(liabilityForm.current_balance),
      interest_rate: liabilityForm.interest_rate ? parseFloat(liabilityForm.interest_rate) : null,
      monthly_payment: liabilityForm.monthly_payment ? parseFloat(liabilityForm.monthly_payment) : null,
      start_date: liabilityForm.start_date || null,
      exclude_from_net_worth: liabilityForm.exclude_from_net_worth,
      notes: liabilityForm.notes || null,
    };

    try {
      if (editingLiability) {
        await fetch('/api/liabilities', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingLiability.id, ...payload }),
        });
      } else {
        await fetch('/api/liabilities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setLiabilityDialogOpen(false);
      await fetchData();
    } catch (error) {
      console.error('Failed to save liability:', error);
    }
  };

  const handleDeleteLiability = async (id: number) => {
    try {
      await fetch(`/api/liabilities?id=${id}`, { method: 'DELETE' });
      await fetchData();
    } catch (error) {
      console.error('Failed to delete liability:', error);
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

  // Build breakdown chart data
  const breakdownData = [
    ...(accountsTotal > 0
      ? [{ name: 'Accounts', value: accountsTotal, color: '#22c55e', type: 'account' as const }]
      : []),
    ...assets.map((asset) => ({
      name: asset.name,
      value: asset.current_value,
      color: getAssetTypeColor(asset.type),
      type: 'asset' as const,
    })),
    ...liabilities.map((liability) => ({
      name: liability.name,
      value: liability.current_balance,
      color: getLiabilityTypeColor(liability.type),
      type: 'liability' as const,
    })),
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Net Worth</h1>
        <p className="text-muted-foreground mt-1">Track your assets, debts, and account balances</p>
      </div>

      {/* Net Worth Card with Chart */}
      <Card className="mb-8">
        <CardContent>
          <p className="text-sm text-muted-foreground">Your net worth is</p>
          <p className="text-4xl font-bold text-foreground tracking-tight">
            {formatCurrency(animatedNetWorth)}
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

      {/* Assets and Liabilities Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <StatCard
          title="Total Assets"
          subtitle={`${assets.length} tracked asset${assets.length !== 1 ? 's' : ''}`}
          value={accountsTotal + totalAssetsValue}
          icon={TrendingUp}
          neutral
        />
        <StatCard
          title="Total Liabilities"
          subtitle={`${liabilities.length} active debt${liabilities.length !== 1 ? 's' : ''}`}
          value={totalLiabilitiesBalance}
          icon={TrendingDown}
          variant="negative"
        />
      </div>

      {/* Breakdown Chart */}
      {breakdownData.length > 0 && (
        <div className="mb-8">
          <NetWorthBreakdownChart data={breakdownData} />
        </div>
      )}

      {/* Assets and Debts Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Assets Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Assets</CardTitle>
          <Button size="sm" onClick={() => openAssetDialog()}>
            <Plus className="h-4 w-4 mr-1" />
            Add Asset
          </Button>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No assets tracked yet. Add your first asset to start tracking.
            </p>
          ) : (
            <div className="space-y-3">
              {assets.map((asset) => {
                const change = calculateAssetChange(asset.current_value, asset.purchase_price);
                return (
                  <div
                    key={asset.id}
                    className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${getAssetTypeColor(asset.type)}20` }}
                      >
                        <span style={{ color: getAssetTypeColor(asset.type) }}>
                          {assetTypeIcons[asset.type]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{asset.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {getAssetTypeLabel(asset.type)}
                          {asset.purchase_price && (
                            <>
                              {' '}
                              • Purchased {formatCurrency(asset.purchase_price)}
                              {change !== null && (
                                <span className={change >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {' '}({change >= 0 ? '+' : ''}{change}%)
                                </span>
                              )}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">
                        {formatCurrency(asset.current_value)}
                      </p>
                      <button
                        onClick={() => openAssetDialog(asset)}
                        className="p-1 hover:bg-muted rounded transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="p-1 hover:bg-muted rounded transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

        {/* Debts Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Debts</CardTitle>
          <Button size="sm" onClick={() => openLiabilityDialog()}>
            <Plus className="h-4 w-4 mr-1" />
            Add Debt
          </Button>
        </CardHeader>
        <CardContent>
          {liabilities.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No debts tracked yet. Add a debt to track your payoff progress.
            </p>
          ) : (
            <div className="space-y-4">
              {liabilities.map((liability) => {
                const progress = calculatePayoffProgress(liability.original_amount, liability.current_balance);
                const monthsLeft = calculateMonthsToPayoff(
                  liability.current_balance,
                  liability.monthly_payment,
                  liability.interest_rate
                );
                return (
                  <div
                    key={liability.id}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium text-foreground">{liability.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(liability.current_balance)} remaining of {formatCurrency(liability.original_amount)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openLiabilityDialog(liability)}
                          className="p-1 hover:bg-muted rounded transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDeleteLiability(liability.id)}
                          className="p-1 hover:bg-muted rounded transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </div>
                    <div className="mb-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Payoff progress</span>
                        <span className="font-medium">{progress}% paid</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${progress}%`,
                            backgroundColor: getLiabilityTypeColor(liability.type),
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {liability.monthly_payment && (
                        <span>{formatCurrency(liability.monthly_payment)}/mo</span>
                      )}
                      {liability.interest_rate && (
                        <span>{liability.interest_rate}% APR</span>
                      )}
                      {monthsLeft !== null && (
                        <span>~{monthsLeft} month{monthsLeft !== 1 ? 's' : ''} left</span>
                      )}
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{
                        backgroundColor: `${getLiabilityTypeColor(liability.type)}20`,
                        color: getLiabilityTypeColor(liability.type),
                      }}>
                        {getLiabilityTypeLabel(liability.type)}
                      </span>
                      {liability.exclude_from_net_worth && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Excluded from net worth
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

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

      {/* Asset Dialog */}
      <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Edit Asset' : 'Add Asset'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="asset-name">Name</Label>
              <Input
                id="asset-name"
                placeholder="e.g., 2022 Honda Accord"
                value={assetForm.name}
                onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="asset-type">Type</Label>
              <Select
                value={assetForm.type}
                onValueChange={(value: AssetType) => setAssetForm((f) => ({ ...f, type: value }))}
              >
                <SelectTrigger id="asset-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vehicle">Vehicle</SelectItem>
                  <SelectItem value="jewelry">Jewelry</SelectItem>
                  <SelectItem value="real_estate">Real Estate</SelectItem>
                  <SelectItem value="collectible">Collectible</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="asset-value">Current Value</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="asset-value"
                  type="number"
                  step="0.01"
                  placeholder="25000"
                  className="pl-7"
                  value={assetForm.current_value}
                  onChange={(e) => setAssetForm((f) => ({ ...f, current_value: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="asset-purchase-price">Purchase Price (optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="asset-purchase-price"
                  type="number"
                  step="0.01"
                  placeholder="28000"
                  className="pl-7"
                  value={assetForm.purchase_price}
                  onChange={(e) => setAssetForm((f) => ({ ...f, purchase_price: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="asset-purchase-date">Purchase Date (optional)</Label>
              <Input
                id="asset-purchase-date"
                type="date"
                value={assetForm.purchase_date}
                onChange={(e) => setAssetForm((f) => ({ ...f, purchase_date: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAsset}
              disabled={!assetForm.name || !assetForm.current_value}
            >
              {editingAsset ? 'Save Changes' : 'Add Asset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Liability Dialog */}
      <Dialog open={liabilityDialogOpen} onOpenChange={setLiabilityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLiability ? 'Edit Debt' : 'Add Debt'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="liability-name">Name</Label>
              <Input
                id="liability-name"
                placeholder="e.g., Honda Accord Loan"
                value={liabilityForm.name}
                onChange={(e) => setLiabilityForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="liability-type">Type</Label>
              <Select
                value={liabilityForm.type}
                onValueChange={(value: LiabilityType) => setLiabilityForm((f) => ({ ...f, type: value }))}
              >
                <SelectTrigger id="liability-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto_loan">Auto Loan</SelectItem>
                  <SelectItem value="mortgage">Mortgage</SelectItem>
                  <SelectItem value="personal_loan">Personal Loan</SelectItem>
                  <SelectItem value="student_loan">Student Loan</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="liability-original">Original Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="liability-original"
                    type="number"
                    step="0.01"
                    placeholder="25000"
                    className="pl-7"
                    value={liabilityForm.original_amount}
                    onChange={(e) => setLiabilityForm((f) => ({ ...f, original_amount: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="liability-balance">Current Balance</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="liability-balance"
                    type="number"
                    step="0.01"
                    placeholder="18500"
                    className="pl-7"
                    value={liabilityForm.current_balance}
                    onChange={(e) => setLiabilityForm((f) => ({ ...f, current_balance: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="liability-rate">Interest Rate % (optional)</Label>
                <Input
                  id="liability-rate"
                  type="number"
                  step="0.01"
                  placeholder="5.9"
                  value={liabilityForm.interest_rate}
                  onChange={(e) => setLiabilityForm((f) => ({ ...f, interest_rate: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="liability-payment">Monthly Payment (optional)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="liability-payment"
                    type="number"
                    step="0.01"
                    placeholder="450"
                    className="pl-7"
                    value={liabilityForm.monthly_payment}
                    onChange={(e) => setLiabilityForm((f) => ({ ...f, monthly_payment: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="liability-exclude"
                checked={liabilityForm.exclude_from_net_worth}
                onChange={(e) => setLiabilityForm((f) => ({ ...f, exclude_from_net_worth: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="liability-exclude" className="text-sm font-normal cursor-pointer">
                Exclude from net worth (e.g., car loan offset by vehicle value)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLiabilityDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveLiability}
              disabled={!liabilityForm.name || !liabilityForm.original_amount || !liabilityForm.current_balance}
            >
              {editingLiability ? 'Save Changes' : 'Add Debt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
