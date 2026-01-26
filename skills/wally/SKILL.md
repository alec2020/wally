---
name: wally
description: Analyze Wally finance tracker transactions - spending by category, subscriptions, savings rate, merchant patterns, and budget insights via SQLite
---

# Wally Transaction Analysis

Skill for answering financial analysis questions about the Wally finance tracker database.

## Database Location

`finance.db` in the project root (SQLite via better-sqlite3)

## Key Tables

### transactions
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Primary key |
| date | TEXT | YYYY-MM-DD format |
| description | TEXT | Raw transaction description |
| amount | REAL | **Negative = expense, Positive = income** |
| category | TEXT | Income, Housing, Transportation, Groceries, Food, Shopping, Entertainment, Health, Travel, Financial, Subscriptions, Investing, Other |
| merchant | TEXT | Normalized merchant name |
| is_transfer | INTEGER | 1 = transfer between accounts (exclude from spending) |
| subscription_frequency | TEXT | 'monthly', 'annual', or NULL |
| account_id | INTEGER | Foreign key to accounts |

### accounts
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Primary key |
| name | TEXT | Account name |
| type | TEXT | 'bank', 'credit_card', 'brokerage' |
| institution | TEXT | Bank/institution name |

## Query Patterns

### Spending by Category (last N months)
```sql
SELECT
  category,
  ROUND(SUM(ABS(amount)), 2) as total_spent,
  COUNT(*) as transactions,
  ROUND(AVG(ABS(amount)), 2) as avg_transaction
FROM transactions
WHERE date >= date('now', '-12 months')
  AND amount < 0
  AND is_transfer = 0
  AND category != 'Investing'
GROUP BY category
ORDER BY total_spent DESC;
```

### Monthly Income vs Expenses
```sql
SELECT
  strftime('%Y-%m', date) as month,
  ROUND(SUM(CASE WHEN amount > 0 AND category = 'Income' THEN amount ELSE 0 END), 2) as income,
  ROUND(SUM(CASE WHEN amount < 0 AND is_transfer = 0 AND category != 'Investing' THEN ABS(amount) ELSE 0 END), 2) as expenses
FROM transactions
WHERE date >= date('now', '-12 months')
GROUP BY month
ORDER BY month;
```

### Top Merchants by Spend
```sql
SELECT
  merchant,
  category,
  ROUND(SUM(ABS(amount)), 2) as total_spent,
  COUNT(*) as visits
FROM transactions
WHERE date >= date('now', '-12 months')
  AND amount < 0
  AND is_transfer = 0
  AND merchant IS NOT NULL AND merchant != ''
GROUP BY merchant
ORDER BY total_spent DESC
LIMIT 20;
```

### Recurring/Subscription Detection
```sql
SELECT
  merchant,
  category,
  ROUND(ABS(amount), 2) as amount,
  COUNT(*) as occurrences
FROM transactions
WHERE date >= date('now', '-12 months')
  AND amount < 0
  AND merchant IS NOT NULL
GROUP BY merchant, ROUND(ABS(amount), 0)
HAVING COUNT(*) >= 3
ORDER BY amount DESC;
```

### Monthly Spending for Specific Category/Merchant
```sql
SELECT
  strftime('%Y-%m', date) as month,
  ROUND(SUM(ABS(amount)), 2) as spent,
  COUNT(*) as count
FROM transactions
WHERE date >= date('now', '-12 months')
  AND amount < 0
  AND merchant LIKE '%DoorDash%'
GROUP BY month
ORDER BY month;
```

### Savings Rate
```sql
SELECT
  strftime('%Y-%m', date) as month,
  ROUND(SUM(CASE WHEN amount > 0 AND category = 'Income' THEN amount ELSE 0 END), 2) as income,
  ROUND(SUM(CASE WHEN amount < 0 AND is_transfer = 0 AND category != 'Investing' THEN ABS(amount) ELSE 0 END), 2) as expenses,
  ROUND(
    (SUM(CASE WHEN amount > 0 AND category = 'Income' THEN amount ELSE 0 END) -
     SUM(CASE WHEN amount < 0 AND is_transfer = 0 AND category != 'Investing' THEN ABS(amount) ELSE 0 END)) /
    NULLIF(SUM(CASE WHEN amount > 0 AND category = 'Income' THEN amount ELSE 0 END), 0) * 100
  , 1) as savings_rate_pct
FROM transactions
WHERE date >= date('now', '-12 months')
GROUP BY month
ORDER BY month;
```

## Analysis Best Practices

1. **Always exclude transfers**: `AND is_transfer = 0`
2. **Exclude investing from expenses**: `AND category != 'Investing'`
3. **Use ABS() for expense amounts** since they're stored as negative
4. **Default to 12 months** for trend analysis unless user specifies otherwise
5. **Include both totals AND monthly averages** for context

## Output Guidelines

- Use markdown tables for data comparisons
- Format currency: $X,XXX.XX
- Calculate and show monthly averages alongside totals
- Provide actionable insights (e.g., "cutting 2 subscriptions could save $X/month")
- Highlight anomalies or notable patterns
