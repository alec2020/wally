import { CSVParser, ParseResult, ParsedTransaction } from './types';

// American Express CSV format:
// Date,Description,Card Member,Account #,Amount
// or newer format:
// Date,Description,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
export const amexParser: CSVParser = {
  name: 'American Express',

  detect: (headers: string[]): boolean => {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    // Check for Amex-specific patterns
    const hasDate = normalizedHeaders.includes('date');
    const hasDescription = normalizedHeaders.includes('description');
    const hasAmount = normalizedHeaders.includes('amount');
    const hasCardMember = normalizedHeaders.includes('card member') || normalizedHeaders.includes('cardmember');
    const hasReference = normalizedHeaders.includes('reference');
    const hasAppearsAs = normalizedHeaders.some(h => h.includes('appears on your statement'));

    return hasDate && hasDescription && hasAmount && (hasCardMember || hasReference || hasAppearsAs);
  },

  parse: (headers: string[], rows: string[][]): ParseResult => {
    const transactions: ParsedTransaction[] = [];

    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      headerMap[h.toLowerCase().trim()] = i;
    });

    const dateIdx = headerMap['date'];
    const descIdx = headerMap['description'];
    const amountIdx = headerMap['amount'];
    const categoryIdx = headerMap['category'];
    const appearsAsIdx = Object.entries(headerMap).find(([k]) => k.includes('appears on your statement'))?.[1];

    for (const row of rows) {
      if (row.length < Math.max(dateIdx, descIdx, amountIdx) + 1) continue;

      const rawDate = row[dateIdx]?.trim();
      const description = row[descIdx]?.trim();
      const rawAmount = row[amountIdx]?.trim();
      const category = categoryIdx !== undefined ? row[categoryIdx]?.trim() : undefined;
      const merchantName = appearsAsIdx !== undefined ? row[appearsAsIdx]?.trim() : undefined;

      if (!rawDate || !description || !rawAmount) continue;

      // Parse date (MM/DD/YYYY format)
      const dateParts = rawDate.split('/');
      if (dateParts.length !== 3) continue;
      const date = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;

      // Parse amount (Amex uses positive for expenses, so we negate)
      let amount = parseFloat(rawAmount.replace(/[,$]/g, ''));
      if (isNaN(amount)) continue;
      amount = -amount; // Convert expenses to negative

      // Skip credits (refunds stay as positive after negation)
      // but we want to include them

      transactions.push({
        date,
        description,
        amount,
        category: mapAmexCategory(category),
        merchant: merchantName || undefined,
        rawData: row.join(','),
      });
    }

    return {
      success: true,
      transactions,
      accountType: 'credit_card',
      institution: 'American Express',
    };
  },
};

function mapAmexCategory(amexCategory?: string): string | undefined {
  if (!amexCategory) return undefined;

  const mapping: Record<string, string> = {
    'restaurant': 'Food',
    'groceries': 'Groceries',
    'supermarket': 'Groceries',
    'gas station': 'Transportation',
    'airline': 'Travel',
    'hotel': 'Travel',
    'merchandise & supplies': 'Shopping',
    'entertainment': 'Entertainment',
    'medical services': 'Health',
    'pharmacy': 'Health',
    'business services': 'Other',
    'utilities': 'Housing',
    'fees & interest charges': 'Financial',
  };

  const normalized = amexCategory.toLowerCase().trim();
  for (const [key, value] of Object.entries(mapping)) {
    if (normalized.includes(key)) return value;
  }
  return undefined;
}
