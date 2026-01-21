import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { extractTextFromPDF } from '../../lib/parsers/pdf';
import { getTransactions, getUserPreferences, getAiSetting, getCategoryNames } from '../../lib/db';
import { MODELS_TO_TEST, EVAL_CONFIG, TEST_PDFS } from './config';
import {
  GroundTruthTransaction,
  AITransaction,
  MatchedTransaction,
  ModelConfig,
  PDFEvalResult,
  ModelEvalResult,
  EvalReport,
} from './types';

// Default categories as fallback
const DEFAULT_CATEGORIES = [
  'Income', 'Housing', 'Transportation', 'Groceries', 'Food',
  'Shopping', 'Entertainment', 'Health', 'Travel', 'Financial',
  'Subscriptions', 'Investing', 'Other',
];

function getAvailableCategories(): string[] {
  try {
    const dbCategories = getCategoryNames();
    return dbCategories.length > 0 ? dbCategories : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

function createOpenRouterClient(): OpenAI {
  const openrouterApiKey = getAiSetting('openrouter_api_key');
  if (!openrouterApiKey) {
    throw new Error('No OpenRouter API key found in database. Please add it in Settings.');
  }
  return new OpenAI({
    apiKey: openrouterApiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://finance-tracker.local',
      'X-Title': 'Finance Tracker Eval',
    },
  });
}

function buildPrompt(text: string): string {
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

  return `You are a financial document parser. Analyze this bank/credit card statement and extract all transactions.

1. First, identify the financial institution (e.g., "Chase", "American Express", "Bank of America", "Wells Fargo").
2. Determine the account type: "credit_card" or "bank" (checking/savings).
3. Extract ALL transactions with:
   - date: Transaction date in YYYY-MM-DD format
   - description: Original transaction description text
   - amount: Negative for expenses/charges/purchases, positive for income/credits/payments received
   - category: One of: ${categories.join(', ')}
   - subcategory: Optional, more specific categorization
   - merchant: Clean business name (e.g., "AMZN MKTP" → "Amazon", "SQ *COFFEE SHOP" → "Coffee Shop")
   - isTransfer: true if this is a transfer between accounts, credit card payment, or not real spending/income
${preferencesSection}
IMPORTANT AMOUNT RULES:
- For credit cards: purchases/charges are NEGATIVE, payments/credits are POSITIVE
- For bank accounts: withdrawals/debits are NEGATIVE, deposits/credits are POSITIVE
- Interest charges and fees are NEGATIVE

Return ONLY valid JSON in this exact format:
{
  "institution": "Bank Name",
  "accountType": "credit_card",
  "transactions": [
    {
      "date": "2024-01-15",
      "description": "Original description from statement",
      "amount": -42.50,
      "category": "Food",
      "subcategory": "Restaurants",
      "merchant": "Chipotle",
      "isTransfer": false
    }
  ]
}

STATEMENT TEXT:
${text.slice(0, 30000)}`;
}

async function runModelOnPdf(
  client: OpenAI,
  model: ModelConfig,
  pdfText: string
): Promise<{
  transactions: AITransaction[];
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  error?: string;
}> {
  const prompt = buildPrompt(pdfText);
  const startTime = Date.now();

  try {
    const response = await client.chat.completions.create({
      model: model.id,
      messages: [
        {
          role: 'system',
          content: 'You are a precise financial document parser. Always respond with valid JSON only. Extract every transaction you can find in the statement. Pay attention to date formats and amount signs.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: EVAL_CONFIG.temperature,
      max_tokens: EVAL_CONFIG.maxTokens,
    });

    const latencyMs = Date.now() - startTime;
    const content = response.choices[0]?.message?.content || '';
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        transactions: [],
        inputTokens,
        outputTokens,
        latencyMs,
        error: 'No JSON found in response',
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
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

    const transactions: AITransaction[] = (parsed.transactions || []).map(tx => ({
      date: tx.date || '',
      description: tx.description || '',
      amount: typeof tx.amount === 'number' ? tx.amount : 0,
      category: tx.category || null,
      subcategory: tx.subcategory || null,
      merchant: tx.merchant || null,
      isTransfer: tx.isTransfer || false,
    })).filter(tx => tx.date && tx.description);

    return { transactions, inputTokens, outputTokens, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return {
      transactions: [],
      inputTokens: 0,
      outputTokens: 0,
      latencyMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function matchTransactions(
  groundTruth: GroundTruthTransaction[],
  aiResults: AITransaction[]
): MatchedTransaction[] {
  const matched: MatchedTransaction[] = [];
  const usedAiIndices = new Set<number>();

  for (const gt of groundTruth) {
    let bestMatch: AITransaction | null = null;
    let bestMatchIndex = -1;
    let bestScore = 0;

    for (let i = 0; i < aiResults.length; i++) {
      if (usedAiIndices.has(i)) continue;

      const ai = aiResults[i];
      let score = 0;

      // Date match (exact)
      if (ai.date === gt.date) score += 10;

      // Amount match (within $0.01)
      if (Math.abs(ai.amount - gt.amount) < 0.02) score += 10;

      // Description similarity (substring match)
      const gtDesc = gt.description.toLowerCase();
      const aiDesc = ai.description.toLowerCase();
      if (gtDesc.includes(aiDesc) || aiDesc.includes(gtDesc)) score += 5;
      else if (gtDesc.split(' ').some(w => aiDesc.includes(w))) score += 2;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = ai;
        bestMatchIndex = i;
      }
    }

    // Require at least date AND amount match (score >= 20)
    if (bestScore >= 20 && bestMatchIndex >= 0) {
      usedAiIndices.add(bestMatchIndex);

      const categoryMatch = bestMatch!.category === gt.category;
      const transferMatch = bestMatch!.isTransfer === Boolean(gt.is_transfer);

      matched.push({
        groundTruth: gt,
        aiResult: bestMatch,
        categoryMatch,
        transferMatch,
        primaryMatch: categoryMatch && transferMatch,
      });
    } else {
      // No match found
      matched.push({
        groundTruth: gt,
        aiResult: null,
        categoryMatch: false,
        transferMatch: false,
        primaryMatch: false,
      });
    }
  }

  return matched;
}

function calculateCost(model: ModelConfig, inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * model.inputCostPer1M;
  const outputCost = (outputTokens / 1_000_000) * model.outputCostPer1M;
  return inputCost + outputCost;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('='.repeat(60));
  console.log('AI Model Evaluation for Finance Tracker');
  console.log('='.repeat(60));
  console.log();

  // Validate PDFs exist
  const projectRoot = process.cwd();
  const pdfPaths: { name: string; path: string }[] = [];

  for (const pdfName of TEST_PDFS) {
    const pdfPath = path.join(projectRoot, pdfName);
    if (!fs.existsSync(pdfPath)) {
      console.error(`Error: PDF not found: ${pdfPath}`);
      process.exit(1);
    }
    pdfPaths.push({ name: pdfName, path: pdfPath });
  }

  console.log(`Found ${pdfPaths.length} test PDFs`);

  // Load ground truth from database
  const allTransactions = getTransactions() as GroundTruthTransaction[];
  console.log(`Loaded ${allTransactions.length} transactions from database as ground truth`);
  console.log();

  // Extract text from all PDFs
  console.log('Extracting text from PDFs...');
  const pdfTexts: { name: string; text: string }[] = [];

  for (const pdf of pdfPaths) {
    const buffer = fs.readFileSync(pdf.path);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const text = await extractTextFromPDF(arrayBuffer);
    pdfTexts.push({ name: pdf.name, text });
    console.log(`  - ${pdf.name}: ${text.length} chars extracted`);
  }
  console.log();

  // Create OpenRouter client
  const client = createOpenRouterClient();

  // Results storage
  const modelResults: ModelEvalResult[] = [];

  // Run evaluation for each model
  for (let i = 0; i < MODELS_TO_TEST.length; i++) {
    const model = MODELS_TO_TEST[i];
    console.log(`[${i + 1}/${MODELS_TO_TEST.length}] Testing: ${model.name} (${model.id})`);
    console.log(`  Pricing: $${model.inputCostPer1M}/1M in, $${model.outputCostPer1M}/1M out`);

    const pdfResults: PDFEvalResult[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalLatencyMs = 0;
    let totalMatched = 0;
    let totalCategoryCorrect = 0;
    let totalTransferCorrect = 0;
    let totalPrimaryCorrect = 0;

    for (const pdf of pdfTexts) {
      process.stdout.write(`  Processing ${pdf.name}... `);

      const result = await runModelOnPdf(client, model, pdf.text);

      if (result.error) {
        console.log(`ERROR: ${result.error}`);
        pdfResults.push({
          pdfName: pdf.name,
          transactionsFound: 0,
          transactionsMatched: 0,
          categoryCorrect: 0,
          transferCorrect: 0,
          primaryCorrect: 0,
          categoryAccuracy: 0,
          transferAccuracy: 0,
          primaryAccuracy: 0,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          latencyMs: result.latencyMs,
          error: result.error,
        });
        continue;
      }

      // Match AI results to ground truth
      const matched = matchTransactions(allTransactions, result.transactions);
      const matchedWithAi = matched.filter(m => m.aiResult !== null);

      const categoryCorrect = matchedWithAi.filter(m => m.categoryMatch).length;
      const transferCorrect = matchedWithAi.filter(m => m.transferMatch).length;
      const primaryCorrect = matchedWithAi.filter(m => m.primaryMatch).length;

      const pdfResult: PDFEvalResult = {
        pdfName: pdf.name,
        transactionsFound: result.transactions.length,
        transactionsMatched: matchedWithAi.length,
        categoryCorrect,
        transferCorrect,
        primaryCorrect,
        categoryAccuracy: matchedWithAi.length > 0 ? (categoryCorrect / matchedWithAi.length) * 100 : 0,
        transferAccuracy: matchedWithAi.length > 0 ? (transferCorrect / matchedWithAi.length) * 100 : 0,
        primaryAccuracy: matchedWithAi.length > 0 ? (primaryCorrect / matchedWithAi.length) * 100 : 0,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs: result.latencyMs,
      };

      pdfResults.push(pdfResult);
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
      totalLatencyMs += result.latencyMs;
      totalMatched += matchedWithAi.length;
      totalCategoryCorrect += categoryCorrect;
      totalTransferCorrect += transferCorrect;
      totalPrimaryCorrect += primaryCorrect;

      console.log(`${matchedWithAi.length} matched, ${pdfResult.primaryAccuracy.toFixed(1)}% primary accuracy`);

      // Delay between PDFs
      if (pdfTexts.indexOf(pdf) < pdfTexts.length - 1) {
        await sleep(EVAL_CONFIG.delayBetweenPdfs);
      }
    }

    const estimatedCost = calculateCost(model, totalInputTokens, totalOutputTokens);

    const modelResult: ModelEvalResult = {
      model,
      pdfResults,
      totalTransactionsMatched: totalMatched,
      overallCategoryAccuracy: totalMatched > 0 ? (totalCategoryCorrect / totalMatched) * 100 : 0,
      overallTransferAccuracy: totalMatched > 0 ? (totalTransferCorrect / totalMatched) * 100 : 0,
      overallPrimaryAccuracy: totalMatched > 0 ? (totalPrimaryCorrect / totalMatched) * 100 : 0,
      totalInputTokens,
      totalOutputTokens,
      estimatedCost,
      totalLatencyMs,
    };

    modelResults.push(modelResult);

    console.log(`  Overall: ${modelResult.overallPrimaryAccuracy.toFixed(1)}% primary accuracy, $${estimatedCost.toFixed(6)} cost`);
    console.log();

    // Delay between models
    if (i < MODELS_TO_TEST.length - 1) {
      console.log(`  Waiting ${EVAL_CONFIG.delayBetweenModels / 1000}s before next model...`);
      await sleep(EVAL_CONFIG.delayBetweenModels);
    }
  }

  // Generate report
  console.log('='.repeat(60));
  console.log('EVALUATION RESULTS');
  console.log('='.repeat(60));
  console.log();

  // Sort by primary accuracy (desc), then by cost (asc)
  const sortedResults = [...modelResults].sort((a, b) => {
    if (b.overallPrimaryAccuracy !== a.overallPrimaryAccuracy) {
      return b.overallPrimaryAccuracy - a.overallPrimaryAccuracy;
    }
    return a.estimatedCost - b.estimatedCost;
  });

  // Print table
  console.log('| Model                      | Primary Acc | Cat Acc | Transfer Acc | Cost      | Latency |');
  console.log('|----------------------------|-------------|---------|--------------|-----------|---------|');

  for (const result of sortedResults) {
    const name = result.model.name.padEnd(26);
    const primaryAcc = `${result.overallPrimaryAccuracy.toFixed(1)}%`.padStart(11);
    const catAcc = `${result.overallCategoryAccuracy.toFixed(1)}%`.padStart(7);
    const transferAcc = `${result.overallTransferAccuracy.toFixed(1)}%`.padStart(12);
    const cost = `$${result.estimatedCost.toFixed(6)}`.padStart(9);
    const latency = `${(result.totalLatencyMs / 1000).toFixed(1)}s`.padStart(7);
    console.log(`| ${name} | ${primaryAcc} | ${catAcc} | ${transferAcc} | ${cost} | ${latency} |`);
  }

  console.log();

  // Find recommendation: cheapest model with 100% primary accuracy
  const perfectModels = sortedResults.filter(r => r.overallPrimaryAccuracy === 100);
  let recommendation: EvalReport['recommendation'] = null;

  if (perfectModels.length > 0) {
    // Sort by cost ascending
    perfectModels.sort((a, b) => a.estimatedCost - b.estimatedCost);
    const best = perfectModels[0];
    recommendation = {
      modelId: best.model.id,
      modelName: best.model.name,
      primaryAccuracy: best.overallPrimaryAccuracy,
      estimatedCost: best.estimatedCost,
      reason: `Cheapest model with 100% accuracy. Cost: $${best.estimatedCost.toFixed(6)} per eval run.`,
    };
    console.log('RECOMMENDATION:');
    console.log(`  ${best.model.name} (${best.model.id})`);
    console.log(`  100% primary accuracy at $${best.estimatedCost.toFixed(6)} per evaluation`);
  } else {
    // No perfect model, recommend the highest accuracy
    const best = sortedResults[0];
    recommendation = {
      modelId: best.model.id,
      modelName: best.model.name,
      primaryAccuracy: best.overallPrimaryAccuracy,
      estimatedCost: best.estimatedCost,
      reason: `Highest accuracy model (${best.overallPrimaryAccuracy.toFixed(1)}%). No model achieved 100% accuracy.`,
    };
    console.log('RECOMMENDATION:');
    console.log(`  ${best.model.name} (${best.model.id})`);
    console.log(`  ${best.overallPrimaryAccuracy.toFixed(1)}% primary accuracy (no model achieved 100%)`);
  }

  console.log();

  // Save report to file
  const report: EvalReport = {
    runDate: new Date().toISOString(),
    pdfsEvaluated: TEST_PDFS,
    groundTruthCount: allTransactions.length,
    modelResults: sortedResults,
    recommendation,
  };

  const outputDir = path.join(projectRoot, 'eval-results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = path.join(outputDir, `eval-${timestamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`Report saved to: ${outputPath}`);
}

main().catch(err => {
  console.error('Evaluation failed:', err);
  process.exit(1);
});
