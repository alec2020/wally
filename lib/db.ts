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

    // Migration: Add subscription_frequency column if it doesn't exist
    const columnCheck = db.prepare("SELECT * FROM pragma_table_info('transactions') WHERE name = 'subscription_frequency'").get();
    if (!columnCheck) {
      db.exec("ALTER TABLE transactions ADD COLUMN subscription_frequency TEXT");
    }

    // Migration: Create assets table if it doesn't exist
    const assetsTableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='assets'").get();
    if (!assetsTableCheck) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS assets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          purchase_price DECIMAL(10,2),
          purchase_date DATE,
          current_value DECIMAL(10,2) NOT NULL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // Migration: Create liabilities table if it doesn't exist
    const liabilitiesTableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='liabilities'").get();
    if (!liabilitiesTableCheck) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS liabilities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          original_amount DECIMAL(10,2) NOT NULL,
          current_balance DECIMAL(10,2) NOT NULL,
          interest_rate DECIMAL(5,3),
          monthly_payment DECIMAL(10,2),
          start_date DATE,
          exclude_from_net_worth BOOLEAN DEFAULT FALSE,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // Migration: Add exclude_from_net_worth column to liabilities if it doesn't exist
    const excludeColumnCheck = db.prepare("SELECT * FROM pragma_table_info('liabilities') WHERE name = 'exclude_from_net_worth'").get();
    if (!excludeColumnCheck) {
      db.exec("ALTER TABLE liabilities ADD COLUMN exclude_from_net_worth BOOLEAN DEFAULT FALSE");
    }

    // Migration: Create statement_uploads table if it doesn't exist
    const statementUploadsCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='statement_uploads'").get();
    if (!statementUploadsCheck) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS statement_uploads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER REFERENCES accounts(id),
          period_start DATE NOT NULL,
          period_end DATE NOT NULL,
          filename TEXT,
          transaction_count INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_statement_uploads_account ON statement_uploads(account_id);
      `);
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
  subscription_frequency: 'monthly' | 'annual' | null;
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
    query += ' AND (t.description LIKE ? OR t.merchant LIKE ? OR t.notes LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
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
  if (updates.subscription_frequency !== undefined) {
    fields.push('subscription_frequency = ?');
    params.push(updates.subscription_frequency);
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
export function isDuplicateTransaction(date: string, amount: number, _description: string): boolean {
  // Match on date + amount only (not description) because the same transaction
  // can have different description formatting from different sources (CSV vs PDF)
  const existing = getDb().prepare(`
    SELECT id FROM transactions
    WHERE date = ? AND amount = ?
    LIMIT 1
  `).get(date, amount);
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

export function findPreferenceByMerchant(merchantName: string): UserPreference | undefined {
  // Find a preference that starts with the same merchant pattern
  // e.g., '"Root Insurance" should be categorized as...'
  const pattern = `"${merchantName}" should be categorized as%`;
  return getDb().prepare(
    'SELECT * FROM user_preferences WHERE instruction LIKE ? LIMIT 1'
  ).get(pattern) as UserPreference | undefined;
}

export function upsertPreferenceForMerchant(merchantName: string, instruction: string, source: string = 'learned'): number {
  const existing = findPreferenceByMerchant(merchantName);
  if (existing) {
    // Update existing preference
    updateUserPreference(existing.id, instruction);
    return existing.id;
  } else {
    // Create new preference
    return addUserPreference(instruction, source);
  }
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
  // Include both negative amounts (purchases) and positive amounts (credits/refunds)
  // in each category so credits offset the purchases
  let query = `
    SELECT category, SUM(amount) as total
    FROM transactions
    WHERE is_transfer = 0 AND category IS NOT NULL AND category != 'Investing' AND category != 'Income'
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

