'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn, formatCurrency, formatDate, getCategoryColor, getCategoryColorFromList } from '@/lib/utils';
import {
  EllipsisHorizontalIcon,
  MagnifyingGlassIcon,
  ArrowsUpDownIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  XMarkIcon,
  DocumentIcon,
  TrashIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { Checkbox } from '@/components/ui/checkbox';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, parseISO } from 'date-fns';

// Separate component for note editing to prevent re-renders of the main table
function NoteEditDialog({
  transaction,
  onSave,
  onClose,
}: {
  transaction: { id: number; notes: string | null } | null;
  onSave: (id: number, notes: string | null) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(transaction?.notes || '');

  // Reset value when transaction changes
  useEffect(() => {
    setValue(transaction?.notes || '');
  }, [transaction]);

  if (!transaction) return null;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{transaction.notes ? 'Edit Note' : 'Add Note'}</DialogTitle>
        </DialogHeader>
        <Textarea
          placeholder="Add a note about this transaction..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          className="resize-y"
          autoFocus
        />
        <DialogFooter className="gap-2 sm:gap-0">
          {value && (
            <Button
              variant="outline"
              onClick={() => {
                onSave(transaction.id, null);
                onClose();
              }}
              className="text-red-600 hover:text-red-700"
            >
              Remove Note
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(transaction.id, value || null);
              onClose();
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  merchant: string | null;
  is_transfer: boolean;
  subscription_frequency: 'monthly' | 'annual' | null;
  account_id: number | null;
  account_name: string | null;
  notes: string | null;
}

interface Account {
  id: number;
  name: string;
}

interface CategoryInfo {
  name: string;
  color: string | null;
}

interface TransactionTableProps {
  transactions: Transaction[];
  accounts: Account[];
  categories?: CategoryInfo[];
  onUpdate: (id: number, updates: Partial<Transaction>) => void;
  onDelete: (id: number) => void;
  onBulkUpdate?: (ids: number[], updates: Partial<Transaction>) => Promise<void>;
  onBulkDelete?: (ids: number[]) => Promise<void>;
  onRecategorize: () => void;
  isLoading?: boolean;
  initialCategoryFilters?: string[];
  initialDateRange?: { from: Date; to: Date };
  initialSearch?: string;
}

const CATEGORIES = [
  'Income',
  'Housing',
  'Transportation',
  'Groceries',
  'Food',
  'Shopping',
  'Entertainment',
  'Health',
  'Travel',
  'Financial',
  'Subscriptions',
  'Investing',
  'Other',
];

type TransactionType = 'all' | 'income' | 'expenses';
type DatePreset = 'all' | 'this-month' | 'last-month' | 'last-3-months' | 'this-year' | 'custom';

export function TransactionTable({
  transactions,
  accounts,
  categories: categoriesProp = [],
  onUpdate,
  onDelete,
  onBulkUpdate,
  onBulkDelete,
  onRecategorize,
  isLoading,
  initialCategoryFilters,
  initialDateRange,
  initialSearch,
}: TransactionTableProps) {
  const getColor = (category: string) =>
    categoriesProp.length > 0
      ? getCategoryColorFromList(category, categoriesProp)
      : getCategoryColor(category);

  const [search, setSearch] = useState(initialSearch || '');
  const [categoryFilters, setCategoryFilters] = useState<string[]>(initialCategoryFilters || []);
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [transactionType, setTransactionType] = useState<TransactionType>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>(initialDateRange ? 'custom' : 'all');
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: initialDateRange?.from,
    to: initialDateRange?.to,
  });
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Note editing state
  const [editingTransaction, setEditingTransaction] = useState<{ id: number; notes: string | null } | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Calculate date range based on preset
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (datePreset) {
      case 'this-month':
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
        };
      case 'last-month':
        const lastMonth = subMonths(now, 1);
        return {
          startDate: startOfMonth(lastMonth),
          endDate: endOfMonth(lastMonth),
        };
      case 'last-3-months':
        return {
          startDate: startOfMonth(subMonths(now, 2)),
          endDate: endOfMonth(now),
        };
      case 'this-year':
        return {
          startDate: startOfYear(now),
          endDate: now,
        };
      case 'custom':
        if (customDateRange.from && customDateRange.to) {
          return {
            startDate: customDateRange.from,
            endDate: customDateRange.to,
          };
        }
        return { startDate: undefined, endDate: undefined };
      case 'all':
      default:
        return { startDate: undefined, endDate: undefined };
    }
  }, [datePreset, customDateRange]);

  const filteredTransactions = transactions
    .filter((tx) => {
      const matchesSearch =
        search === '' ||
        tx.description.toLowerCase().includes(search.toLowerCase()) ||
        tx.merchant?.toLowerCase().includes(search.toLowerCase()) ||
        tx.notes?.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        categoryFilters.length === 0 ||
        (categoryFilters.includes('uncategorized') && !tx.category) ||
        (tx.category && categoryFilters.includes(tx.category));

      const matchesAccount =
        accountFilter === 'all' ||
        tx.account_id?.toString() === accountFilter;

      const matchesType =
        transactionType === 'all' ||
        (transactionType === 'income' && tx.category === 'Income') ||
        (transactionType === 'expenses' && tx.amount < 0);

      const txDate = parseISO(tx.date);
      const matchesDateRange =
        !dateRange.startDate ||
        !dateRange.endDate ||
        (txDate >= dateRange.startDate && txDate <= dateRange.endDate);

      return matchesSearch && matchesCategory && matchesAccount && matchesType && matchesDateRange;
    })
    .sort((a, b) => {
      const aVal = sortBy === 'date' ? new Date(a.date).getTime() : a.amount;
      const bVal = sortBy === 'date' ? new Date(b.date).getTime() : b.amount;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

  const totalPages = Math.ceil(filteredTransactions.length / pageSize);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const toggleCategoryFilter = (category: string) => {
    setCategoryFilters(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
    setCurrentPage(1);
  };

  const handleAccountFilterChange = (value: string) => {
    setAccountFilter(value);
    setCurrentPage(1);
  };

  const toggleSort = (field: 'date' | 'amount') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleTransactionTypeChange = (value: TransactionType) => {
    setTransactionType(value);
    setCurrentPage(1);
  };

  const handleDatePresetChange = (value: DatePreset) => {
    setDatePreset(value);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setCategoryFilters([]);
    setAccountFilter('all');
    setTransactionType('all');
    setDatePreset('all');
    setCustomDateRange({ from: undefined, to: undefined });
    setCurrentPage(1);
  };

  const uncategorizedCount = transactions.filter((tx) => !tx.category).length;

  // Count active filters
  const activeFilterCount = [
    categoryFilters.length > 0,
    accountFilter !== 'all',
    transactionType !== 'all',
    datePreset !== 'all',
  ].filter(Boolean).length;

  // Calculate summary stats for filtered results
  // Income: Only positive amounts categorized as 'Income'
  // Expenses: All negative amounts + positive amounts in non-Income categories (credits/refunds offset)
  const filterStats = useMemo(() => {
    if (activeFilterCount === 0) return null;
    const expenseSum = filteredTransactions
      .filter(tx => !tx.is_transfer && tx.category !== 'Investing' && (
        tx.amount < 0 ||
        (tx.amount > 0 && tx.category && tx.category !== 'Income')
      ))
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpenses = Math.abs(expenseSum);
    const totalIncome = filteredTransactions
      .filter(tx => tx.amount > 0 && !tx.is_transfer && tx.category === 'Income')
      .reduce((sum, tx) => sum + tx.amount, 0);
    return {
      count: filteredTransactions.length,
      totalExpenses,
      totalIncome,
    };
  }, [filteredTransactions, activeFilterCount]);

  // Selection helpers
  const filteredIds = useMemo(() => new Set(filteredTransactions.map(tx => tx.id)), [filteredTransactions]);
  const selectedCount = selectedIds.size;
  const allFilteredSelected = filteredTransactions.length > 0 &&
    filteredTransactions.every(tx => selectedIds.has(tx.id));
  const someFilteredSelected = filteredTransactions.some(tx => selectedIds.has(tx.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect all filtered
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredTransactions.forEach(tx => next.delete(tx.id));
        return next;
      });
    } else {
      // Select all filtered
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredTransactions.forEach(tx => next.add(tx.id));
        return next;
      });
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkCategoryChange = async (category: string | null) => {
    if (!onBulkUpdate || selectedIds.size === 0) return;
    await onBulkUpdate(Array.from(selectedIds), { category });
    clearSelection();
  };

  const handleBulkTransferToggle = async (isTransfer: boolean) => {
    if (!onBulkUpdate || selectedIds.size === 0) return;
    await onBulkUpdate(Array.from(selectedIds), { is_transfer: isTransfer });
    clearSelection();
  };

  const handleBulkAccountChange = async (accountId: number) => {
    if (!onBulkUpdate || selectedIds.size === 0) return;
    await onBulkUpdate(Array.from(selectedIds), { account_id: accountId } as Partial<Transaction>);
    clearSelection();
  };

  const handleBulkDeleteConfirm = async () => {
    if (!onBulkDelete || selectedIds.size === 0) return;
    await onBulkDelete(Array.from(selectedIds));
    clearSelection();
    setShowDeleteConfirm(false);
  };

  // Keyboard shortcut for escape to clear selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0) {
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds.size]);

  // Get display label for date preset
  const getDatePresetLabel = () => {
    switch (datePreset) {
      case 'this-month':
        return 'This Month';
      case 'last-month':
        return 'Last Month';
      case 'last-3-months':
        return 'Last 3 Months';
      case 'this-year':
        return 'This Year';
      case 'custom':
        if (customDateRange.from && customDateRange.to) {
          return `${format(customDateRange.from, 'MMM d')} - ${format(customDateRange.to, 'MMM d')}`;
        }
        return 'Custom';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <FunnelIcon className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4 max-h-[85vh] overflow-y-auto" align="end">
            <div className="space-y-4">
              {/* Transaction Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Transaction Type</label>
                <div className="flex gap-2">
                  {(['all', 'income', 'expenses'] as TransactionType[]).map((type) => (
                    <Button
                      key={type}
                      variant={transactionType === type ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        'flex-1',
                        transactionType === type && 'bg-foreground text-background hover:bg-foreground/90'
                      )}
                      onClick={() => handleTransactionTypeChange(type)}
                    >
                      {type === 'all' ? 'All' : type === 'income' ? 'Income' : 'Expenses'}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Category - Multi-select */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Categories</label>
                  {categoryFilters.length > 0 && (
                    <button
                      onClick={() => setCategoryFilters([])}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto">
                  <button
                    onClick={() => toggleCategoryFilter('uncategorized')}
                    className={cn(
                      'px-2 py-1 text-xs rounded-full border transition-colors',
                      categoryFilters.includes('uncategorized')
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-card text-muted-foreground border-border hover:border-foreground/30'
                    )}
                  >
                    Uncategorized ({uncategorizedCount})
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => toggleCategoryFilter(cat)}
                      className={cn(
                        'px-2 py-1 text-xs rounded-full border transition-colors',
                        categoryFilters.includes(cat)
                          ? 'bg-foreground text-background border-foreground'
                          : 'bg-card text-muted-foreground border-border hover:border-foreground/30'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Account */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Account</label>
                <Select value={accountFilter} onValueChange={handleAccountFilterChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.name.replace(' Account', '')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={datePreset === 'this-month' ? 'default' : 'outline'}
                    size="sm"
                    className={datePreset === 'this-month' ? 'bg-foreground text-background hover:bg-foreground/90' : ''}
                    onClick={() => handleDatePresetChange('this-month')}
                  >
                    This Month
                  </Button>
                  <Button
                    variant={datePreset === 'last-month' ? 'default' : 'outline'}
                    size="sm"
                    className={datePreset === 'last-month' ? 'bg-foreground text-background hover:bg-foreground/90' : ''}
                    onClick={() => handleDatePresetChange('last-month')}
                  >
                    Last Month
                  </Button>
                  <Button
                    variant={datePreset === 'last-3-months' ? 'default' : 'outline'}
                    size="sm"
                    className={datePreset === 'last-3-months' ? 'bg-foreground text-background hover:bg-foreground/90' : ''}
                    onClick={() => handleDatePresetChange('last-3-months')}
                  >
                    Last 3 Months
                  </Button>
                  <Button
                    variant={datePreset === 'this-year' ? 'default' : 'outline'}
                    size="sm"
                    className={datePreset === 'this-year' ? 'bg-foreground text-background hover:bg-foreground/90' : ''}
                    onClick={() => handleDatePresetChange('this-year')}
                  >
                    This Year
                  </Button>
                  <Button
                    variant={datePreset === 'all' ? 'default' : 'outline'}
                    size="sm"
                    className={cn('col-span-2', datePreset === 'all' ? 'bg-foreground text-background hover:bg-foreground/90' : '')}
                    onClick={() => handleDatePresetChange('all')}
                  >
                    All Time
                  </Button>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Or select custom range:</p>
                  <Calendar
                    mode="range"
                    selected={{ from: customDateRange.from, to: customDateRange.to }}
                    onSelect={(range) => {
                      setCustomDateRange({ from: range?.from, to: range?.to });
                      // Only apply filter when both dates are selected AND they're different
                      // (meaning user has completed selecting a range, not just clicked once)
                      if (range?.from && range?.to && range.from.getTime() !== range.to.getTime()) {
                        setDatePreset('custom');
                        setCurrentPage(1);
                      }
                    }}
                    numberOfMonths={1}
                    className="rounded-md border"
                  />
                  {/* Apply button for when user wants to filter by a single day */}
                  {customDateRange.from && (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {customDateRange.from && customDateRange.to && customDateRange.from.getTime() === customDateRange.to.getTime()
                          ? format(customDateRange.from, 'MMM d, yyyy')
                          : customDateRange.from && !customDateRange.to
                          ? `${format(customDateRange.from, 'MMM d')} - select end date`
                          : customDateRange.from && customDateRange.to
                          ? `${format(customDateRange.from, 'MMM d')} - ${format(customDateRange.to, 'MMM d')}`
                          : ''}
                      </span>
                      {customDateRange.from && customDateRange.to && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setDatePreset('custom');
                            setCurrentPage(1);
                          }}
                          className="h-7 text-xs"
                        >
                          Apply
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {uncategorizedCount > 0 && (
          <Button
            variant="outline"
            onClick={onRecategorize}
            disabled={isLoading}
          >
            <ArrowPathIcon className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
            Categorize All
          </Button>
        )}
      </div>

      {/* Active Filter Chips + Summary Stats */}
      {activeFilterCount > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {categoryFilters.map((cat) => (
              <span
                key={cat}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  cat === 'uncategorized' ? 'bg-muted text-muted-foreground' : 'text-white'
                )}
                style={cat !== 'uncategorized' ? { backgroundColor: getColor(cat) } : undefined}
              >
                {cat === 'uncategorized' ? 'Uncategorized' : cat}
                <button
                  onClick={() => toggleCategoryFilter(cat)}
                  className="ml-0.5 hover:bg-white/20 rounded-full p-0.5"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
            {accountFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {accounts.find(a => a.id.toString() === accountFilter)?.name.replace(' Account', '') || 'Account'}
                <button
                  onClick={() => setAccountFilter('all')}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {transactionType !== 'all' && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {transactionType === 'income' ? 'Income' : 'Expenses'}
                <button
                  onClick={() => setTransactionType('all')}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {datePreset !== 'all' && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {getDatePresetLabel()}
                <button
                  onClick={() => {
                    setDatePreset('all');
                    setCustomDateRange({ from: undefined, to: undefined });
                  }}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {(activeFilterCount >= 2 || categoryFilters.length >= 2) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-muted-foreground hover:text-foreground h-6 px-2"
              >
                Clear all
              </Button>
            )}
          </div>

          {/* Summary Stats */}
          {filterStats && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                <span className="font-medium">{filterStats.count}</span> transactions
              </span>
              {filterStats.totalExpenses > 0 && (
                <span className="text-red-600 dark:text-red-500">
                  <span className="font-medium">{formatCurrency(filterStats.totalExpenses)}</span> spent
                </span>
              )}
              {filterStats.totalIncome > 0 && (
                <span className="text-emerald-600 dark:text-emerald-500">
                  <span className="font-medium">{formatCurrency(filterStats.totalIncome)}</span> income
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {onBulkUpdate && onBulkDelete && (
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                    className={cn(
                      someFilteredSelected && !allFilteredSelected && 'data-[state=checked]:bg-muted'
                    )}
                    {...(someFilteredSelected && !allFilteredSelected ? { 'data-state': 'indeterminate' } : {})}
                  />
                </TableHead>
              )}
              <TableHead
                className="cursor-pointer hover:bg-muted"
                onClick={() => toggleSort('date')}
              >
                <div className="flex items-center gap-1">
                  Date
                  <ArrowsUpDownIcon className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Category</TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted"
                onClick={() => toggleSort('amount')}
              >
                <div className="flex items-center justify-end gap-1">
                  Amount
                  <ArrowsUpDownIcon className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={onBulkUpdate && onBulkDelete ? 7 : 6} className="text-center py-8 text-muted-foreground">
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              paginatedTransactions.map((tx) => (
                <TableRow key={tx.id} className={cn(tx.is_transfer && 'opacity-50', selectedIds.has(tx.id) && 'bg-muted/50')}>
                  {onBulkUpdate && onBulkDelete && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(tx.id)}
                        onCheckedChange={() => toggleSelect(tx.id)}
                        aria-label={`Select transaction ${tx.id}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="whitespace-nowrap">
                    {formatDate(tx.date)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate max-w-[300px]">
                          {tx.merchant || tx.description}
                        </div>
                        {tx.merchant && tx.merchant !== tx.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                            {tx.description}
                          </div>
                        )}
                      </div>
                      {tx.notes && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="flex-shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                              <DocumentIcon className="h-4 w-4" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3" align="start">
                            <p className="text-sm whitespace-pre-wrap">{tx.notes}</p>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {tx.account_name ? (
                      <Badge variant="secondary" className="font-normal">
                        {tx.account_name.replace(' Account', '')}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className={cn(
                            'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                            'hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400',
                            tx.category ? 'text-white' : 'bg-muted text-muted-foreground'
                          )}
                          style={tx.category ? {
                            backgroundColor: getColor(tx.category),
                          } : undefined}
                        >
                          {tx.category || 'Uncategorized'}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-3" align="start">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => onUpdate(tx.id, { category: null })}
                            className={cn(
                              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                              'hover:bg-muted',
                              !tx.category ? 'bg-muted text-foreground' : 'bg-muted/50 text-muted-foreground'
                            )}
                          >
                            Uncategorized
                          </button>
                          {CATEGORIES.map((cat) => (
                            <button
                              key={cat}
                              onClick={() => onUpdate(tx.id, { category: cat })}
                              className={cn(
                                'rounded-full px-3 py-1.5 text-xs font-medium text-white transition-colors',
                                'hover:opacity-80',
                                tx.category === cat && 'ring-2 ring-offset-2 ring-gray-400'
                              )}
                              style={{ backgroundColor: getColor(cat) }}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right whitespace-nowrap font-medium',
                      tx.amount < 0 ? 'text-red-600 dark:text-red-500' : 'text-emerald-600 dark:text-emerald-500'
                    )}
                  >
                    {formatCurrency(tx.amount)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <EllipsisHorizontalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setEditingTransaction({ id: tx.id, notes: tx.notes })}
                        >
                          {tx.notes ? 'Edit Note' : 'Add Note'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            onUpdate(tx.id, { is_transfer: !tx.is_transfer })
                          }
                        >
                          {tx.is_transfer ? 'Unmark as Transfer' : 'Mark as Transfer'}
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>Change Account</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {accounts.map((account) => (
                              <DropdownMenuItem
                                key={account.id}
                                onClick={() =>
                                  onUpdate(tx.id, { account_id: account.id } as Partial<Transaction>)
                                }
                                className={tx.account_id === account.id ? 'bg-muted' : ''}
                              >
                                {account.name.replace(' Account', '')}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        {tx.category === 'Subscriptions' && (
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              Billing Cycle
                              {tx.subscription_frequency && (
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {tx.subscription_frequency === 'monthly' ? 'Monthly' : 'Annual'}
                                </span>
                              )}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem
                                onClick={() =>
                                  onUpdate(tx.id, { subscription_frequency: 'monthly' })
                                }
                                className={tx.subscription_frequency === 'monthly' ? 'bg-muted' : ''}
                              >
                                Monthly
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  onUpdate(tx.id, { subscription_frequency: 'annual' })
                                }
                                className={tx.subscription_frequency === 'annual' ? 'bg-muted' : ''}
                              >
                                Annual
                              </DropdownMenuItem>
                              {tx.subscription_frequency && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() =>
                                      onUpdate(tx.id, { subscription_frequency: null })
                                    }
                                  >
                                    Clear
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(tx.id)}
                          className="text-red-600"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedCount > 0 && onBulkUpdate && onBulkDelete && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-xl shadow-black/25">
            <CheckIcon className="h-4 w-4" />
            <span className="font-medium">{selectedCount} selected</span>
            <div className="w-px h-6 bg-white/20 mx-1" />

            {/* Category Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/20">
                  Category
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuItem onClick={() => handleBulkCategoryChange(null)}>
                  Uncategorized
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {CATEGORIES.map((cat) => (
                  <DropdownMenuItem key={cat} onClick={() => handleBulkCategoryChange(cat)}>
                    <span
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: getColor(cat) }}
                    />
                    {cat}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Transfer Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/20">
                  Transfer
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuItem onClick={() => handleBulkTransferToggle(true)}>
                  Mark as Transfer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkTransferToggle(false)}>
                  Unmark as Transfer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Account Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/20">
                  Account
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {accounts.map((account) => (
                  <DropdownMenuItem key={account.id} onClick={() => handleBulkAccountChange(account.id)}>
                    {account.name.replace(' Account', '')}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Delete Button */}
            <Button
              variant="ghost"
              size="sm"
              className="text-red-200 hover:text-red-100 hover:bg-red-500/30"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-white/20 mx-1" />

            {/* Clear Selection */}
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:text-white hover:bg-white/20"
              onClick={clearSelection}
            >
              <XMarkIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredTransactions.length)} of {filteredTransactions.length} transactions
          {filteredTransactions.length !== transactions.length && (
            <span> (filtered from {transactions.length})</span>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  if (totalPages <= 7) return true;
                  if (page === 1 || page === totalPages) return true;
                  if (Math.abs(page - currentPage) <= 1) return true;
                  return false;
                })
                .map((page, idx, arr) => {
                  const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                  return (
                    <span key={page} className="flex items-center">
                      {showEllipsis && <span className="px-2 text-muted-foreground">...</span>}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className={cn(
                          "w-8",
                          currentPage === page && "bg-muted border-foreground/20"
                        )}
                      >
                        {page}
                      </Button>
                    </span>
                  );
                })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Note editing dialog */}
      <NoteEditDialog
        transaction={editingTransaction}
        onSave={(id, notes) => onUpdate(id, { notes } as Partial<Transaction>)}
        onClose={() => setEditingTransaction(null)}
      />

      {/* Bulk delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {selectedCount} transactions?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. This will permanently delete the selected transactions.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDeleteConfirm}>
              Delete {selectedCount} transactions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
