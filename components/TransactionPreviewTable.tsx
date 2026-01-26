'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  ArrowsUpDownIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Checkbox } from '@/components/ui/checkbox';

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

export interface PreviewTransaction {
  date: string;
  description: string;
  amount: number;
  category?: string | null;
  merchant?: string | null;
  isTransfer?: boolean;
  rawData?: string;
  originalCategory?: string | null; // AI's initial suggestion, used to detect user corrections
  isDuplicate?: boolean; // Whether this transaction matches an existing one
  includeDuplicate?: boolean; // User override to include a duplicate anyway
}

interface TransactionPreviewTableProps {
  transactions: PreviewTransaction[];
  onTransactionsChange: (transactions: PreviewTransaction[]) => void;
}

type SortField = 'date' | 'description' | 'amount' | 'category';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 25;

export function TransactionPreviewTable({
  transactions,
  onTransactionsChange,
}: TransactionPreviewTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Filter and sort transactions
  const filteredAndSorted = useMemo(() => {
    let result = [...transactions];

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (tx) =>
          tx.description.toLowerCase().includes(searchLower) ||
          tx.category?.toLowerCase().includes(searchLower) ||
          tx.merchant?.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'description':
          comparison = a.description.localeCompare(b.description);
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [transactions, search, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSorted.length / PAGE_SIZE);
  const paginatedTransactions = filteredAndSorted.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleCategoryChange = (index: number, category: string) => {
    // Find the actual index in the original transactions array
    const transaction = paginatedTransactions[index];
    const originalIndex = transactions.findIndex(
      (tx) =>
        tx.date === transaction.date &&
        tx.description === transaction.description &&
        tx.amount === transaction.amount
    );

    if (originalIndex !== -1) {
      const updated = [...transactions];
      updated[originalIndex] = {
        ...updated[originalIndex],
        category,
      };
      onTransactionsChange(updated);
    }
  };

  const handleToggleDuplicate = (index: number) => {
    const transaction = paginatedTransactions[index];
    const originalIndex = transactions.findIndex(
      (tx) =>
        tx.date === transaction.date &&
        tx.description === transaction.description &&
        tx.amount === transaction.amount
    );

    if (originalIndex !== -1) {
      const updated = [...transactions];
      updated[originalIndex] = {
        ...updated[originalIndex],
        includeDuplicate: !updated[originalIndex].includeDuplicate,
      };
      onTransactionsChange(updated);
    }
  };

  // Count duplicates
  const duplicateCount = transactions.filter(tx => tx.isDuplicate).length;
  const includedDuplicateCount = transactions.filter(tx => tx.isDuplicate && tx.includeDuplicate).length;

  // Category summary
  const categorySummary = useMemo(() => {
    const summary: Record<string, { count: number; total: number }> = {};
    transactions.forEach((tx) => {
      const cat = tx.category || 'Uncategorized';
      if (!summary[cat]) {
        summary[cat] = { count: 0, total: 0 };
      }
      summary[cat].count++;
      summary[cat].total += tx.amount;
    });
    return Object.entries(summary)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6);
  }, [transactions]);

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      <ArrowsUpDownIcon className={cn(
        "h-3 w-3",
        sortField === field ? "text-foreground" : "text-muted-foreground/50"
      )} />
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Category Summary */}
      <div className="flex flex-wrap gap-2">
        {categorySummary.map(([category, { count, total }]) => (
          <Badge
            key={category}
            variant="outline"
            className={cn(
              "text-xs",
              category === 'Uncategorized' && "border-amber-500 text-amber-600"
            )}
          >
            {category}: {count} ({formatCurrency(Math.abs(total))})
          </Badge>
        ))}
        {duplicateCount > 0 && (
          <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">
            <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
            {duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''} detected
            {includedDuplicateCount > 0 && ` (${includedDuplicateCount} included)`}
          </Badge>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                {duplicateCount > 0 && (
                  <TableHead className="w-[50px]">Include</TableHead>
                )}
                <TableHead className="w-[100px]">
                  <SortButton field="date">Date</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton field="description">Description</SortButton>
                </TableHead>
                <TableHead className="w-[120px] text-right">
                  <SortButton field="amount">Amount</SortButton>
                </TableHead>
                <TableHead className="w-[180px]">
                  <SortButton field="category">Category</SortButton>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTransactions.map((tx, index) => {
                const isDupe = tx.isDuplicate && !tx.includeDuplicate;
                return (
                  <TableRow
                    key={`${tx.date}-${tx.description}-${tx.amount}-${index}`}
                    className={cn(
                      tx.isTransfer && "opacity-50",
                      !tx.category && !tx.isDuplicate && "bg-amber-50/50 dark:bg-amber-950/20",
                      isDupe && "bg-orange-50/50 dark:bg-orange-950/20 opacity-60"
                    )}
                  >
                    {duplicateCount > 0 && (
                      <TableCell>
                        {tx.isDuplicate ? (
                          <Checkbox
                            checked={tx.includeDuplicate || false}
                            onCheckedChange={() => handleToggleDuplicate(index)}
                            className="border-orange-500"
                          />
                        ) : (
                          <Checkbox checked disabled className="opacity-30" />
                        )}
                      </TableCell>
                    )}
                    <TableCell className={cn("whitespace-nowrap text-sm", isDupe && "line-through")}>
                      {formatDate(tx.date)}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[300px]">
                        <div className={cn("truncate text-sm font-medium", isDupe && "line-through")}>
                          {tx.merchant || tx.description}
                        </div>
                        {tx.merchant && tx.merchant !== tx.description && (
                          <div className="truncate text-xs text-muted-foreground">
                            {tx.description}
                          </div>
                        )}
                        {tx.isDuplicate && (
                          <div className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1 mt-0.5">
                            <ExclamationTriangleIcon className="h-3 w-3" />
                            Possible duplicate
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right whitespace-nowrap font-medium text-sm',
                        tx.amount < 0 ? 'text-red-600 dark:text-red-500' : 'text-emerald-600 dark:text-emerald-500',
                        isDupe && "line-through"
                      )}
                    >
                      {formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={tx.category || ''}
                        onValueChange={(value) => handleCategoryChange(index, value)}
                        disabled={isDupe}
                      >
                        <SelectTrigger className={cn(
                          "h-8 text-xs",
                          !tx.category && "border-amber-500",
                          isDupe && "opacity-50"
                        )}>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat} className="text-sm">
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}-
            {Math.min(currentPage * PAGE_SIZE, filteredAndSorted.length)} of{' '}
            {filteredAndSorted.length} transactions
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
