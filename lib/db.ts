import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'finance.db');
const SCHEMA_PATH = path.join(process.cwd(), 'schema.sql');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    // Initialize schema if tables don't exist
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'").get();
    if (!tableCheck) {
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
      db.exec(schema);
    }
  }
  return db;
}

// Account operations
export interface Account {
  id: number;
  name: string;
  type: 'bank' | 'credit_card' | 'brokerage';
  institution: string | null;
  created_at: string;
}

export function getAccounts(): Account[] {
  return getDb().prepare('SELECT * FROM accounts ORDER BY name').all() as Account[];
}

export function getAccountById(id: number): Account | undefined {
  return getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account | undefined;
}

export function createAccount(name: string, type: string, institution: string | null): number {
  const result = getDb().prepare(
    'INSERT INTO accounts (name, type, institution) VALUES (?, ?, ?)'
  ).run(name, type, institution);
  return result.lastInsertRowid as number;
}

// Transaction operations
export interface Transaction {
  id: number;
  account_id: number | null;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  subcategory: string | null;
  merchant: string | null;
  is_transfer: boolean;
  notes: string | null;
  raw_data: string | null;
  created_at: string;
  account_name?: string | null;
}

export function getTransactions(filters?: {
  startDate?: string;
  endDate?: string;
  category?: string;
  accountId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}): Transaction[] {
  let query = `
    SELECT t.*, a.name as account_name
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE 1=1`;
  const params: (string | number)[] = [];

  if (filters?.startDate) {
    query += ' AND t.date >= ?';
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    query += ' AND t.date <= ?';
    params.push(filters.endDate);
  }
  if (filters?.category) {
    query += ' AND t.category = ?';
    params.push(filters.category);
  }
  if (filters?.accountId) {
    query += ' AND t.account_id = ?';
    params.push(filters.accountId);
  }
  if (filters?.search) {
    query += ' AND (t.description LIKE ? OR t.merchant LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  query += ' ORDER BY t.date DESC, t.id DESC';

  if (filters?.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
    if (filters?.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }
  }

  return getDb().prepare(query).all(...params) as Transaction[];
}

export function getTransactionById(id: number): Transaction | undefined {
  return getDb().prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Transaction | undefined;
}

export function createTransaction(tx: Omit<Transaction, 'id' | 'created_at'>): number {
  const result = getDb().prepare(`
    INSERT INTO transactions (account_id, date, description, amount, category, subcategory, merchant, is_transfer, notes, raw_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tx.account_id,
    tx.date,
    tx.description,
    tx.amount,
    tx.category,
    tx.subcategory,
    tx.merchant,
    tx.is_transfer ? 1 : 0,
    tx.notes,
    tx.raw_data
  );
  return result.lastInsertRowid as number;
}

export function createTransactionsBatch(transactions: Omit<Transaction, 'id' | 'created_at'>[]): number {
  const insert = getDb().prepare(`
    INSERT INTO transactions (account_id, date, description, amount, category, subcategory, merchant, is_transfer, notes, raw_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = getDb().transaction((txs: Omit<Transaction, 'id' | 'created_at'>[]) => {
    for (const tx of txs) {
      insert.run(
        tx.account_id,
        tx.date,
        tx.description,
        tx.amount,
        tx.category,
        tx.subcategory,
        tx.merchant,
        tx.is_transfer ? 1 : 0,
        tx.notes,
        tx.raw_data
      );
    }
    return txs.length;
  });

  return insertMany(transactions);
}

export function updateTransaction(id: number, updates: Partial<Transaction>): void {
  const fields: string[] = [];
  const params: (string | number | boolean | null)[] = [];

  if (updates.account_id !== undefined) {
    fields.push('account_id = ?');
    params.push(updates.account_id);
  }
  if (updates.category !== undefined) {
    fields.push('category = ?');
    params.push(updates.category);
  }
  if (updates.subcategory !== undefined) {
    fields.push('subcategory = ?');
    params.push(updates.subcategory);
  }
  if (updates.merchant !== undefined) {
    fields.push('merchant = ?');
    params.push(updates.merchant);
  }
  if (updates.is_transfer !== undefined) {
    fields.push('is_transfer = ?');
    params.push(updates.is_transfer ? 1 : 0);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    params.push(updates.notes);
  }

  if (fields.length > 0) {
    params.push(id);
    getDb().prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }
}

export function deleteTransaction(id: number): void {
  getDb().prepare('DELETE FROM transactions WHERE id = ?').run(id);
}

// Check for duplicate transactions
export function isDuplicateTransaction(date: string, amount: number, description: string): boolean {
  const existing = getDb().prepare(`
    SELECT id FROM transactions
    WHERE date = ? AND amount = ? AND description = ?
    LIMIT 1
  `).get(date, amount, description);
  return !!existing;
}

// Monthly snapshot operations
export interface MonthlySnapshot {
  id: number;
  month: string;
  account_id: number;
  balance: number;
  created_at: string;
}

export function getMonthlySnapshots(accountId?: number): MonthlySnapshot[] {
  let query = 'SELECT * FROM monthly_snapshots';
  const params: number[] = [];

  if (accountId) {
    query += ' WHERE account_id = ?';
    params.push(accountId);
  }

  query += ' ORDER BY month DESC';
  return getDb().prepare(query).all(...params) as MonthlySnapshot[];
}

export function createMonthlySnapshot(month: string, accountId: number, balance: number): number {
  const result = getDb().prepare(`
    INSERT INTO monthly_snapshots (month, account_id, balance)
    VALUES (?, ?, ?)
  `).run(month, accountId, balance);
  return result.lastInsertRowid as number;
}

// User preference operations - text-based preferences for AI categorization
export interface UserPreference {
  id: number;
  instruction: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export function getUserPreferences(): UserPreference[] {
  return getDb().prepare(
    'SELECT * FROM user_preferences ORDER BY updated_at DESC'
  ).all() as UserPreference[];
}

export function addUserPreference(instruction: string, source: string = 'user'): number {
  const result = getDb().prepare(`
    INSERT INTO user_preferences (instruction, source)
    VALUES (?, ?)
  `).run(instruction, source);
  return result.lastInsertRowid as number;
}

export function updateUserPreference(id: number, instruction: string): void {
  getDb().prepare(`
    UPDATE user_preferences SET instruction = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(instruction, id);
}

export function deleteUserPreference(id: number): void {
  getDb().prepare('DELETE FROM user_preferences WHERE id = ?').run(id);
}

// Category operations
export interface Category {
  id: number;
  name: string;
  color: string | null;
  icon: string | null;
  parent_id: number | null;
}

export function getCategories(): Category[] {
  return getDb().prepare('SELECT * FROM categories ORDER BY name').all() as Category[];
}

export function createCategory(name: string, color?: string, icon?: string): number {
  const result = getDb().prepare(
    'INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)'
  ).run(name, color || null, icon || null);
  return result.lastInsertRowid as number;
}

export function deleteCategory(id: number): void {
  getDb().prepare('DELETE FROM categories WHERE id = ?').run(id);
}

export function getCategoryById(id: number): Category | undefined {
  return getDb().prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category | undefined;
}

export function getTransactionCountByCategory(categoryName: string): number {
  const result = getDb().prepare(
    'SELECT COUNT(*) as count FROM transactions WHERE category = ?'
  ).get(categoryName) as { count: number };
  return result.count;
}

export function clearCategoryFromTransactions(categoryName: string): number {
  const result = getDb().prepare(
    'UPDATE transactions SET category = NULL, subcategory = NULL WHERE category = ?'
  ).run(categoryName);
  return result.changes;
}

export function getCategoryNames(): string[] {
  const categories = getDb().prepare('SELECT name FROM categories ORDER BY name').all() as { name: string }[];
  return categories.map(c => c.name);
}

// Analytics helpers
export function getSpendingByCategory(startDate?: string, endDate?: string): { category: string; total: number }[] {
  let query = `
    SELECT category, SUM(amount) as total
    FROM transactions
    WHERE amount < 0 AND is_transfer = 0 AND category IS NOT NULL AND category != 'Investing'
  `;
  const params: string[] = [];

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  query += ' GROUP BY category ORDER BY total ASC';
  return getDb().prepare(query).all(...params) as { category: string; total: number }[];
}

export function getMonthlyTotals(startDate?: string, endDate?: string): { month: string; income: number; expenses: number }[] {
  let query = `
    SELECT
      strftime('%Y-%m', date) as month,
      SUM(CASE WHEN amount > 0 AND is_transfer = 0 AND (category IS NULL OR category != 'Financial') THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN amount < 0 AND is_transfer = 0 AND category != 'Investing' THEN amount ELSE 0 END) as expenses
    FROM transactions
    WHERE 1=1
  `;
  const params: string[] = [];

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  query += ' GROUP BY strftime(\'%Y-%m\', date) ORDER BY month DESC LIMIT 12';
  return getDb().prepare(query).all(...params) as { month: string; income: number; expenses: number }[];
}

export function getTopMerchants(limit: number = 10, startDate?: string, endDate?: string): { merchant: string; total: number; count: number }[] {
  let query = `
    SELECT
      COALESCE(merchant, description) as merchant,
      SUM(amount) as total,
      COUNT(*) as count
    FROM transactions
    WHERE amount < 0 AND is_transfer = 0 AND category != 'Investing'
  `;
  const params: (string | number)[] = [];

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  query += ' GROUP BY COALESCE(merchant, description) ORDER BY total ASC LIMIT ?';
  params.push(limit);
  return getDb().prepare(query).all(...params) as { merchant: string; total: number; count: number }[];
}

export function getTotalBalance(): number {
  const result = getDb().prepare(`
    SELECT SUM(amount) as total FROM transactions WHERE is_transfer = 0
  `).get() as { total: number } | undefined;
  return result?.total || 0;
}

export function getTransactionStats(startDate?: string, endDate?: string): {
  totalTransactions: number;
  totalIncome: number;
  totalExpenses: number;
  uncategorized: number;
} {
  let query = `
    SELECT
      COUNT(*) as totalTransactions,
      SUM(CASE WHEN amount > 0 AND is_transfer = 0 AND (category IS NULL OR category != 'Financial') THEN amount ELSE 0 END) as totalIncome,
      SUM(CASE WHEN amount < 0 AND is_transfer = 0 AND category != 'Investing' THEN amount ELSE 0 END) as totalExpenses,
      SUM(CASE WHEN category IS NULL THEN 1 ELSE 0 END) as uncategorized
    FROM transactions
    WHERE 1=1
  `;
  const params: string[] = [];

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  const result = getDb().prepare(query).get(...params) as {
    totalTransactions: number;
    totalIncome: number;
    totalExpenses: number;
    uncategorized: number;
  };
  return result;
}

// Extended snapshot operations for net worth tracking
export interface MonthlySnapshotWithAccount extends MonthlySnapshot {
  account_name: string;
  account_type: string;
}

export function getSnapshotsWithAccounts(): MonthlySnapshotWithAccount[] {
  return getDb().prepare(`
    SELECT ms.*, a.name as account_name, a.type as account_type
    FROM monthly_snapshots ms
    JOIN accounts a ON ms.account_id = a.id
    ORDER BY ms.month DESC, a.name ASC
  `).all() as MonthlySnapshotWithAccount[];
}

export function upsertMonthlySnapshot(month: string, accountId: number, balance: number): number {
  // Check if snapshot exists for this month/account
  const existing = getDb().prepare(`
    SELECT id FROM monthly_snapshots WHERE month = ? AND account_id = ?
  `).get(month, accountId) as { id: number } | undefined;

  if (existing) {
    getDb().prepare(`
      UPDATE monthly_snapshots SET balance = ? WHERE id = ?
    `).run(balance, existing.id);
    return existing.id;
  } else {
    const result = getDb().prepare(`
      INSERT INTO monthly_snapshots (month, account_id, balance)
      VALUES (?, ?, ?)
    `).run(month, accountId, balance);
    return result.lastInsertRowid as number;
  }
}

export function deleteSnapshot(id: number): void {
  getDb().prepare('DELETE FROM monthly_snapshots WHERE id = ?').run(id);
}

export function getLatestBalances(): { account_id: number; account_name: string; account_type: string; balance: number; month: string }[] {
  // Get the most recent balance for each account
  return getDb().prepare(`
    SELECT ms.account_id, a.name as account_name, a.type as account_type, ms.balance, ms.month
    FROM monthly_snapshots ms
    JOIN accounts a ON ms.account_id = a.id
    WHERE ms.month = (
      SELECT MAX(ms2.month) FROM monthly_snapshots ms2 WHERE ms2.account_id = ms.account_id
    )
    ORDER BY a.name ASC
  `).all() as { account_id: number; account_name: string; account_type: string; balance: number; month: string }[];
}

export function getNetWorthHistory(): { month: string; balance: number }[] {
  // Get total net worth by month (sum of all account balances per month)
  return getDb().prepare(`
    SELECT month, SUM(balance) as balance
    FROM monthly_snapshots
    GROUP BY month
    ORDER BY month DESC
    LIMIT 24
  `).all() as { month: string; balance: number }[];
}

export function getMonthlyExpensesByCategory(): { month: string; category: string; total: number }[] {
  return getDb().prepare(`
    SELECT
      strftime('%Y-%m', date) as month,
      category,
      SUM(ABS(amount)) as total
    FROM transactions
    WHERE amount < 0 AND is_transfer = 0 AND category IS NOT NULL AND category != 'Investing'
    GROUP BY strftime('%Y-%m', date), category
    ORDER BY month DESC
  `).all() as { month: string; category: string; total: number }[];
}

// Subscriptions Detection
export interface Subscription {
  merchant: string;
  avgAmount: number;
  monthlyAmount: number;
  frequency: number;
  billingCycle: 'monthly' | 'annual' | 'quarterly';
  lastSeen: string;
}

export function getSubscriptions(minOccurrences: number = 1): Subscription[] {
  // Find subscriptions - merchants in Subscriptions category
  // Detect billing cycle based on frequency over the data period
  const results = getDb().prepare(`
    WITH subscription_data AS (
      SELECT
        COALESCE(merchant, description) as merchant,
        ABS(amount) as amount,
        date,
        strftime('%Y-%m', date) as month
      FROM transactions
      WHERE amount < 0 AND is_transfer = 0 AND category = 'Subscriptions'
    ),
    merchant_stats AS (
      SELECT
        merchant,
        AVG(amount) as avgAmount,
        COUNT(*) as totalPayments,
        COUNT(DISTINCT month) as monthsWithPayments,
        MIN(date) as firstSeen,
        MAX(date) as lastSeen,
        -- Calculate months spanned
        CAST((julianday(MAX(date)) - julianday(MIN(date))) / 30.0 AS INTEGER) + 1 as monthsSpanned
      FROM subscription_data
      GROUP BY merchant
    )
    SELECT
      merchant,
      avgAmount,
      totalPayments,
      monthsWithPayments,
      monthsSpanned,
      lastSeen
    FROM merchant_stats
    WHERE totalPayments >= ?
    ORDER BY avgAmount DESC
    LIMIT 30
  `).all(minOccurrences) as {
    merchant: string;
    avgAmount: number;
    totalPayments: number;
    monthsWithPayments: number;
    monthsSpanned: number;
    lastSeen: string;
  }[];

  return results.map(row => {
    // Determine billing cycle based on payment frequency
    // If payments per month ratio is close to 1, it's monthly
    // If payments per month ratio is close to 0.25, it's quarterly
    // If payments per month ratio is close to 0.083 (1/12), it's annual
    const paymentsPerMonth = row.monthsSpanned > 0
      ? row.totalPayments / row.monthsSpanned
      : row.totalPayments;

    let billingCycle: 'monthly' | 'annual' | 'quarterly';
    let monthlyAmount: number;

    if (paymentsPerMonth >= 0.8) {
      // Roughly monthly (at least 80% of months have a payment)
      billingCycle = 'monthly';
      monthlyAmount = row.avgAmount;
    } else if (paymentsPerMonth >= 0.2) {
      // Roughly quarterly
      billingCycle = 'quarterly';
      monthlyAmount = row.avgAmount / 3;
    } else {
      // Annual or less frequent
      billingCycle = 'annual';
      monthlyAmount = row.avgAmount / 12;
    }

    return {
      merchant: row.merchant,
      avgAmount: row.avgAmount,
      monthlyAmount,
      frequency: row.totalPayments,
      billingCycle,
      lastSeen: row.lastSeen,
    };
  });
}

// Savings Rate by Month
export interface SavingsData {
  month: string;
  income: number;
  expenses: number;
  saved: number;
  rate: number;
}

export function getMonthlySavingsRate(months: number = 12): SavingsData[] {
  const results = getDb().prepare(`
    SELECT
      strftime('%Y-%m', date) as month,
      SUM(CASE WHEN amount > 0 AND is_transfer = 0 AND (category IS NULL OR category != 'Financial') THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN amount < 0 AND is_transfer = 0 AND category != 'Investing' THEN ABS(amount) ELSE 0 END) as expenses
    FROM transactions
    GROUP BY strftime('%Y-%m', date)
    ORDER BY month DESC
    LIMIT ?
  `).all(months) as { month: string; income: number; expenses: number }[];

  return results.map(row => {
    const saved = row.income - row.expenses;
    const rate = row.income > 0 ? (saved / row.income) * 100 : 0;
    return {
      month: row.month,
      income: row.income,
      expenses: row.expenses,
      saved,
      rate: Math.round(rate * 10) / 10, // Round to 1 decimal
    };
  });
}

// Merchant Frequency (visits-based, not $$ based)
export interface MerchantFrequency {
  merchant: string;
  visits: number;
  totalSpent: number;
  avgPerVisit: number;
  lastVisit: string;
}

export function getMerchantFrequency(limit: number = 20): MerchantFrequency[] {
  return getDb().prepare(`
    SELECT
      COALESCE(merchant, description) as merchant,
      COUNT(*) as visits,
      SUM(ABS(amount)) as totalSpent,
      AVG(ABS(amount)) as avgPerVisit,
      MAX(date) as lastVisit
    FROM transactions
    WHERE amount < 0 AND is_transfer = 0 AND category != 'Investing'
    GROUP BY COALESCE(merchant, description)
    ORDER BY visits DESC
    LIMIT ?
  `).all(limit) as MerchantFrequency[];
}

// AI Settings operations
export function getAiSetting(key: string): string | null {
  const result = getDb().prepare(
    'SELECT setting_value FROM ai_settings WHERE setting_key = ?'
  ).get(key) as { setting_value: string } | undefined;
  return result?.setting_value || null;
}

export function setAiSetting(key: string, value: string): void {
  getDb().prepare(`
    INSERT INTO ai_settings (setting_key, setting_value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(setting_key) DO UPDATE SET
      setting_value = excluded.setting_value,
      updated_at = CURRENT_TIMESTAMP
  `).run(key, value);
}

export function getAllAiSettings(): Record<string, string> {
  const results = getDb().prepare(
    'SELECT setting_key, setting_value FROM ai_settings'
  ).all() as { setting_key: string; setting_value: string }[];

  const settings: Record<string, string> = {};
  for (const row of results) {
    settings[row.setting_key] = row.setting_value;
  }
  return settings;
}

export function deleteAiSetting(key: string): void {
  getDb().prepare('DELETE FROM ai_settings WHERE setting_key = ?').run(key);
}
