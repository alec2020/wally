import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'finance.db');
const db = new Database(DB_PATH);

// Ensure statement_uploads table exists
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

console.log('Backfilling statement_uploads from existing transaction data...\n');

// Get all accounts with transactions
const accounts = db.prepare(`
  SELECT DISTINCT a.id, a.name, a.type
  FROM accounts a
  INNER JOIN transactions t ON a.id = t.account_id
  ORDER BY a.name
`).all() as Array<{ id: number; name: string; type: string }>;

console.log(`Found ${accounts.length} accounts with transactions\n`);

let totalStatements = 0;

for (const account of accounts) {
  // Get distinct months with transactions for this account
  const months = db.prepare(`
    SELECT
      strftime('%Y-%m', date) as month,
      MIN(date) as first_date,
      MAX(date) as last_date,
      COUNT(*) as tx_count
    FROM transactions
    WHERE account_id = ?
    GROUP BY strftime('%Y-%m', date)
    ORDER BY month
  `).all(account.id) as Array<{
    month: string;
    first_date: string;
    last_date: string;
    tx_count: number
  }>;

  // Check for existing statement uploads for this account
  const existingStatements = db.prepare(`
    SELECT period_start, period_end FROM statement_uploads WHERE account_id = ?
  `).all(account.id) as Array<{ period_start: string; period_end: string }>;

  // Create a set of already-covered months
  const coveredMonths = new Set<string>();
  for (const stmt of existingStatements) {
    const start = new Date(stmt.period_start);
    const end = new Date(stmt.period_end);
    // Mark all months in this range as covered
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      coveredMonths.add(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
      current.setMonth(current.getMonth() + 1);
    }
  }

  let accountStatements = 0;

  for (const monthData of months) {
    // Skip if this month is already covered
    if (coveredMonths.has(monthData.month)) {
      continue;
    }

    // Create a statement period for this month
    // Use first day of month as start, last day as end
    const [year, monthNum] = monthData.month.split('-').map(Number);
    const periodStart = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const periodEnd = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    db.prepare(`
      INSERT INTO statement_uploads (account_id, period_start, period_end, filename, transaction_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      account.id,
      periodStart,
      periodEnd,
      `backfill-${monthData.month}`,
      monthData.tx_count
    );

    accountStatements++;
    totalStatements++;
  }

  if (accountStatements > 0) {
    console.log(`  ${account.name}: Added ${accountStatements} statement periods (${months.length} months total)`);
  } else if (existingStatements.length > 0) {
    console.log(`  ${account.name}: Already has ${existingStatements.length} statements, skipped`);
  }
}

console.log(`\nBackfill complete! Added ${totalStatements} statement records.`);

// Show summary
const summary = db.prepare(`
  SELECT a.name, COUNT(su.id) as statement_count
  FROM accounts a
  LEFT JOIN statement_uploads su ON a.id = su.account_id
  GROUP BY a.id
  HAVING statement_count > 0
  ORDER BY a.name
`).all() as Array<{ name: string; statement_count: number }>;

console.log('\nStatement coverage summary:');
for (const row of summary) {
  console.log(`  ${row.name}: ${row.statement_count} statements`);
}

db.close();
