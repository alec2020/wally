'use client';

import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TransactionPreviewTable, PreviewTransaction } from './TransactionPreviewTable';

interface Account {
  id: number;
  name: string;
  type: string;
  institution: string | null;
}

interface PreviewResult {
  detected: boolean;
  institution: string;
  parserName: string;
  success: boolean;
  error?: string;
  transactionCount: number;
  duplicateCount: number;
  transactions: PreviewTransaction[];
  accountType: string;
  statementPeriodStart?: string;
  statementPeriodEnd?: string;
}

interface UploadResult {
  success: boolean;
  message: string;
  imported: number;
  accountId: number;
  institution: string;
}

type UploadStage = 'idle' | 'parsing' | 'categorizing' | 'ready' | 'uploading';

interface FileUploaderProps {
  onUploadComplete?: () => void;
}

export function FileUploader({ onUploadComplete }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [transactions, setTransactions] = useState<PreviewTransaction[]>([]);
  const [stage, setStage] = useState<UploadStage>('idle');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [newAccountName, setNewAccountName] = useState('');
  const [showNewAccountInput, setShowNewAccountInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing accounts on mount
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const response = await fetch('/api/accounts');
        const data = await response.json();
        setAccounts(data.accounts || []);
      } catch (err) {
        console.error('Failed to fetch accounts:', err);
      }
    }
    fetchAccounts();
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setError(null);
    setUploadResult(null);
    setPreview(null);
    setTransactions([]);
    setStage('parsing');

    // Preview and categorize the file
    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      setStage('categorizing');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

      const response = await fetch('/api/upload', {
        method: 'PUT',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to preview file');
        setStage('idle');
        return;
      }

      setPreview(data);
      setTransactions(data.transactions || []);
      setStage('ready');

      // Try to auto-select an existing account based on detected institution
      if (data.institution && data.institution !== 'Unknown') {
        const matchingAccount = accounts.find(
          a => a.name.toLowerCase().includes(data.institution.toLowerCase()) ||
               a.institution?.toLowerCase() === data.institution.toLowerCase()
        );
        if (matchingAccount) {
          setSelectedAccountId(matchingAccount.id.toString());
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError('Failed to preview file');
      }
      setStage('idle');
    }
  }, [accounts]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleUpload = async () => {
    if (!preview || transactions.length === 0) return;

    // Require account selection
    if (!selectedAccountId && !newAccountName) {
      setError('Please select an account or create a new one');
      return;
    }

    setStage('uploading');
    setError(null);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions,
          accountId: selectedAccountId && selectedAccountId !== 'new' ? selectedAccountId : undefined,
          accountName: newAccountName || undefined,
          accountType: preview.accountType,
          institution: preview.institution,
          statementPeriodStart: preview.statementPeriodStart,
          statementPeriodEnd: preview.statementPeriodEnd,
          filename: file?.name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to upload file');
        setStage('ready');
        return;
      }

      setUploadResult(data);
      setFile(null);
      setPreview(null);
      setTransactions([]);
      setStage('idle');
      onUploadComplete?.();
    } catch (err) {
      setError('Failed to upload file');
      setStage('ready');
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setTransactions([]);
    setUploadResult(null);
    setError(null);
    setSelectedAccountId('');
    setNewAccountName('');
    setShowNewAccountInput(false);
    setStage('idle');
  };

  const handleAccountChange = (value: string) => {
    setSelectedAccountId(value);
    if (value === 'new') {
      setShowNewAccountInput(true);
    } else {
      setShowNewAccountInput(false);
      setNewAccountName('');
    }
  };

  // Count uncategorized transactions
  const uncategorizedCount = transactions.filter(tx => !tx.category).length;

  if (uploadResult) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle className="h-16 w-16 text-emerald-600 dark:text-emerald-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Upload Complete!</h3>
          <p className="text-muted-foreground mb-4">
            Imported {uploadResult.imported} transactions
          </p>
          <Button onClick={reset}>Upload Another File</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Statement</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragActive
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-border hover:border-foreground/30',
              stage !== 'idle' && 'pointer-events-none opacity-50'
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            {isDragActive ? (
              <p className="text-emerald-600 dark:text-emerald-500">Drop your statement here...</p>
            ) : (
              <>
                <p className="text-muted-foreground mb-2">
                  Drag and drop your bank or credit card statement
                </p>
                <p className="text-sm text-muted-foreground">
                  PDF statements (recommended) or CSV exports
                </p>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading State */}
      {(stage === 'parsing' || stage === 'categorizing') && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-emerald-600 dark:text-emerald-500" />
              <Sparkles className="h-5 w-5 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <h3 className="text-lg font-semibold mt-4">
              Analyzing statement...
            </h3>
            <p className="text-muted-foreground text-sm mt-1">
              Extracting and categorizing transactions
            </p>
          </CardContent>
        </Card>
      )}

      {/* Preview with editable transactions */}
      {(stage === 'ready' || stage === 'uploading') && preview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Review Transactions: {file?.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary badges */}
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={preview.detected ? 'default' : 'secondary'}>
                {preview.detected ? preview.parserName : 'Unknown Format'}
              </Badge>
              <Badge variant="outline">{preview.accountType}</Badge>
              <span className="text-sm text-muted-foreground">
                {transactions.length} transactions to import
              </span>
              {preview.duplicateCount > 0 && (
                <span className="text-sm text-amber-600">
                  {preview.duplicateCount} duplicates excluded
                </span>
              )}
              {uncategorizedCount > 0 && (
                <Badge variant="outline" className="border-amber-500 text-amber-600">
                  {uncategorizedCount} uncategorized
                </Badge>
              )}
            </div>

            {/* Account selection */}
            <div className="space-y-2">
              <Label>Import to Account</Label>
              <Select value={selectedAccountId} onValueChange={handleAccountChange}>
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue placeholder="Select an account..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Create new account
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {showNewAccountInput && (
                <Input
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="e.g., Chase Sapphire, Amex Gold"
                  className="w-full md:w-[300px]"
                  autoFocus
                />
              )}
            </div>

            {/* Editable transaction table */}
            {transactions.length > 0 && (
              <TransactionPreviewTable
                transactions={transactions}
                onTransactionsChange={setTransactions}
              />
            )}

            {/* Action buttons */}
            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Review categories above before importing. You can change any category by clicking on it.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={reset}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={stage === 'uploading' || transactions.length === 0}
                >
                  {stage === 'uploading' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Import {transactions.length} Transactions
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
