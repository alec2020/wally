export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  category?: string;
  merchant?: string;
  rawData: string;
}

export interface ParseResult {
  success: boolean;
  transactions: ParsedTransaction[];
  accountType: 'credit_card' | 'bank' | 'brokerage';
  institution: string;
  error?: string;
}

export interface CSVParser {
  name: string;
  detect: (headers: string[], rows: string[][]) => boolean;
  parse: (headers: string[], rows: string[][]) => ParseResult;
}
