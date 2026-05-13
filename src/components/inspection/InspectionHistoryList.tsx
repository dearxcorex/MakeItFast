'use client';
import { useState } from 'react';
import type { StationInspection } from '@/types/inspection';
import { formatInspectionDate } from '@/utils/mapHelpers';
import InspectorChips from './InspectorChips';

export default function InspectionHistoryList({ history }: { history: StationInspection[] }) {
  const [open, setOpen] = useState(false);
  if (history.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
        aria-expanded={open}
      >
        <span aria-hidden>{open ? '▾' : '▸'}</span>
        History ({history.length})
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1.5">
          {history.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-1 px-2 py-1.5 rounded border border-border/40 bg-muted/20"
            >
              <span className="text-xs text-muted-foreground">
                {formatInspectionDate(row.inspectedOn)}
              </span>
              <InspectorChips lead={row.lead} helpers={row.helpers} />
              {row.notes && (
                <span className="text-xs text-muted-foreground italic">{row.notes}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
