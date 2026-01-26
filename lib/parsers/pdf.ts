import { extractText } from 'unpdf';
import OpenAI from 'openai';
import { getCategoryNames, getUserPreferences, getAiSetting } from '../db';

export interface PDFTransaction {
  date: string;
  description: string;
  amount: number;
  category: string | null;
  subcategory: string | null;
  merchant: string | null;
  isTransfer: boolean;
  rawData: string;
}

export interface PDFParseResult {
  success: boolean;
  institution: string;
  accountType: 'credit_card' | 'bank';
  transactions: PDFTransaction[];
  statementPeriodStart?: string;
  statementPeriodEnd?: string;
  error?: string;
}

// Default categories as fallback
const DEFAULT_CATEGORIES = [
  'Income',
  'Housing',
  'Transportation',
  'Groceries',
  'Food',
  'Shopping',
  'Entertainment',
  'Health',
  'Travel',
  'Financial',
  'Subscriptions',
  'Investing',
  'Other',
];

function getAvailableCategories(): string[] {
  try {
    const dbCategories = getCategoryNames();
    return dbCategories.length > 0 ? dbCategories : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

function createOpenRouterClient(): OpenAI | null {
  const openrouterApiKey = getAiSetting('openrouter_api_key');
  if (openrouterApiKey) {
    return new OpenAI({
      apiKey: openrouterApiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://finance-tracker.local',
        'X-Title': 'Wally',
      },
    });
  }

  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return null;
}

function getModel(): string {
  return getAiSetting('model') || 'openai/gpt-5-mini';
}

/**
 * Extract text content from a PDF buffer
 */
export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  const { text } = await extractText(buffer, { mergePages: true });
  return text;
}

/**
 * Attempt to repair truncated JSON from AI responses that hit token limits.
 * Tries to close any unclosed arrays and objects to make the JSON parseable.
 */
function repairTruncatedJSON(jsonStr: string): string {
  // Remove any non-JSON prefix text (e.g., "Here is the JSON:")
  const jsonStart = jsonStr.indexOf('{');
  if (jsonStart > 0) {
    jsonStr = jsonStr.slice(jsonStart);
  }

  // Remove trailing commas before ] or } (common AI mistake)
  jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');

  // Count open brackets/braces
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escapeNext = false;

  for (const char of jsonStr) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;
  }

  // If we're in the middle of a string, close it
  if (inString) {
    jsonStr += '"';
  }

  // Remove any trailing incomplete object/value (after last complete comma)
  // Find the last complete transaction by looking for },{ or }] pattern
  const lastCompletePattern = /,\s*\{[^{}]*$/;
  if (lastCompletePattern.test(jsonStr)) {
    // Remove incomplete trailing object
    jsonStr = jsonStr.replace(lastCompletePattern, '');
  }

  // Close unclosed brackets and braces
  jsonStr += ']'.repeat(Math.max(0, openBrackets));
  jsonStr += '}'.repeat(Math.max(0, openBraces));

  return jsonStr;
}

/**
 * Parse PDF statement text using AI to extract and categorize transactions
 */
