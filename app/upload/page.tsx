import { FileUploader } from '@/components/FileUploader';

export default function UploadPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Upload Statement</h1>
        <p className="text-muted-foreground mt-1">
          Import transactions from your bank or credit card statements
        </p>
      </div>
      <div className="max-w-4xl">
        <FileUploader />
      </div>
    </div>
  );
}
