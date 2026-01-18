import OpenAI from 'openai';
import { getCategoryNames, getUserPreferences, getAiSetting } from './db';

// Default categories used as fallback
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

// Fetch categories from database, with fallback to defaults
function getAvailableCategories(): string[] {
  try {
    const dbCategories = getCategoryNames();
    return dbCategories.length > 0 ? dbCategories : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

const SUBCATEGORIES: Record<string, string[]> = {
  Income: ['Salary', 'Dividends', 'Interest', 'Side Income', 'Refunds'],
  Housing: ['Rent/Mortgage', 'Utilities', 'Insurance', 'Maintenance', 'Rent + Utilities'],
  Transportation: ['Gas', 'Parking', 'Public Transit', 'Rideshare', 'Car Payment', 'Insurance'],
  Groceries: ['Supermarket', 'Wholesale Club'],
  Food: ['Restaurants', 'Coffee', 'Delivery', 'Fast Food'],
  Shopping: ['Clothing', 'Electronics', 'Home Goods', 'Amazon'],
  Entertainment: ['Streaming', 'Movies', 'Games', 'Hobbies'],
  Health: ['Medical', 'Pharmacy', 'Gym', 'Personal Care'],
  Travel: ['Flights', 'Hotels', 'Vacation'],
  Financial: ['Investments', 'Fees', 'Interest Paid', 'Credit Card Payment', 'Statement Credit', 'Reimbursement'],
  Subscriptions: ['Software', 'Memberships'],
  Investing: ['Brokerage Deposit', 'Stock Purchase', '401k', 'IRA'],
  Other: ['Miscellaneous', 'Uncategorized'],
};

export interface CategorizationResult {
  category: string;
  subcategory: string | null;
  merchant: string;
  confidence: number;
  isTransfer?: boolean;
}

export interface TransactionToCategorizeto {
  description: string;
  amount: number;
  date?: string;
}

// Create OpenAI client configured for OpenRouter
function createOpenRouterClient(): OpenAI | null {
  // First try database settings (OpenRouter)
  const openrouterApiKey = getAiSetting('openrouter_api_key');
  if (openrouterApiKey) {
    return new OpenAI({
      apiKey: openrouterApiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://finance-tracker.local',
        'X-Title': 'Finance Tracker',
      },
    });
  }

  // Fallback to environment variable (legacy support)
  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return null;
}

// Get the model to use for categorization
function getModel(): string {
  return getAiSetting('model') || 'openai/gpt-4o';
}

export async function categorizeTransactions(
  transactions: TransactionToCategorizeto[]
): Promise<CategorizationResult[]> {
  const openai = createOpenRouterClient();

  // If no API key configured, fall back to rule-based categorization
  if (!openai) {
    console.log('No AI API key configured, using rule-based categorization');
    return transactions.map((tx) => categorizeWithRules(tx.description, tx.amount));
  }

  const results: CategorizationResult[] = [];
  const model = getModel();

  // Process in batches of 20 - all transactions go through AI with preferences context
  const batchSize = 20;
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);
    const batchResults = await categorizeBatchWithAI(openai, batch, model);
    results.push(...batchResults);
  }

  return results;
}

