'use client';
import { useMemo, useState } from 'react';

export interface InspectorOption {
  id: number;
  username: string;
  displayName: string;
}

interface Props {
  currentUserId: number;
  currentUserDisplayName: string;
  inspectors: InspectorOption[];
  onCancel: () => void;
  onSubmit: (input: {
    inspectedOn: string;
    helperUserIds: number[];
    notes?: string;
  }) => Promise<void>;
}

export default function NewInspectionForm({
  currentUserId,
  currentUserDisplayName,
  inspectors,
  onCancel,
  onSubmit,
}: Props) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [inspectedOn, setInspectedOn] = useState(today);
  const [helperIds, setHelperIds] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const helperOptions = inspectors.filter((u) => u.id !== currentUserId);

  function toggleHelper(id: number) {
    setHelperIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        inspectedOn,
        helperUserIds: [...helperIds],
        notes: notes.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 p-2 rounded border border-border bg-muted/10 space-y-2">
      <label className="block">
        <span className="text-xs font-medium text-foreground">วันที่ตรวจ</span>
        <input
          type="date"
          value={inspectedOn}
          max={today}
          onChange={(e) => setInspectedOn(e.target.value)}
          required
          className="mt-1 block w-full text-sm rounded border border-border bg-background px-2 py-1"
          aria-label="วันที่ตรวจ"
        />
      </label>

      <div>
        <span className="text-xs font-medium text-foreground">หัวหน้าทีม</span>
        <p className="text-xs text-muted-foreground mt-0.5">
          {currentUserDisplayName} (คุณ)
        </p>
      </div>

      {helperOptions.length > 0 && (
        <fieldset>
          <legend className="text-xs font-medium text-foreground">ผู้ร่วมตรวจ</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {helperOptions.map((u) => (
              <label key={u.id} className="inline-flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={helperIds.has(u.id)}
                  onChange={() => toggleHelper(u.id)}
                  aria-label={u.displayName}
                />
                <span>{u.displayName}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="block">
        <span className="text-xs font-medium text-foreground">หมายเหตุ</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 block w-full text-xs rounded border border-border bg-background px-2 py-1"
          aria-label="หมายเหตุ"
        />
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-3 py-1.5 text-xs rounded-md bg-muted text-muted-foreground hover:bg-accent"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {submitting ? '...' : 'บันทึก'}
        </button>
      </div>
    </form>
  );
}
