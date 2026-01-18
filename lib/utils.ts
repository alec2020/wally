import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMonth(month: string): string {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function getMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    'Income': '#22c55e',
    'Housing': '#3b82f6',
    'Transportation': '#f59e0b',
    'Groceries': '#84cc16', // lime-500
    'Food': '#ef4444',
    'Shopping': '#8b5cf6',
    'Entertainment': '#ec4899',
    'Health': '#14b8a6',
    'Travel': '#06b6d4',
    'Financial': '#64748b',
    'Subscriptions': '#f97316',
    'Investing': '#10b981',
    'Other': '#94a3b8',
  };
  return colors[category] || '#94a3b8';
}
