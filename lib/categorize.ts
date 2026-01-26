import OpenAI from 'openai';
import { getCategoryNames, getUserPreferences, getAiSetting, getLiabilityPaymentRules, getLiabilities } from './db';

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

export interface CategorizationResult {
  category: string;
  merchant: string;
  confidence: number;
  isTransfer?: boolean;
  liabilityId?: number;  // ID of matching liability for debt payments
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
        'X-Title': 'Wally',
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
- Categories
- Transfer status (if marked as "transfer", set isTransfer: true)
- Merchant display names (if a preference says how to display a merchant name, use that for the "merchant" field)

If a preference includes conditions (like "above $1200" or "over $50"), ONLY apply that preference when the condition is met. Do not apply the preference if the amount doesn't match the condition.
`
    : '';

  // Get liability payment rules for debt payment detection
  const paymentRules = getLiabilityPaymentRules().filter(r => r.is_active);
  const liabilities = getLiabilities();

  let liabilitySection = '';
  if (paymentRules.length > 0) {
    const rulesContext = paymentRules.map(rule => {
      const liability = liabilities.find(l => l.id === rule.liability_id);
      const liabilityName = liability?.name || 'Unknown Debt';
      const matchCriteria = [
        rule.match_merchant ? `merchant contains "${rule.match_merchant}"` : null,
        rule.match_description ? `description contains "${rule.match_description}"` : null,
      ].filter(Boolean).join(' or ');
      return `- If ${matchCriteria}, this is a payment for "${liabilityName}" (liability_id: ${rule.liability_id})`;
    }).join('\n');

    liabilitySection = `
DEBT PAYMENT RULES (identify liability payments):
${rulesContext}

If a transaction matches a debt payment rule, include "liabilityId" in the response with the matching liability_id number.
`;
  }

  const prompt = `Categorize these financial transactions. For each, provide:
1. Category (one of: ${categories.join(', ')})
2. Clean merchant name (the recognizable business name)
3. isTransfer (true if this is a transfer between accounts, credit card payment, or similar - not true spending)
4. liabilityId (optional, only if this matches a debt payment rule below)
${preferencesSection}${liabilitySection}
Transactions:
${transactionList}

Respond in JSON format:
[
  {"index": 1, "category": "Food", "merchant": "Chipotle", "confidence": 0.95, "isTransfer": false},
  {"index": 2, "category": "Financial", "merchant": "Wells Fargo", "confidence": 0.95, "isTransfer": false, "liabilityId": 1},
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
        merchant: tx.description,
        confidence: 0,
      }));
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      index: number;
      category: string;
      merchant: string;
      confidence?: number;
      isTransfer?: boolean;
      liabilityId?: number;
    }>;

    return transactions.map((tx, i) => {
      const result = parsed.find((p) => p.index === i + 1);
      if (!result) {
        return {
          category: 'Other',
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
        merchant: result.merchant || tx.description,
        confidence: result.confidence || 0.8,
        isTransfer: result.isTransfer || false,
        liabilityId: result.liabilityId,
      };
    });
  } catch (error) {
    console.error('OpenAI categorization error:', error);
    return transactions.map((tx) => ({
      category: 'Other',
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
      return { category: 'Income', merchant: description, confidence: 0.9 };
    }
    if (desc.includes('dividend') || desc.includes('div')) {
      return { category: 'Income', merchant: description, confidence: 0.9 };
    }
    if (desc.includes('interest') && !desc.includes('interest charge')) {
      return { category: 'Income', merchant: description, confidence: 0.9 };
    }
    // Note: Refunds and credits are handled by custom rules as transfers, not income
  }

  // Expense patterns
  const patterns: Array<{ pattern: RegExp; category: string; merchant?: string }> = [
    // Food
    { pattern: /starbucks|dunkin|peet|coffee/i, category: 'Food', merchant: 'Starbucks' },
    { pattern: /mcdonald|wendy|burger|taco bell|chipotle|subway|five guys/i, category: 'Food' },
    { pattern: /doordash|uber eats|grubhub|postmates/i, category: 'Food' },
    { pattern: /kroger|safeway|whole foods|trader joe|walmart|target.*grocery|aldi|publix/i, category: 'Food' },

    // Transportation
    { pattern: /shell|exxon|mobil|chevron|gas|bp |76 /i, category: 'Transportation' },
    { pattern: /uber(?! eats)|lyft/i, category: 'Transportation' },
    { pattern: /parking|park\s/i, category: 'Transportation' },

    // Shopping
    { pattern: /amazon|amzn/i, category: 'Shopping', merchant: 'Amazon' },
    { pattern: /target|walmart|costco|home depot|lowes/i, category: 'Shopping' },
    { pattern: /apple\.com|best buy|electronics/i, category: 'Shopping' },

    // Entertainment
    { pattern: /netflix/i, category: 'Entertainment', merchant: 'Netflix' },
    { pattern: /spotify/i, category: 'Entertainment', merchant: 'Spotify' },
    { pattern: /hulu|disney\+|hbo|prime video/i, category: 'Entertainment' },
    { pattern: /amc|regal|cinema|movie/i, category: 'Entertainment' },

    // Subscriptions
    { pattern: /github|notion|figma|adobe|microsoft 365|dropbox/i, category: 'Subscriptions' },
    { pattern: /gym|fitness|planet fitness|ymca|equinox/i, category: 'Health' },

    // Housing
    { pattern: /electric|power|utility|water|gas bill|pgce|con ed/i, category: 'Housing' },
    { pattern: /rent|lease|apartment/i, category: 'Housing' },

    // Health
    { pattern: /cvs|walgreens|pharmacy|rx/i, category: 'Health' },
    { pattern: /doctor|medical|health|hospital|clinic/i, category: 'Health' },

    // Travel
    { pattern: /airline|united|delta|american air|southwest|jetblue/i, category: 'Travel' },
    { pattern: /hotel|marriott|hilton|hyatt|airbnb/i, category: 'Travel' },

    // Financial
    { pattern: /fee|atm|overdraft|interest charge/i, category: 'Financial' },
  ];

  for (const { pattern, category, merchant } of patterns) {
    if (pattern.test(desc)) {
      return {
        category,
        merchant: merchant || description,
        confidence: 0.7,
      };
    }
  }

  return {
    category: 'Other',
    merchant: description,
    confidence: 0,
  };
}
