import { CSVParser, ParseResult, ParsedTransaction } from './types';

// Chase Credit Card CSV format:
// Transaction Date,Post Date,Description,Category,Type,Amount,Memo
export const chaseParser: CSVParser = {
  name: 'Chase Credit Card',

  detect: (headers: string[]): boolean => {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    return (
      normalizedHeaders.includes('transaction date') &&
      normalizedHeaders.includes('description') &&
      normalizedHeaders.includes('amount') &&
      (normalizedHeaders.includes('category') || normalizedHeaders.includes('type'))
    );
  },

  parse: (headers: string[], rows: string[][]): ParseResult => {
    const transactions: ParsedTransaction[] = [];

    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      headerMap[h.toLowerCase().trim()] = i;
    });

    const dateIdx = headerMap['transaction date'] ?? headerMap['trans date'];
    const descIdx = headerMap['description'];
    const amountIdx = headerMap['amount'];
    const categoryIdx = headerMap['category'];
    const typeIdx = headerMap['type'];

    for (const row of rows) {
      if (row.length < Math.max(dateIdx, descIdx, amountIdx) + 1) continue;

      const rawDate = row[dateIdx]?.trim();
      const description = row[descIdx]?.trim();
      const rawAmount = row[amountIdx]?.trim();
      const category = categoryIdx !== undefined ? row[categoryIdx]?.trim() : undefined;
      const type = typeIdx !== undefined ? row[typeIdx]?.trim() : undefined;

      if (!rawDate || !description || !rawAmount) continue;

      // Parse date (MM/DD/YYYY format)
      const dateParts = rawDate.split('/');
      if (dateParts.length !== 3) continue;
      const date = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;

      // Parse amount (Chase uses negative for expenses already)
      const amount = parseFloat(rawAmount.replace(/[,$]/g, ''));
      if (isNaN(amount)) continue;

      // Skip payments to credit card
      if (type?.toLowerCase() === 'payment' || description.toLowerCase().includes('payment thank you')) {
        continue;
      }

      transactions.push({
        date,
        description,
        amount,
        category: mapChaseCategory(category),
        rawData: row.join(','),
      });
    }

    return {
      success: true,
      transactions,
      accountType: 'credit_card',
      institution: 'Chase',
    };
  },
};

function mapChaseCategory(chaseCategory?: string): string | undefined {
  if (!chaseCategory) return undefined;

  const mapping: Record<string, string> = {
    'food & drink': 'Food',
    'groceries': 'Groceries',
    'gas': 'Transportation',
    'travel': 'Travel',
    'shopping': 'Shopping',
    'entertainment': 'Entertainment',
    'health & wellness': 'Health',
    'professional services': 'Other',
    'personal': 'Other',
    'bills & utilities': 'Housing',
    'home': 'Housing',
    'fees & adjustments': 'Financial',
  };

  const normalized = chaseCategory.toLowerCase().trim();
  return mapping[normalized] || undefined;
}
