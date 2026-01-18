import Papa from 'papaparse';
import { chaseParser } from './chase';
import { amexParser } from './amex';
import { appleCardParser } from './applecard';
import { fifthThirdParser } from './fifththird';
import { robinhoodParser } from './robinhood';
import { CSVParser, ParseResult, ParsedTransaction } from './types';

export type { ParsedTransaction, ParseResult };

const parsers: CSVParser[] = [
  chaseParser,
  amexParser,
  appleCardParser,
  robinhoodParser,
  fifthThirdParser, // Generic bank parser last as fallback
];

export interface DetectionResult {
  detected: boolean;
  parserName: string;
  institution: string;
}

export function detectCSVFormat(csvContent: string): DetectionResult {
  const result = Papa.parse(csvContent, {
    preview: 5, // Just check first few rows
    skipEmptyLines: true,
  });

  if (result.errors.length > 0 || result.data.length < 2) {
    return { detected: false, parserName: 'Unknown', institution: 'Unknown' };
  }

  const headers = result.data[0] as string[];
  const rows = result.data.slice(1) as string[][];

  for (const parser of parsers) {
    if (parser.detect(headers, rows)) {
      const parseResult = parser.parse(headers, rows);
      return {
        detected: true,
        parserName: parser.name,
        institution: parseResult.institution,
      };
    }
  }

  return { detected: false, parserName: 'Unknown', institution: 'Unknown' };
}

export function parseCSV(csvContent: string): ParseResult {
  const result = Papa.parse(csvContent, {
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    return {
      success: false,
      transactions: [],
      accountType: 'bank',
      institution: 'Unknown',
      error: `CSV parsing error: ${result.errors[0].message}`,
    };
  }

  if (result.data.length < 2) {
    return {
      success: false,
      transactions: [],
      accountType: 'bank',
      institution: 'Unknown',
      error: 'CSV file is empty or has no data rows',
    };
  }

  const headers = result.data[0] as string[];
  const rows = result.data.slice(1) as string[][];

  // Try each parser
  for (const parser of parsers) {
    if (parser.detect(headers, rows)) {
      const parseResult = parser.parse(headers, rows);
      if (parseResult.transactions.length > 0) {
        return parseResult;
      }
    }
  }

  // Try generic parsing as fallback
  return parseGenericCSV(headers, rows);
}

function parseGenericCSV(headers: string[], rows: string[][]): ParseResult {
  const transactions: ParsedTransaction[] = [];

  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerMap[h.toLowerCase().trim()] = i;
  });

  // Try to find date column
  const dateIdx = findColumn(headerMap, ['date', 'transaction date', 'trans date', 'posted date', 'post date']);
  if (dateIdx === undefined) {
    return {
      success: false,
      transactions: [],
      accountType: 'bank',
      institution: 'Unknown',
      error: 'Could not find date column in CSV',
    };
  }

  // Try to find description column
  const descIdx = findColumn(headerMap, ['description', 'memo', 'narrative', 'details', 'payee']);
  if (descIdx === undefined) {
    return {
      success: false,
      transactions: [],
      accountType: 'bank',
      institution: 'Unknown',
      error: 'Could not find description column in CSV',
    };
  }

  // Try to find amount column(s)
  const amountIdx = findColumn(headerMap, ['amount', 'transaction amount', 'value']);
  const debitIdx = findColumn(headerMap, ['debit', 'withdrawal', 'withdrawals']);
  const creditIdx = findColumn(headerMap, ['credit', 'deposit', 'deposits']);

  if (amountIdx === undefined && (debitIdx === undefined || creditIdx === undefined)) {
    return {
      success: false,
      transactions: [],
      accountType: 'bank',
      institution: 'Unknown',
      error: 'Could not find amount column(s) in CSV',
    };
  }

  for (const row of rows) {
    const rawDate = row[dateIdx]?.trim();
    const description = row[descIdx]?.trim();

    if (!rawDate || !description) continue;

    // Try to parse date
    const date = parseGenericDate(rawDate);
    if (!date) continue;

    let amount: number;
    if (amountIdx !== undefined) {
      amount = parseFloat(row[amountIdx].replace(/[,$()]/g, ''));
      if (row[amountIdx].includes('(')) {
        amount = -Math.abs(amount);
      }
    } else {
      const debit = parseFloat((row[debitIdx!] || '0').replace(/[,$()]/g, '')) || 0;
      const credit = parseFloat((row[creditIdx!] || '0').replace(/[,$()]/g, '')) || 0;
      amount = credit - debit;
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
    success: transactions.length > 0,
    transactions,
    accountType: 'bank',
    institution: 'Unknown',
    error: transactions.length === 0 ? 'No valid transactions found' : undefined,
  };
}

function findColumn(headerMap: Record<string, number>, candidates: string[]): number | undefined {
  for (const candidate of candidates) {
    if (headerMap[candidate] !== undefined) {
      return headerMap[candidate];
    }
  }
  return undefined;
}

function parseGenericDate(rawDate: string): string | null {
  // Try MM/DD/YYYY
  let match = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  }

  // Try YYYY-MM-DD
  match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return rawDate;
  }

  // Try MM-DD-YYYY
  match = rawDate.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  }

  // Try DD/MM/YYYY (European)
  // Skip this for now as it's ambiguous

  return null;
}