export async function parseAndCategorizePDF(text: string): Promise<PDFParseResult> {
  const openai = createOpenRouterClient();

  if (!openai) {
    return {
      success: false,
      institution: 'Unknown',
      accountType: 'bank',
      transactions: [],
      error: 'No AI API key configured. Please add your OpenRouter API key in Settings.',
    };
  }

  if (!text || text.trim().length < 50) {
    return {
      success: false,
      institution: 'Unknown',
      accountType: 'bank',
      transactions: [],
      error: 'Could not read PDF. Try a digitally-generated statement (not a scanned image).',
    };
  }

  const categories = getAvailableCategories();
  const userPreferences = getUserPreferences();
  const preferencesContext = userPreferences
    .map(p => `- ${p.instruction}`)
    .join('\n');

  const preferencesSection = preferencesContext
    ? `
USER'S CATEGORIZATION PREFERENCES (follow these exactly):
${preferencesContext}

IMPORTANT: Apply these preferences precisely. They can control:
- Categories and subcategories
- Transfer status (if marked as "transfer", set isTransfer: true)
- Merchant display names (if a preference says how to display a merchant name, use that for the "merchant" field)

If a preference includes conditions (like "above $1200" or "over $50"), ONLY apply that preference when the condition is met.
`
    : '';

  // Get current date for context
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const prompt = `You are a financial document parser. Analyze this bank/credit card statement and extract all transactions.

TODAY'S DATE: ${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}

1. First, identify the financial institution (e.g., "Chase", "American Express", "Bank of America", "Wells Fargo").
2. Determine the account type: "credit_card" or "bank" (checking/savings).
3. Extract the statement period - find the billing cycle dates (e.g., "Statement Period: Dec 2 - Jan 1" or "Billing Period: November 5, 2024 to December 4, 2024"). Return these as statementPeriodStart and statementPeriodEnd in YYYY-MM-DD format.
4. Extract ALL transactions with:
   - date: Transaction date in YYYY-MM-DD format
   - description: Original transaction description text
   - amount: Negative for expenses/charges/purchases, positive for income/credits/payments received
   - category: One of: ${categories.join(', ')}
   - subcategory: Optional, more specific categorization
   - merchant: Clean business name (e.g., "AMZN MKTP" → "Amazon", "SQ *COFFEE SHOP" → "Coffee Shop")
   - isTransfer: true if this is a transfer between accounts, credit card payment, or not real spending/income
${preferencesSection}
IMPORTANT DATE RULES:
- Two-digit years (e.g., "06/24/25") should be interpreted based on context and today's date
- Years 00-30 typically mean 2000-2030, years 31-99 typically mean 1931-1999
- A statement from "25" almost certainly means 2025, not 1925 or 2023

IMPORTANT AMOUNT RULES:
- For credit cards: purchases/charges are NEGATIVE, payments/credits are POSITIVE
- For bank accounts: withdrawals/debits are NEGATIVE, deposits/credits are POSITIVE
- Interest charges and fees are NEGATIVE

Return ONLY valid JSON in COMPACT format (minimal whitespace) like this:
{"institution":"Bank Name","accountType":"credit_card","statementPeriodStart":"2024-12-02","statementPeriodEnd":"2025-01-01","transactions":[{"date":"2024-01-15","description":"Original description","amount":-42.50,"category":"Food","subcategory":"Restaurants","merchant":"Chipotle","isTransfer":false}]}

STATEMENT TEXT:
${text.slice(0, 30000)}`;

  try {
    const model = getModel();
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a precise financial document parser. Always respond with valid JSON only, using minimal whitespace. Extract every transaction you can find in the statement. Pay attention to date formats and amount signs.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 16000,
    });

    const content = response.choices[0]?.message?.content || '';
    const finishReason = response.choices[0]?.finish_reason;

    // Extract JSON from response (handle markdown code blocks)
    // First strip any markdown code block wrappers
    let cleanContent = content.replace(/```json?\n?/g, '').replace(/```/g, '');

    let jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('PDF parsing: No JSON found in AI response. Content preview:', content.slice(0, 500));
      return {
        success: false,
        institution: 'Unknown',
        accountType: 'bank',
        transactions: [],
        error: 'AI could not parse the statement. The document may not be a supported statement format.',
      };
    }

    let jsonStr = jsonMatch[0];

    // If response was truncated due to token limit, try to repair the JSON
    if (finishReason === 'length') {
      jsonStr = repairTruncatedJSON(jsonStr);
    }

    // Try to parse, and if it fails, attempt repair and try again
    let parsed: {
      institution: string;
      accountType: 'credit_card' | 'bank';
      statementPeriodStart?: string;
      statementPeriodEnd?: string;
      transactions: Array<{
        date: string;
        description: string;
        amount: number;
        category?: string;
        subcategory?: string;
        merchant?: string;
        isTransfer?: boolean;
      }>;
    };

    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // First parse failed, try to repair and parse again
      console.log('PDF parsing: Initial JSON parse failed, attempting repair...');
      jsonStr = repairTruncatedJSON(jsonStr);
      parsed = JSON.parse(jsonStr);
    }

    parsed = parsed as {
      institution: string;
      accountType: 'credit_card' | 'bank';
      statementPeriodStart?: string;
      statementPeriodEnd?: string;
      transactions: Array<{
        date: string;
        description: string;
        amount: number;
        category?: string;
        subcategory?: string;
        merchant?: string;
        isTransfer?: boolean;
      }>;
    };

    if (!parsed.transactions || parsed.transactions.length === 0) {
      return {
        success: false,
        institution: parsed.institution || 'Unknown',
        accountType: parsed.accountType || 'bank',
        transactions: [],
        error: 'No transactions found in this document.',
      };
    }

    // Validate and normalize transactions
    const transactions: PDFTransaction[] = parsed.transactions.map((tx) => {
      // Validate category
      const category = tx.category && categories.includes(tx.category)
        ? tx.category
        : null;

      return {
        date: tx.date || '',
        description: tx.description || '',
        amount: typeof tx.amount === 'number' ? tx.amount : 0,
        category,
        subcategory: tx.subcategory || null,
        merchant: tx.merchant || null,
        isTransfer: tx.isTransfer || false,
        rawData: tx.description || '',
      };
    }).filter(tx => tx.date && tx.description); // Remove transactions missing required fields

    return {
      success: true,
      institution: parsed.institution || 'Unknown',
      accountType: parsed.accountType || 'bank',
      transactions,
      statementPeriodStart: parsed.statementPeriodStart,
      statementPeriodEnd: parsed.statementPeriodEnd,
    };
  } catch (error) {
    console.error('PDF parsing error:', error);

    if (error instanceof SyntaxError) {
      return {
        success: false,
        institution: 'Unknown',
        accountType: 'bank',
        transactions: [],
        error: 'AI response was not valid JSON. Please try again.',
      };
    }

    return {
      success: false,
      institution: 'Unknown',
      accountType: 'bank',
      transactions: [],
      error: `Failed to parse statement: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Main function to process a PDF file
 */
export async function processPDF(buffer: ArrayBuffer): Promise<PDFParseResult> {
  try {
    const text = await extractTextFromPDF(buffer);
    return await parseAndCategorizePDF(text);
  } catch (error) {
    console.error('PDF processing error:', error);

    // Check for password-protected PDF
    if (error instanceof Error && error.message.includes('password')) {
      return {
        success: false,
        institution: 'Unknown',
        accountType: 'bank',
        transactions: [],
        error: 'PDF is password protected. Please provide an unprotected statement.',
      };
    }

    return {
      success: false,
      institution: 'Unknown',
      accountType: 'bank',
      transactions: [],
      error: `Could not read PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
