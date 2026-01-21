'use client';

import { useState, useCallback } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { MissingStatementsTracker } from '@/components/MissingStatementsTracker';

export default function UploadPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadComplete = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Upload Statement</h1>
        <p className="text-muted-foreground mt-1">
          Import transactions from your bank or credit card statements
        </p>
      </div>
      <div className="max-w-4xl space-y-6">
        <MissingStatementsTracker refreshTrigger={refreshTrigger} />
        <FileUploader onUploadComplete={handleUploadComplete} />
      </div>
    </div>
  );
}
