import { CSVParser, ParseResult, ParsedTransaction } from './types';

// Fifth Third Bank CSV format (typical bank statement):
// Date,Description,Debit,Credit,Balance
// or
// Date,Description,Amount,Balance
export const fifthThirdParser: CSVParser = {
  name: 'Fifth Third Bank',

  detect: (headers: string[]): boolean => {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    const hasDate = normalizedHeaders.includes('date') || normalizedHeaders.includes('posted date');
    const hasDescription = normalizedHeaders.includes('description') || normalizedHeaders.includes('memo');
    const hasDebitCredit = normalizedHeaders.includes('debit') && normalizedHeaders.includes('credit');
    const hasAmount = normalizedHeaders.includes('amount');
    const hasBalance = normalizedHeaders.includes('balance') || normalizedHeaders.includes('running balance');

    return hasDate && hasDescription && (hasDebitCredit || hasAmount) && hasBalance;
  },

  parse: (headers: string[], rows: string[][]): ParseResult => {
    const transactions: ParsedTransaction[] = [];

    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      headerMap[h.toLowerCase().trim()] = i;
    });

    const dateIdx = headerMap['date'] ?? headerMap['posted date'];
    const descIdx = headerMap['description'] ?? headerMap['memo'];
    const debitIdx = headerMap['debit'];
    const creditIdx = headerMap['credit'];
    const amountIdx = headerMap['amount'];

    for (const row of rows) {
      if (row.length < Math.max(dateIdx, descIdx, debitIdx ?? amountIdx, creditIdx ?? amountIdx) + 1) continue;

      const rawDate = row[dateIdx]?.trim();
      const description = row[descIdx]?.trim();

      if (!rawDate || !description) continue;

      // Parse date (various formats: MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD)
      let date: string;
      if (rawDate.includes('/')) {
        const dateParts = rawDate.split('/');
        if (dateParts.length !== 3) continue;
        date = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
      } else if (rawDate.includes('-') && rawDate.length === 10) {
        date = rawDate; // Already YYYY-MM-DD
      } else {
        continue;
      }

      let amount: number;
      if (debitIdx !== undefined && creditIdx !== undefined) {
        // Separate debit/credit columns
        const debit = parseFloat((row[debitIdx] || '0').replace(/[,$()]/g, '')) || 0;
        const credit = parseFloat((row[creditIdx] || '0').replace(/[,$()]/g, '')) || 0;
        amount = credit - debit; // Credit is positive, debit is negative
      } else if (amountIdx !== undefined) {
        // Single amount column
        amount = parseFloat(row[amountIdx].replace(/[,$()]/g, ''));
        // Check if it's in parentheses (negative)
        if (row[amountIdx].includes('(')) {
          amount = -Math.abs(amount);
        }
      } else {
        continue;
      }

      if (isNaN(amount)) continue;

      transactions.push({
        date,
        description,
        amount,
        rawData: row.join(','),
      });
    }

    return {
      success: true,
      transactions,
      accountType: 'bank',
      institution: 'Fifth Third Bank',
    };
  },
};
