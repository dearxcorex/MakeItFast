'use client';

import { useState, useRef } from 'react';

interface ImportDialogProps {
  onClose: () => void;
  onImportComplete: () => void;
}

export default function ImportDialog({ onClose, onImportComplete }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; imported?: number; error?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/interference/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setResult({ success: true, imported: data.imported });
        setTimeout(() => onImportComplete(), 1500);
      } else {
        setResult({ success: false, error: data.error });
      }
    } catch (error) {
      setResult({ success: false, error: String(error) });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card rounded-2xl p-6 w-full max-w-md mx-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg gradient-text">Import Interference Data</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Upload a CSV or Excel file containing interference site data. This will replace all existing records.
        </p>

        {/* File input */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          {file ? (
            <div>
              <div className="text-sm font-medium text-foreground">{file.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {(file.size / 1024).toFixed(1)} KB
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Click to select CSV or Excel file
            </div>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className={`p-3 rounded-lg text-sm ${
            result.success
              ? 'bg-green-500/10 text-green-500 border border-green-500/20'
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}>
            {result.success
              ? `Successfully imported ${result.imported} records`
              : `Error: ${result.error}`}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
