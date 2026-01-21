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
  subscription_frequency TEXT, -- NULL, 'monthly', or 'annual' for Subscriptions category
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

-- Assets (car, watch, real estate, etc.)
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'vehicle', 'jewelry', 'real_estate', 'collectible', 'other'
  purchase_price DECIMAL(10,2),
  purchase_date DATE,
  current_value DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Liabilities (car loan, mortgage, etc.)
CREATE TABLE IF NOT EXISTS liabilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'auto_loan', 'mortgage', 'personal_loan', 'student_loan', 'other'
  original_amount DECIMAL(10,2) NOT NULL,
  current_balance DECIMAL(10,2) NOT NULL,
  interest_rate DECIMAL(5,3),
  monthly_payment DECIMAL(10,2),
  start_date DATE,
  exclude_from_net_worth BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Statement uploads (track uploaded PDF statement periods)
CREATE TABLE IF NOT EXISTS statement_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER REFERENCES accounts(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  filename TEXT,
  transaction_count INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_monthly_snapshots_month ON monthly_snapshots(month);
CREATE INDEX IF NOT EXISTS idx_statement_uploads_account ON statement_uploads(account_id);

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
