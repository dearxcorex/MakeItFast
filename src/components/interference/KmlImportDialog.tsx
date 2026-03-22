'use client';

import { useState, useRef } from 'react';

interface KmlImportDialogProps {
  onImportComplete: () => void;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  byProvince: Record<string, number>;
}

export default function KmlImportDialog({ onImportComplete }: KmlImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [provinces, setProvinces] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (provinces.trim()) {
        formData.append('provinces', provinces.trim());
      }

      const res = await fetch('/api/interference/import-kml', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Import failed: ${res.status}`);
        return;
      }

      setResult(data);
      onImportComplete();
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setFile(null);
    setProvinces('');
    setResult(null);
    setError(null);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground hover:bg-secondary/80 transition-all flex items-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Import KML
      </button>
    );
  }

  return (
    <div className="glass-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Import KML File
        </div>
        <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* File input */}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".kml"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full px-3 py-4 rounded-lg border-2 border-dashed border-border/50 hover:border-primary/50 transition-colors text-xs text-muted-foreground text-center"
        >
          {file ? (
            <span className="text-foreground font-medium">{file.name}</span>
          ) : (
            'Click to select .kml file'
          )}
        </button>
      </div>

      {/* Province filter */}
      <div>
        <label className="text-[10px] text-muted-foreground">
          Filter provinces (comma-separated, leave empty for all)
        </label>
        <input
          type="text"
          value={provinces}
          onChange={(e) => setProvinces(e.target.value)}
          placeholder="e.g. นครราชสีมา,ชัยภูมิ,บุรีรัมย์"
          className="w-full px-2 py-1 rounded bg-input text-foreground text-xs border border-border/50"
        />
      </div>

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={!file || loading}
        className="w-full px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Importing...' : 'Import Sites'}
      </button>

      {/* Error */}
      {error && (
        <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400">
          <div className="font-medium mb-1">Import Complete</div>
          <div>Imported: {result.imported} | Skipped: {result.skipped}</div>
          {Object.keys(result.byProvince).length > 0 && (
            <div className="mt-1 text-muted-foreground">
              {Object.entries(result.byProvince).map(([p, c]) => `${p}: ${c}`).join(', ')}
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="mt-1 text-destructive">
              Errors: {result.errors.slice(0, 3).join('; ')}
              {result.errors.length > 3 && ` (+${result.errors.length - 3} more)`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
