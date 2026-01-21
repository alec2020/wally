# Finance Tracker - Development Notes

## Critical: Date/Timezone Handling

**Never use `new Date('YYYY-MM-DD')` for date parsing or display in this codebase.**

JavaScript interprets date strings like `'2025-12-01'` as UTC midnight, which causes timezone bugs:
- A date intended as December 1st can display as November 30th in US timezones
- Coverage calculations can show wrong months as missing/covered

### Correct patterns:

**Backend (lib/db.ts) - Parse date strings manually:**
```typescript
function parseDateString(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}
```

**Frontend - Use UTC explicitly:**
```typescript
const [year, monthNum] = month.split('-').map(Number);
const date = new Date(Date.UTC(year, monthNum - 1, 15)); // Middle of month avoids edge cases
return date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
```

**For numeric comparisons (e.g., date overlap checks):**
```typescript
// Convert to YYYYMMDD numbers for safe comparison
const dateNum = year * 10000 + month * 100 + day;
```

## Files with Safe Date Handling (audited Jan 2026)

These files have been verified or fixed for timezone safety:
- `lib/utils.ts` - `formatDate()` and `formatMonth()` both parse safely
- `lib/db.ts` - `getAccountCoverage()` uses numeric comparison
- `components/MissingStatementsTracker.tsx` - Uses UTC explicitly
- `app/analytics/page.tsx:573` - Fixed to parse date components
- `app/page.tsx:128` - Uses 'T12:00:00' suffix workaround

Safe patterns (no fix needed):
- Sorting/comparison using `new Date(dateStr).getTime()` - both sides offset equally
- Duration calculations (differences) - offsets cancel out
- `new Date()` for current time
- `new Date(year, month, day)` component construction

## Recharts X-Axis Labels

Recharts auto-hides X-axis labels when it thinks there isn't enough space. To force all labels to show, add `interval={0}`:

```tsx
<XAxis
  dataKey="month"
  interval={0}  // Force show all labels
  tick={{ fontSize: 12 }}  // Smaller font helps fit
/>
```

Charts with this fix applied:
- `MonthlyTrendChart.tsx`
- `MonthlyExpenseTrendsChart.tsx`
- `SpendingTrendChart.tsx`
- `NetWorthChart.tsx`

## Project Structure

- **Database**: SQLite via better-sqlite3 at `finance.db`
- **PDF Parsing**: Uses AI (OpenRouter) to extract transactions from bank/credit card statements
- **Eval**: `npm run eval` tests PDF parsing accuracy against ground truth

## Key Tables

- `transactions` - All financial transactions
- `accounts` - Bank accounts, credit cards
- `statement_uploads` - Tracks uploaded PDF statement periods for coverage tracking
