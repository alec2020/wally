-- Accounts (bank, credit card, brokerage)
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'bank', 'credit_card', 'brokerage'
  institution TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER REFERENCES accounts(id),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL, -- negative = expense, positive = income
  category TEXT,
  subcategory TEXT,
  merchant TEXT,
  is_transfer BOOLEAN DEFAULT FALSE,
  notes TEXT,
  raw_data TEXT, -- original CSV row for reference
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Monthly snapshots for net worth tracking
CREATE TABLE IF NOT EXISTS monthly_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month DATE NOT NULL, -- first of month
  account_id INTEGER REFERENCES accounts(id),
  balance DECIMAL(10,2) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Categories (predefined + custom)
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT, -- for charts
  icon TEXT,
  parent_id INTEGER REFERENCES categories(id) -- for subcategories
);

-- User preferences - natural language instructions for AI categorization
CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instruction TEXT NOT NULL,           -- natural language preference
  source TEXT DEFAULT 'user',          -- 'user' or 'learned'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI Settings (API key, model selection)
CREATE TABLE IF NOT EXISTS ai_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_monthly_snapshots_month ON monthly_snapshots(month);

-- Insert predefined categories
INSERT OR IGNORE INTO categories (name, color, icon) VALUES
  ('Income', '#22c55e', 'trending-up'),
  ('Housing', '#3b82f6', 'home'),
  ('Transportation', '#f59e0b', 'car'),
  ('Groceries', '#84cc16', 'shopping-cart'),
  ('Food', '#ef4444', 'utensils'),
  ('Shopping', '#8b5cf6', 'shopping-bag'),
  ('Entertainment', '#ec4899', 'film'),
  ('Health', '#14b8a6', 'heart'),
  ('Travel', '#06b6d4', 'plane'),
  ('Financial', '#64748b', 'landmark'),
  ('Subscriptions', '#f97316', 'repeat'),
  ('Investing', '#10b981', 'trending-up'),
  ('Other', '#94a3b8', 'circle');
