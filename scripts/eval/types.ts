// Ground truth transaction from database
export interface GroundTruthTransaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  subcategory: string | null;
  merchant: string | null;
  is_transfer: boolean;
  raw_data: string | null;
}

// AI-generated transaction from model
export interface AITransaction {
  date: string;
  description: string;
  amount: number;
  category: string | null;
  subcategory: string | null;
  merchant: string | null;
  isTransfer: boolean;
}

// Result of matching AI transaction to ground truth
export interface MatchedTransaction {
  groundTruth: GroundTruthTransaction;
  aiResult: AITransaction | null;
  categoryMatch: boolean;
  transferMatch: boolean;
  primaryMatch: boolean; // category AND is_transfer both correct
}

// Model configuration
export interface ModelConfig {
  id: string;
  name: string;
  inputCostPer1M: number;  // $ per 1M input tokens
  outputCostPer1M: number; // $ per 1M output tokens
  notes: string;
}

// Result of evaluating a single model on a single PDF
export interface PDFEvalResult {
  pdfName: string;
  transactionsFound: number;
  transactionsMatched: number;
  categoryCorrect: number;
  transferCorrect: number;
  primaryCorrect: number; // both category AND transfer correct
  categoryAccuracy: number;
  transferAccuracy: number;
  primaryAccuracy: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  error?: string;
}

// Result of evaluating a single model across all PDFs
export interface ModelEvalResult {
  model: ModelConfig;
  pdfResults: PDFEvalResult[];
  totalTransactionsMatched: number;
  overallCategoryAccuracy: number;
  overallTransferAccuracy: number;
  overallPrimaryAccuracy: number; // what we care about
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  totalLatencyMs: number;
}

// Final evaluation report
export interface EvalReport {
  runDate: string;
  pdfsEvaluated: string[];
  groundTruthCount: number;
  modelResults: ModelEvalResult[];
  recommendation: {
    modelId: string;
    modelName: string;
    primaryAccuracy: number;
    estimatedCost: number;
    reason: string;
  } | null;
}