export function getMonthlyTotals(startDate?: string, endDate?: string): { month: string; income: number; expenses: number; invested: number }[] {
  // Income: Only positive amounts categorized as 'Income'
  // Expenses: All negative amounts + positive amounts in non-Income categories (credits/refunds offset)
  let query = `
    SELECT
      strftime('%Y-%m', date) as month,
      SUM(CASE WHEN amount > 0 AND is_transfer = 0 AND category = 'Income' THEN amount ELSE 0 END) as income,
      SUM(CASE
        WHEN amount < 0 AND is_transfer = 0 AND category != 'Investing' THEN amount
        WHEN amount > 0 AND is_transfer = 0 AND category IS NOT NULL AND category != 'Income' AND category != 'Investing' THEN amount
        ELSE 0
      END) as expenses,
      SUM(CASE WHEN category = 'Investing' THEN ABS(amount) ELSE 0 END) as invested
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
  return getDb().prepare(query).all(...params) as { month: string; income: number; expenses: number; invested: number }[];
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
  // Income: Only positive amounts categorized as 'Income'
  // Expenses: All negative amounts + positive amounts in non-Income categories (credits/refunds offset)
  let query = `
    SELECT
      COUNT(*) as totalTransactions,
      SUM(CASE WHEN amount > 0 AND is_transfer = 0 AND category = 'Income' THEN amount ELSE 0 END) as totalIncome,
      SUM(CASE
        WHEN amount < 0 AND is_transfer = 0 AND category != 'Investing' THEN amount
        WHEN amount > 0 AND is_transfer = 0 AND category IS NOT NULL AND category != 'Income' AND category != 'Investing' THEN amount
        ELSE 0
      END) as totalExpenses,
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

// Normalize merchant names for better grouping
function normalizeMerchantName(name: string): string {
  return name
    .toUpperCase()
    // Remove common suffixes
    .replace(/\s*(USA|INC|LLC|CORP|CO|LTD|LIMITED|MEMBERSHIP|SUBSCRIPTION|MONTHLY|ANNUAL|RECURRING)\.?\s*/g, ' ')
    // Remove special characters except spaces
    .replace(/[^A-Z0-9\s]/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

export function getSubscriptions(minOccurrences: number = 1): Subscription[] {
  // Find subscriptions - merchants in Subscriptions category
  // Use manual subscription_frequency if set, otherwise auto-detect
  const results = getDb().prepare(`
    WITH subscription_data AS (
      SELECT
        COALESCE(merchant, description) as merchant,
        ABS(amount) as amount,
        date,
        strftime('%Y-%m', date) as month,
        subscription_frequency
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
        -- Get the most recent manual frequency setting for this merchant
        (SELECT subscription_frequency FROM subscription_data sd2
         WHERE sd2.merchant = subscription_data.merchant
         AND sd2.subscription_frequency IS NOT NULL
         ORDER BY sd2.date DESC LIMIT 1) as manualFrequency,
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
      lastSeen,
      manualFrequency
    FROM merchant_stats
    WHERE totalPayments >= ?
    ORDER BY avgAmount DESC
    LIMIT 50
  `).all(minOccurrences) as {
    merchant: string;
    avgAmount: number;
    totalPayments: number;
    monthsWithPayments: number;
    monthsSpanned: number;
    lastSeen: string;
    manualFrequency: 'monthly' | 'annual' | null;
  }[];

  // Group similar merchants by normalized name
  const groupedByNormalized = new Map<string, typeof results>();

  for (const row of results) {
    const normalized = normalizeMerchantName(row.merchant);
    if (!groupedByNormalized.has(normalized)) {
      groupedByNormalized.set(normalized, []);
    }
    groupedByNormalized.get(normalized)!.push(row);
  }

  // Merge grouped merchants
  const mergedResults: Subscription[] = [];

  for (const [, group] of groupedByNormalized) {
    // Use the shortest merchant name as the display name (usually cleanest)
    const displayName = group.reduce((shortest, row) =>
      row.merchant.length < shortest.length ? row.merchant : shortest
    , group[0].merchant);

    // Sum up stats across all variations
    const totalPayments = group.reduce((sum, row) => sum + row.totalPayments, 0);
    const totalAmount = group.reduce((sum, row) => sum + row.avgAmount * row.totalPayments, 0);
    const avgAmount = totalAmount / totalPayments;
    const lastSeen = group.reduce((latest, row) =>
      row.lastSeen > latest ? row.lastSeen : latest
    , group[0].lastSeen);
    const monthsSpanned = Math.max(...group.map(row => row.monthsSpanned));

    // Use manual frequency if any variation has it set
    const manualFrequency = group.find(row => row.manualFrequency)?.manualFrequency || null;

    let billingCycle: 'monthly' | 'annual' | 'quarterly';
    let monthlyAmount: number;

    if (manualFrequency) {
      billingCycle = manualFrequency;
      monthlyAmount = manualFrequency === 'annual'
        ? avgAmount / 12
        : avgAmount;
    } else {
      const paymentsPerMonth = monthsSpanned > 0
        ? totalPayments / monthsSpanned
        : totalPayments;

      if (paymentsPerMonth >= 0.8) {
        billingCycle = 'monthly';
        monthlyAmount = avgAmount;
      } else if (paymentsPerMonth >= 0.2) {
        billingCycle = 'quarterly';
        monthlyAmount = avgAmount / 3;
      } else {
        billingCycle = 'annual';
        monthlyAmount = avgAmount / 12;
      }
    }

    mergedResults.push({
      merchant: displayName,
      avgAmount,
      monthlyAmount,
      frequency: totalPayments,
      billingCycle,
      lastSeen,
    });
  }

  // Sort by monthly amount descending and limit to 30
  return mergedResults
    .sort((a, b) => b.avgAmount - a.avgAmount)
    .slice(0, 30);
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
  // Income: Only positive amounts categorized as 'Income'
  // Expenses: All negative amounts + positive amounts in non-Income categories (credits/refunds offset)
  const results = getDb().prepare(`
    SELECT
      strftime('%Y-%m', date) as month,
      SUM(CASE WHEN amount > 0 AND is_transfer = 0 AND category = 'Income' THEN amount ELSE 0 END) as income,
      ABS(SUM(CASE
        WHEN amount < 0 AND is_transfer = 0 AND category != 'Investing' THEN amount
        WHEN amount > 0 AND is_transfer = 0 AND category IS NOT NULL AND category != 'Income' AND category != 'Investing' THEN amount
        ELSE 0
      END)) as expenses
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

// Asset operations
export type AssetType = 'vehicle' | 'jewelry' | 'real_estate' | 'collectible' | 'other';

export interface Asset {
  id: number;
  name: string;
  type: AssetType;
  purchase_price: number | null;
  purchase_date: string | null;
  current_value: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function getAssets(): Asset[] {
  return getDb().prepare('SELECT * FROM assets ORDER BY current_value DESC').all() as Asset[];
}

export function getAssetById(id: number): Asset | undefined {
  return getDb().prepare('SELECT * FROM assets WHERE id = ?').get(id) as Asset | undefined;
}

export function createAsset(asset: Omit<Asset, 'id' | 'created_at' | 'updated_at'>): number {
  const result = getDb().prepare(`
    INSERT INTO assets (name, type, purchase_price, purchase_date, current_value, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    asset.name,
    asset.type,
    asset.purchase_price,
    asset.purchase_date,
    asset.current_value,
    asset.notes
  );
  return result.lastInsertRowid as number;
}

export function updateAsset(id: number, updates: Partial<Omit<Asset, 'id' | 'created_at' | 'updated_at'>>): void {
  const fields: string[] = [];
  const params: (string | number | null)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    params.push(updates.name);
  }
  if (updates.type !== undefined) {
    fields.push('type = ?');
    params.push(updates.type);
  }
  if (updates.purchase_price !== undefined) {
    fields.push('purchase_price = ?');
    params.push(updates.purchase_price);
  }
  if (updates.purchase_date !== undefined) {
    fields.push('purchase_date = ?');
    params.push(updates.purchase_date);
  }
  if (updates.current_value !== undefined) {
    fields.push('current_value = ?');
    params.push(updates.current_value);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    params.push(updates.notes);
  }

  if (fields.length > 0) {
    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    getDb().prepare(`UPDATE assets SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }
}

export function deleteAsset(id: number): void {
  getDb().prepare('DELETE FROM assets WHERE id = ?').run(id);
}

export function getTotalAssetsValue(): number {
  const result = getDb().prepare('SELECT SUM(current_value) as total FROM assets').get() as { total: number } | undefined;
  return result?.total || 0;
}

// Liability operations
export type LiabilityType = 'auto_loan' | 'mortgage' | 'personal_loan' | 'student_loan' | 'other';

export interface Liability {
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
  created_at: string;
  updated_at: string;
}

export function getLiabilities(): Liability[] {
  return getDb().prepare('SELECT * FROM liabilities ORDER BY current_balance DESC').all() as Liability[];
}

export function getLiabilityById(id: number): Liability | undefined {
  return getDb().prepare('SELECT * FROM liabilities WHERE id = ?').get(id) as Liability | undefined;
}

export function createLiability(liability: Omit<Liability, 'id' | 'created_at' | 'updated_at'>): number {
  const result = getDb().prepare(`
    INSERT INTO liabilities (name, type, original_amount, current_balance, interest_rate, monthly_payment, start_date, exclude_from_net_worth, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    liability.name,
    liability.type,
    liability.original_amount,
    liability.current_balance,
    liability.interest_rate,
    liability.monthly_payment,
    liability.start_date,
    liability.exclude_from_net_worth ? 1 : 0,
    liability.notes
  );
  return result.lastInsertRowid as number;
}

export function updateLiability(id: number, updates: Partial<Omit<Liability, 'id' | 'created_at' | 'updated_at'>>): void {
  const fields: string[] = [];
  const params: (string | number | null)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    params.push(updates.name);
  }
  if (updates.type !== undefined) {
    fields.push('type = ?');
    params.push(updates.type);
  }
  if (updates.original_amount !== undefined) {
    fields.push('original_amount = ?');
    params.push(updates.original_amount);
  }
  if (updates.current_balance !== undefined) {
    fields.push('current_balance = ?');
    params.push(updates.current_balance);
  }
  if (updates.interest_rate !== undefined) {
    fields.push('interest_rate = ?');
    params.push(updates.interest_rate);
  }
  if (updates.monthly_payment !== undefined) {
    fields.push('monthly_payment = ?');
    params.push(updates.monthly_payment);
  }
  if (updates.start_date !== undefined) {
    fields.push('start_date = ?');
    params.push(updates.start_date);
  }
  if (updates.exclude_from_net_worth !== undefined) {
    fields.push('exclude_from_net_worth = ?');
    params.push(updates.exclude_from_net_worth ? 1 : 0);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    params.push(updates.notes);
  }

  if (fields.length > 0) {
    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    getDb().prepare(`UPDATE liabilities SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }
}

export function deleteLiability(id: number): void {
  getDb().prepare('DELETE FROM liabilities WHERE id = ?').run(id);
}

export function getTotalLiabilitiesBalance(): number {
  const result = getDb().prepare('SELECT SUM(current_balance) as total FROM liabilities').get() as { total: number } | undefined;
  return result?.total || 0;
}

// Statement upload operations
export interface StatementUpload {
  id: number;
  account_id: number;
  period_start: string;
  period_end: string;
  filename: string | null;
  transaction_count: number | null;
  created_at: string;
}

export function createStatementUpload(data: {
  accountId: number;
  periodStart: string;
  periodEnd: string;
  filename?: string;
  transactionCount?: number;
}): number {
  const result = getDb().prepare(`
    INSERT INTO statement_uploads (account_id, period_start, period_end, filename, transaction_count)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    data.accountId,
    data.periodStart,
    data.periodEnd,
    data.filename || null,
    data.transactionCount || null
  );
  return result.lastInsertRowid as number;
}

export function getStatementUploads(accountId?: number): StatementUpload[] {
  if (accountId) {
    return getDb().prepare(
      'SELECT * FROM statement_uploads WHERE account_id = ? ORDER BY period_start DESC'
    ).all(accountId) as StatementUpload[];
  }
  return getDb().prepare(
    'SELECT * FROM statement_uploads ORDER BY period_start DESC'
  ).all() as StatementUpload[];
}

export interface AccountCoverage {
  id: number;
  name: string;
  type: string;
  institution: string | null;
  coverage: Record<string, boolean>;
  statements: Array<{ periodStart: string; periodEnd: string }>;
}

// Parse YYYY-MM-DD string to year, month, day without timezone issues
function parseDateString(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

export function getAccountCoverage(): {
  accounts: AccountCoverage[];
  months: string[];
} {
  // Get last 12 months
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // Get all accounts that have at least one statement upload
  const accountsWithStatements = getDb().prepare(`
    SELECT DISTINCT a.id, a.name, a.type, a.institution
    FROM accounts a
    INNER JOIN statement_uploads su ON a.id = su.account_id
    ORDER BY a.name
  `).all() as Array<{ id: number; name: string; type: string; institution: string | null }>;

  const accounts: AccountCoverage[] = accountsWithStatements.map(account => {
    // Get all statement uploads for this account
    const statements = getDb().prepare(`
      SELECT period_start, period_end
      FROM statement_uploads
      WHERE account_id = ?
      ORDER BY period_start DESC
    `).all(account.id) as Array<{ period_start: string; period_end: string }>;

    // Determine coverage for each month
    const coverage: Record<string, boolean> = {};
    for (const month of months) {
      // Parse month as YYYY-MM
      const [monthYear, monthNum] = month.split('-').map(Number);
      // Month boundaries (1-indexed month)
      const monthStartDay = 1;
      const monthEndDay = new Date(monthYear, monthNum, 0).getDate(); // Last day of month

      coverage[month] = statements.some(stmt => {
        const stmtStart = parseDateString(stmt.period_start);
        const stmtEnd = parseDateString(stmt.period_end);

        // Convert to comparable numbers (YYYYMMDD format)
        const monthStartNum = monthYear * 10000 + monthNum * 100 + monthStartDay;
        const monthEndNum = monthYear * 10000 + monthNum * 100 + monthEndDay;
        const stmtStartNum = stmtStart.year * 10000 + stmtStart.month * 100 + stmtStart.day;
        const stmtEndNum = stmtEnd.year * 10000 + stmtEnd.month * 100 + stmtEnd.day;

        // Check if statement period overlaps with the month
        return stmtStartNum <= monthEndNum && stmtEndNum >= monthStartNum;
      });
    }

    return {
      id: account.id,
      name: account.name,
      type: account.type,
      institution: account.institution,
      coverage,
      statements: statements.map(s => ({
        periodStart: s.period_start,
        periodEnd: s.period_end,
      })),
    };
  });

  return { accounts, months };
}