async function categorizeBatchWithAI(
  openai: OpenAI,
  transactions: TransactionToCategorizeto[],
  model: string
): Promise<CategorizationResult[]> {
  const categories = getAvailableCategories();

  const transactionList = transactions
    .map((tx, i) => `${i + 1}. "${tx.description}" - $${Math.abs(tx.amount).toFixed(2)} ${tx.amount < 0 ? '(expense)' : '(income)'}`)
    .join('\n');

  // Get user preferences as natural language instructions
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

If a preference includes conditions (like "above $1200" or "over $50"), ONLY apply that preference when the condition is met. Do not apply the preference if the amount doesn't match the condition.
`
    : '';

  const prompt = `Categorize these financial transactions. For each, provide:
1. Category (one of: ${categories.join(', ')})
2. Subcategory (optional, based on the category)
3. Clean merchant name (the recognizable business name)
4. isTransfer (true if this is a transfer between accounts, credit card payment, or similar - not true spending)
${preferencesSection}
Transactions:
${transactionList}

Respond in JSON format:
[
  {"index": 1, "category": "Food", "subcategory": "Restaurants", "merchant": "Chipotle", "confidence": 0.95, "isTransfer": false},
  ...
]

Be concise. Only return the JSON array.`;

  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are a financial transaction categorization assistant. Always respond with valid JSON only. Pay special attention to user preferences - they override default categorization rules.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || '[]';
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return transactions.map((tx) => ({
        category: 'Other',
        subcategory: 'Uncategorized',
        merchant: tx.description,
        confidence: 0,
      }));
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      index: number;
      category: string;
      subcategory?: string;
      merchant: string;
      confidence?: number;
      isTransfer?: boolean;
    }>;

    return transactions.map((tx, i) => {
      const result = parsed.find((p) => p.index === i + 1);
      if (!result) {
        return {
          category: 'Other',
          subcategory: 'Uncategorized',
          merchant: tx.description,
          confidence: 0,
        };
      }

      // Validate category against available categories
      const category = categories.includes(result.category)
        ? result.category
        : 'Other';

      return {
        category,
        subcategory: result.subcategory || null,
        merchant: result.merchant || tx.description,
        confidence: result.confidence || 0.8,
        isTransfer: result.isTransfer || false,
      };
    });
  } catch (error) {
    console.error('OpenAI categorization error:', error);
    return transactions.map((tx) => ({
      category: 'Other',
      subcategory: 'Uncategorized',
      merchant: tx.description,
      confidence: 0,
    }));
  }
}

// Fallback rule-based categorization when AI is not available
// Note: Text preferences are only applied via AI - this is a basic fallback
export function categorizeWithRules(description: string, amount: number): CategorizationResult {
  const desc = description.toLowerCase();

  // Income patterns (only true income, not credits/refunds)
  if (amount > 0) {
    if (desc.includes('payroll') || desc.includes('salary') || desc.includes('direct dep')) {
      return { category: 'Income', subcategory: 'Salary', merchant: description, confidence: 0.9 };
    }
    if (desc.includes('dividend') || desc.includes('div')) {
      return { category: 'Income', subcategory: 'Dividends', merchant: description, confidence: 0.9 };
    }
    if (desc.includes('interest') && !desc.includes('interest charge')) {
      return { category: 'Income', subcategory: 'Interest', merchant: description, confidence: 0.9 };
    }
    // Note: Refunds and credits are handled by custom rules as transfers, not income
  }

  // Expense patterns
  const patterns: Array<{ pattern: RegExp; category: string; subcategory: string; merchant?: string }> = [
    // Food
    { pattern: /starbucks|dunkin|peet|coffee/i, category: 'Food', subcategory: 'Coffee', merchant: 'Starbucks' },
    { pattern: /mcdonald|wendy|burger|taco bell|chipotle|subway|five guys/i, category: 'Food', subcategory: 'Restaurants' },
    { pattern: /doordash|uber eats|grubhub|postmates/i, category: 'Food', subcategory: 'Delivery' },
    { pattern: /kroger|safeway|whole foods|trader joe|walmart|target.*grocery|aldi|publix/i, category: 'Food', subcategory: 'Groceries' },

    // Transportation
    { pattern: /shell|exxon|mobil|chevron|gas|bp |76 /i, category: 'Transportation', subcategory: 'Gas' },
    { pattern: /uber(?! eats)|lyft/i, category: 'Transportation', subcategory: 'Rideshare' },
    { pattern: /parking|park\s/i, category: 'Transportation', subcategory: 'Parking' },

    // Shopping
    { pattern: /amazon|amzn/i, category: 'Shopping', subcategory: 'Amazon', merchant: 'Amazon' },
    { pattern: /target|walmart|costco|home depot|lowes/i, category: 'Shopping', subcategory: 'Home Goods' },
    { pattern: /apple\.com|best buy|electronics/i, category: 'Shopping', subcategory: 'Electronics' },

    // Entertainment
    { pattern: /netflix/i, category: 'Entertainment', subcategory: 'Streaming', merchant: 'Netflix' },
    { pattern: /spotify/i, category: 'Entertainment', subcategory: 'Streaming', merchant: 'Spotify' },
    { pattern: /hulu|disney\+|hbo|prime video/i, category: 'Entertainment', subcategory: 'Streaming' },
    { pattern: /amc|regal|cinema|movie/i, category: 'Entertainment', subcategory: 'Movies' },

    // Subscriptions
    { pattern: /github|notion|figma|adobe|microsoft 365|dropbox/i, category: 'Subscriptions', subcategory: 'Software' },
    { pattern: /gym|fitness|planet fitness|ymca|equinox/i, category: 'Health', subcategory: 'Gym' },

    // Housing
    { pattern: /electric|power|utility|water|gas bill|pgce|con ed/i, category: 'Housing', subcategory: 'Utilities' },
    { pattern: /rent|lease|apartment/i, category: 'Housing', subcategory: 'Rent/Mortgage' },

    // Health
    { pattern: /cvs|walgreens|pharmacy|rx/i, category: 'Health', subcategory: 'Pharmacy' },
    { pattern: /doctor|medical|health|hospital|clinic/i, category: 'Health', subcategory: 'Medical' },

    // Travel
    { pattern: /airline|united|delta|american air|southwest|jetblue/i, category: 'Travel', subcategory: 'Flights' },
    { pattern: /hotel|marriott|hilton|hyatt|airbnb/i, category: 'Travel', subcategory: 'Hotels' },

    // Financial
    { pattern: /fee|atm|overdraft|interest charge/i, category: 'Financial', subcategory: 'Fees' },
  ];

  for (const { pattern, category, subcategory, merchant } of patterns) {
    if (pattern.test(desc)) {
      return {
        category,
        subcategory,
        merchant: merchant || description,
        confidence: 0.7,
      };
    }
  }

  return {
    category: 'Other',
    subcategory: 'Uncategorized',
    merchant: description,
    confidence: 0,
  };
}
