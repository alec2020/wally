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
  // For date strings like "2024-01-15", parse as local date to avoid timezone shift
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
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
  const monthStr = date.toLocaleDateString('en-US', { month: 'short' });
  const yearStr = year.slice(-2);
  return `${monthStr} '${yearStr}`;
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

// Dynamic color lookup that checks categories array first, then falls back to hardcoded colors
export function getCategoryColorFromList(
  category: string,
  categories: { name: string; color: string | null }[]
): string {
  const found = categories.find(c => c.name === category);
  if (found?.color) {
    return found.color;
  }
  return getCategoryColor(category);
}

// Asset type helpers
export type AssetType = 'vehicle' | 'jewelry' | 'real_estate' | 'collectible' | 'other';

export function getAssetTypeColor(type: AssetType): string {
  const colors: Record<AssetType, string> = {
    vehicle: '#3b82f6',      // blue
    jewelry: '#f59e0b',      // amber
    real_estate: '#22c55e',  // green
    collectible: '#8b5cf6',  // violet
    other: '#64748b',        // slate
  };
  return colors[type] || '#64748b';
}

export function getAssetTypeLabel(type: AssetType): string {
  const labels: Record<AssetType, string> = {
    vehicle: 'Vehicle',
    jewelry: 'Jewelry',
    real_estate: 'Real Estate',
    collectible: 'Collectible',
    other: 'Other',
  };
  return labels[type] || 'Other';
}

export function getAssetTypeIcon(type: AssetType): string {
  const icons: Record<AssetType, string> = {
    vehicle: 'car',
    jewelry: 'watch',
    real_estate: 'home',
    collectible: 'star',
    other: 'box',
  };
  return icons[type] || 'box';
}

// Liability type helpers
export type LiabilityType = 'auto_loan' | 'mortgage' | 'personal_loan' | 'student_loan' | 'other';

export function getLiabilityTypeColor(type: LiabilityType): string {
  const colors: Record<LiabilityType, string> = {
    auto_loan: '#ef4444',     // red
    mortgage: '#f97316',      // orange
    personal_loan: '#eab308', // yellow
    student_loan: '#ec4899',  // pink
    other: '#64748b',         // slate
  };
  return colors[type] || '#64748b';
}

export function getLiabilityTypeLabel(type: LiabilityType): string {
  const labels: Record<LiabilityType, string> = {
    auto_loan: 'Auto Loan',
    mortgage: 'Mortgage',
    personal_loan: 'Personal Loan',
    student_loan: 'Student Loan',
    other: 'Other',
  };
  return labels[type] || 'Other';
}

// Calculate payoff progress percentage
export function calculatePayoffProgress(originalAmount: number, currentBalance: number): number {
  if (originalAmount <= 0) return 0;
  const progress = ((originalAmount - currentBalance) / originalAmount) * 100;
  return Math.max(0, Math.min(100, Math.round(progress * 10) / 10));
}

// Calculate months to payoff (simple calculation without interest)
export function calculateMonthsToPayoff(
  currentBalance: number,
  monthlyPayment: number | null,
  interestRate?: number | null
): number | null {
  if (!monthlyPayment || monthlyPayment <= 0 || currentBalance <= 0) return null;

  // Simple calculation without interest
  if (!interestRate || interestRate <= 0) {
    return Math.ceil(currentBalance / monthlyPayment);
  }

  // With interest (monthly rate)
  const monthlyRate = interestRate / 100 / 12;

  // If payment is less than monthly interest, loan will never be paid off
  const monthlyInterest = currentBalance * monthlyRate;
  if (monthlyPayment <= monthlyInterest) return null;

  // Formula: n = -log(1 - (r * P / M)) / log(1 + r)
  // where n = months, r = monthly rate, P = principal, M = monthly payment
  const months = -Math.log(1 - (monthlyRate * currentBalance / monthlyPayment)) / Math.log(1 + monthlyRate);

  return Math.ceil(months);
}

// Calculate asset value change percentage
export function calculateAssetChange(currentValue: number, purchasePrice: number | null): number | null {
  if (!purchasePrice || purchasePrice <= 0) return null;
  const change = ((currentValue - purchasePrice) / purchasePrice) * 100;
  return Math.round(change * 10) / 10;
}
