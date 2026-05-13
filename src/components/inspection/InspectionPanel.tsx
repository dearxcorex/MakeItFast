'use client';
import { useState } from 'react';
import type { StationInspection } from '@/types/inspection';
import InspectionHistoryList from './InspectionHistoryList';
import InspectionLatest from './InspectionLatest';
import NewInspectionForm, { type InspectorOption } from './NewInspectionForm';

interface Props {
  stationId: number;
  history: StationInspection[];
  currentUser: { id: number; displayName: string };
  inspectors: InspectorOption[];
  onCreate: (input: {
    stationId: number;
    inspectedOn: string;
    helperUserIds: number[];
    notes?: string;
  }) => Promise<void>;
}

export default function InspectionPanel({
  stationId, history, currentUser, inspectors, onCreate,
}: Props) {
  const [recording, setRecording] = useState(false);
  const latest = history[0] ?? null;
  const rest = history.slice(1);

  return (
    <div className="mt-2 p-2 rounded-lg border border-border/50 bg-muted/10 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">Inspection</span>
        {!recording && (
          <button
            type="button"
            onClick={() => setRecording(true)}
            className="px-3 py-1.5 text-xs rounded-md font-medium bg-secondary text-secondary-foreground hover:bg-accent"
          >
            + Record inspection
          </button>
        )}
      </div>

      <InspectionLatest latest={latest} />

      {rest.length > 0 && <InspectionHistoryList history={rest} />}

      {recording && (
        <NewInspectionForm
          currentUserId={currentUser.id}
          currentUserDisplayName={currentUser.displayName}
          inspectors={inspectors}
          onCancel={() => setRecording(false)}
          onSubmit={async (input) => {
            await onCreate({ stationId, ...input });
            setRecording(false);
          }}
        />
      )}
    </div>
  );
}
