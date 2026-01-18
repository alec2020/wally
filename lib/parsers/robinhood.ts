import { CSVParser, ParseResult, ParsedTransaction } from './types';

// Robinhood CSV format (account statements):
// Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount
// or for cash management:
// Date,Type,Description,Amount
export const robinhoodParser: CSVParser = {
  name: 'Robinhood',

  detect: (headers: string[]): boolean => {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    const hasActivityDate = normalizedHeaders.includes('activity date');
    const hasInstrument = normalizedHeaders.includes('instrument') || normalizedHeaders.includes('symbol');
    const hasTransCode = normalizedHeaders.includes('trans code') || normalizedHeaders.includes('transaction type');
    const hasDescription = normalizedHeaders.includes('description');

    return (hasActivityDate && hasTransCode) || (hasActivityDate && hasInstrument && hasDescription);
  },

  parse: (headers: string[], rows: string[][]): ParseResult => {
    const transactions: ParsedTransaction[] = [];

    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      headerMap[h.toLowerCase().trim()] = i;
    });

    const dateIdx = headerMap['activity date'] ?? headerMap['date'];
    const descIdx = headerMap['description'];
    const amountIdx = headerMap['amount'];
    const instrumentIdx = headerMap['instrument'] ?? headerMap['symbol'];
    const transCodeIdx = headerMap['trans code'] ?? headerMap['transaction type'];
    const quantityIdx = headerMap['quantity'];
    const priceIdx = headerMap['price'];

    for (const row of rows) {
      if (row.length < Math.max(dateIdx, amountIdx) + 1) continue;

      const rawDate = row[dateIdx]?.trim();
      let description = row[descIdx]?.trim();
      const rawAmount = row[amountIdx]?.trim();
      const instrument = instrumentIdx !== undefined ? row[instrumentIdx]?.trim() : undefined;
      const transCode = transCodeIdx !== undefined ? row[transCodeIdx]?.trim() : undefined;
      const quantity = quantityIdx !== undefined ? row[quantityIdx]?.trim() : undefined;
      const price = priceIdx !== undefined ? row[priceIdx]?.trim() : undefined;

      if (!rawDate || !rawAmount) continue;

      // Parse date (MM/DD/YYYY or YYYY-MM-DD format)
      let date: string;
      if (rawDate.includes('/')) {
        const dateParts = rawDate.split('/');
        if (dateParts.length !== 3) continue;
        date = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
      } else if (rawDate.includes('-')) {
        date = rawDate;
      } else {
        continue;
      }

      // Parse amount
      let amount = parseFloat(rawAmount.replace(/[,$()]/g, ''));
      if (rawAmount.includes('(') || rawAmount.startsWith('-')) {
        amount = -Math.abs(amount);
      }
      if (isNaN(amount)) continue;

      // Build description from available data
      if (!description && instrument && transCode) {
        description = `${transCode}: ${instrument}`;
        if (quantity && price) {
          description += ` (${quantity} @ $${price})`;
        }
      } else if (!description) {
        description = transCode || 'Unknown transaction';
      }

      // Categorize based on transaction type
      let category = 'Financial';
      if (transCode) {
        const code = transCode.toLowerCase();
        if (code.includes('div') || code.includes('dividend')) {
          category = 'Income';
        } else if (code.includes('interest')) {
          category = 'Income';
        } else if (code.includes('fee')) {
          category = 'Financial';
        }
      }

      transactions.push({
        date,
        description,
        amount,
        category,
        merchant: instrument ? `Robinhood - ${instrument}` : 'Robinhood',
        rawData: row.join(','),
      });
    }

    return {
      success: true,
      transactions,
      accountType: 'brokerage',
      institution: 'Robinhood',
    };
  },
};
