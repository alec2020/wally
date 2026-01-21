import { ModelConfig } from './types';

// Models sorted by input cost (cheapest first)
export const MODELS_TO_TEST: ModelConfig[] = [
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    inputCostPer1M: 0.0005,
    outputCostPer1M: 0.003,
    notes: 'Latest Gemini, 1M context, near-Pro reasoning',
  },
  {
    id: 'openai/gpt-5-nano',
    name: 'GPT-5 Nano',
    inputCostPer1M: 0.05,
    outputCostPer1M: 0.40,
    notes: 'Cheapest OpenAI, fast classification',
  },
  {
    id: 'x-ai/grok-4.1-fast',
    name: 'Grok 4.1 Fast',
    inputCostPer1M: 0.20,
    outputCostPer1M: 0.50,
    notes: 'Latest Grok, 2M context, near-frontier',
  },
  {
    id: 'deepseek/deepseek-chat-v3.1',
    name: 'DeepSeek V3.1',
    inputCostPer1M: 0.21,
    outputCostPer1M: 0.79,
    notes: 'DeepSeek V3.1, 131K context',
  },
  {
    id: 'openai/gpt-5-mini',
    name: 'GPT-5 Mini',
    inputCostPer1M: 0.25,
    outputCostPer1M: 2.00,
    notes: 'Lightweight GPT-5 reasoning',
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3',
    inputCostPer1M: 0.32,
    outputCostPer1M: 0.89,
    notes: 'DeepSeek V3, 131K context',
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    inputCostPer1M: 0.80,
    outputCostPer1M: 4.00,
    notes: 'Latest Haiku',
  },
  {
    id: 'openai/gpt-5',
    name: 'GPT-5',
    inputCostPer1M: 1.25,
    outputCostPer1M: 10.00,
    notes: 'Full GPT-5',
  },
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    notes: 'Balanced Claude 4',
  },
];

// Evaluation settings
export const EVAL_CONFIG = {
  temperature: 0.1,          // Same as production
  maxTokens: 8000,           // Same as production
  delayBetweenModels: 5000,  // 5 seconds between models to avoid rate limits
  delayBetweenPdfs: 2000,    // 2 seconds between PDFs
};

// Test PDFs
export const TEST_PDFS = [
  '20250804-statements-3366-.pdf',
  'Apple Card Statement - November 2025.pdf',
];
