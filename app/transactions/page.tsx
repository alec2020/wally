'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { TransactionTable } from '@/components/TransactionTable';
import { useScreenshotMode } from '@/lib/screenshot-mode';
import { generateFakeTransactions, generateFakeAccounts } from '@/lib/fake-data';

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  subcategory: string | null;
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

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const { isScreenshotMode } = useScreenshotMode();
  const searchParams = useSearchParams();

  // Parse URL search params for initial filters
  const initialFilters = useMemo(() => {
    const category = searchParams.get('category');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const categoryFilters = category ? [category] : undefined;

    let dateRange: { from: Date; to: Date } | undefined;
    if (startDate && endDate) {
      // Parse dates safely without timezone issues
      const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
      const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
      dateRange = {
        from: new Date(startYear, startMonth - 1, startDay),
        to: new Date(endYear, endMonth - 1, endDay),
      };
    }

    return { categoryFilters, dateRange };
  }, [searchParams]);

  const fetchTransactions = useCallback(async () => {
    if (isScreenshotMode) {
      setTransactions(generateFakeTransactions() as Transaction[]);
      setIsLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/transactions');
      const data = await response.json();
      setTransactions(data.transactions);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isScreenshotMode]);

  const fetchAccounts = useCallback(async () => {
    if (isScreenshotMode) {
      setAccounts(generateFakeAccounts() as Account[]);
      return;
    }
    try {
      const response = await fetch('/api/accounts');
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  }, [isScreenshotMode]);

  useEffect(() => {
    fetchTransactions();
    fetchAccounts();
  }, [fetchTransactions, fetchAccounts]);

  const handleUpdate = async (id: number, updates: Partial<Transaction>) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });

      if (response.ok) {
        // If account_id changed, refetch to get new account_name
        if ('account_id' in updates) {
          await fetchTransactions();
        } else {
          setTransactions((prev) =>
            prev.map((tx) => (tx.id === id ? { ...tx, ...updates } : tx))
          );
        }
      }
    } catch (error) {
      console.error('Failed to update transaction:', error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/transactions?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTransactions((prev) => prev.filter((tx) => tx.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    }
  };

  const handleRecategorize = async () => {
    setIsCategorizing(true);
    try {
      await fetch('/api/categorize', {
        method: 'PUT',
      });
      await fetchTransactions();
    } catch (error) {
      console.error('Failed to recategorize:', error);
    } finally {
      setIsCategorizing(false);
    }
  };

  const handleBulkUpdate = async (ids: number[], updates: Partial<Transaction>) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, ...updates }),
      });

      if (response.ok) {
        // If account_id changed, refetch to get new account_names
        if ('account_id' in updates) {
          await fetchTransactions();
        } else {
          setTransactions((prev) =>
            prev.map((tx) => (ids.includes(tx.id) ? { ...tx, ...updates } : tx))
          );
        }
      }
    } catch (error) {
      console.error('Failed to bulk update transactions:', error);
    }
  };

  const handleBulkDelete = async (ids: number[]) => {
    try {
      const response = await fetch(`/api/transactions?ids=${ids.join(',')}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTransactions((prev) => prev.filter((tx) => !ids.includes(tx.id)));
      }
    } catch (error) {
      console.error('Failed to bulk delete transactions:', error);
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

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Transactions</h1>
        <p className="text-muted-foreground mt-1">
          View and manage all your transactions
        </p>
      </div>

      <TransactionTable
        transactions={transactions}
        accounts={accounts}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onBulkUpdate={handleBulkUpdate}
        onBulkDelete={handleBulkDelete}
        onRecategorize={handleRecategorize}
        isLoading={isCategorizing}
        initialCategoryFilters={initialFilters.categoryFilters}
        initialDateRange={initialFilters.dateRange}
      />
    </div>
  );
}
