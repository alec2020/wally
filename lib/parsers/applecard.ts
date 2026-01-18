import { CSVParser, ParseResult, ParsedTransaction } from './types';

// Apple Card CSV format:
// Transaction Date,Clearing Date,Description,Merchant,Category,Type,Amount (USD),Purchased By
export const appleCardParser: CSVParser = {
  name: 'Apple Card',

  detect: (headers: string[]): boolean => {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    return (
      normalizedHeaders.includes('transaction date') &&
      normalizedHeaders.includes('merchant') &&
      normalizedHeaders.includes('amount (usd)') &&
      normalizedHeaders.includes('purchased by')
    );
  },

  parse: (headers: string[], rows: string[][]): ParseResult => {
    const transactions: ParsedTransaction[] = [];

    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      headerMap[h.toLowerCase().trim()] = i;
    });

    const dateIdx = headerMap['transaction date'];
    const descIdx = headerMap['description'];
    const merchantIdx = headerMap['merchant'];
    const categoryIdx = headerMap['category'];
    const typeIdx = headerMap['type'];
    const amountIdx = headerMap['amount (usd)'];

    for (const row of rows) {
      if (row.length < Math.max(dateIdx, descIdx, amountIdx) + 1) continue;

      const rawDate = row[dateIdx]?.trim();
      const description = row[descIdx]?.trim();
      const merchant = row[merchantIdx]?.trim();
      const category = row[categoryIdx]?.trim();
      const type = row[typeIdx]?.trim();
      const rawAmount = row[amountIdx]?.trim();

      if (!rawDate || !description || !rawAmount) continue;

      // Parse date (MM/DD/YYYY format)
      const dateParts = rawDate.split('/');
      if (dateParts.length !== 3) continue;
      const date = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;

      // Parse amount - Apple Card uses positive for purchases, negative for payments/credits
      // We want negative for expenses, positive for income
      let amount = parseFloat(rawAmount.replace(/[,$]/g, ''));
      if (isNaN(amount)) continue;

      // Invert: purchases should be negative (expenses), payments/credits should be positive
      amount = -amount;

      // Skip payment transactions (these are transfers, not real expenses/income)
      if (type?.toLowerCase() === 'payment') {
        continue;
      }

      transactions.push({
        date,
        description,
        amount,
        category: mapAppleCardCategory(category),
        merchant: cleanMerchantName(merchant),
        rawData: row.join(','),
      });
    }

    return {
      success: true,
      transactions,
      accountType: 'credit_card',
      institution: 'Apple Card',
    };
  },
};

function mapAppleCardCategory(appleCategory?: string): string | undefined {
  if (!appleCategory) return undefined;

  const mapping: Record<string, string> = {
    'food & drink': 'Food',
    'groceries': 'Groceries',
    'transportation': 'Transportation',
    'travel': 'Travel',
    'shopping': 'Shopping',
    'entertainment': 'Entertainment',
    'health': 'Health',
    'home': 'Housing',
    'utilities': 'Housing',
    'services': 'Other',
    'other': 'Other',
  };

  const normalized = appleCategory.toLowerCase().trim();
  return mapping[normalized] || undefined;
}

function cleanMerchantName(merchant?: string): string | undefined {
  if (!merchant) return undefined;

  // Clean up common patterns
  let clean = merchant
    .replace(/\s+/g, ' ')  // normalize whitespace
    .trim();

  // Title case if all caps
  if (clean === clean.toUpperCase()) {
    clean = clean.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  return clean;
}
