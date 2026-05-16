// src/components/field-ops/FieldOpsInspectionPanel.tsx
'use client';
import { useMemo, useState } from 'react';
import type { StationInspection } from '@/types/inspection';
import { formatInspectionDate } from '@/utils/mapHelpers';

export interface InspectorOption {
  id: number;
  username: string;
  displayName: string;
}

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

const wrapperStyle: React.CSSProperties = {
  border: '1px solid var(--fo-rail-border)',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.02)',
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--fo-mono)',
  fontSize: 10,
  letterSpacing: 0.6,
  color: 'var(--fo-accent)',
};

const muteStyle: React.CSSProperties = {
  fontFamily: 'var(--fo-mono)',
  fontSize: 10,
  letterSpacing: 0.5,
  color: 'var(--fo-rail-mute)',
};

const leadChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 10px',
  borderRadius: 999,
  background: 'var(--fo-accent)',
  color: 'var(--fo-rail-bg)',
  fontSize: 12,
  fontWeight: 700,
};

const helperChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 999,
  border: '1px solid var(--fo-rail-border)',
  color: 'var(--fo-rail-mute)',
  fontSize: 11,
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--fo-accent)',
  color: 'var(--fo-rail-bg)',
  fontFamily: 'var(--fo-mono)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.4,
  cursor: 'pointer',
};

const ghostBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid var(--fo-rail-border)',
  background: 'transparent',
  color: 'var(--fo-rail-text)',
  fontFamily: 'var(--fo-mono)',
  fontSize: 11,
  letterSpacing: 0.4,
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid var(--fo-rail-border)',
  background: 'var(--fo-rail-bg)',
  color: 'var(--fo-rail-text)',
  fontFamily: 'var(--fo-body)',
  fontSize: 13,
};

function Chips({
  lead,
  helpers,
}: {
  lead: StationInspection['lead'];
  helpers: StationInspection['helpers'];
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      <span style={{ ...muteStyle, marginRight: 2 }}>ผู้ตรวจ:</span>
      <span style={leadChipStyle} title={`Lead: ${lead.displayName}`}>
        <span aria-hidden>★</span>
        {lead.displayName}
      </span>
      {helpers.map((h) => (
        <span key={h.userId} style={helperChipStyle} title={`Helper: ${h.displayName}`}>
          {h.displayName}
        </span>
      ))}
    </div>
  );
}

function FieldOpsNewInspectionForm({
  currentUser,
  inspectors,
  onCancel,
  onSubmit,
}: {
  currentUser: { id: number; displayName: string };
  inspectors: InspectorOption[];
  onCancel: () => void;
  onSubmit: (input: {
    inspectedOn: string;
    helperUserIds: number[];
    notes?: string;
  }) => Promise<void>;
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [inspectedOn, setInspectedOn] = useState(today);
  const [helperIds, setHelperIds] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const helperOptions = inspectors.filter((u) => u.id !== currentUser.id);

  function toggleHelper(id: number) {
    setHelperIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: 4,
        padding: 10,
        borderRadius: 10,
        border: '1px solid var(--fo-rail-border)',
        background: 'rgba(255,255,255,0.015)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={labelStyle}>วันที่ตรวจ</span>
        <input
          type="date"
          value={inspectedOn}
          max={today}
          onChange={(e) => setInspectedOn(e.target.value)}
          required
          aria-label="วันที่ตรวจ"
          style={inputStyle}
        />
      </label>

      <div>
        <div style={labelStyle}>หัวหน้าทีม</div>
        <div style={{ ...muteStyle, marginTop: 2 }}>{currentUser.displayName} (คุณ)</div>
      </div>

      {helperOptions.length > 0 && (
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={labelStyle}>ผู้ร่วมตรวจ</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {helperOptions.map((u) => (
              <label
                key={u.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  color: 'var(--fo-rail-text)',
                }}
              >
                <input
                  type="checkbox"
                  checked={helperIds.has(u.id)}
                  onChange={() => toggleHelper(u.id)}
                  aria-label={u.displayName}
                />
                {u.displayName}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={labelStyle}>หมายเหตุ</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          aria-label="หมายเหตุ"
          style={inputStyle}
        />
      </label>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" onClick={onCancel} disabled={submitting} style={ghostBtnStyle}>
          ยกเลิก
        </button>
        <button type="submit" disabled={submitting} style={primaryBtnStyle}>
          {submitting ? '...' : 'บันทึก'}
        </button>
      </div>
    </form>
  );
}

export default function FieldOpsInspectionPanel({
  stationId,
  history,
  currentUser,
  inspectors,
  onCreate,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const latest = history[0] ?? null;
  const rest = history.slice(1);

  return (
    <div style={wrapperStyle} data-testid="field-ops-inspection-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={labelStyle}>INSPECTION</span>
        {!recording && (
          <button type="button" onClick={() => setRecording(true)} style={primaryBtnStyle}>
            + บันทึก
          </button>
        )}
      </div>

      {latest ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontFamily: 'var(--fo-mono)',
                fontSize: 10,
                letterSpacing: 0.5,
                color: 'var(--fo-accent)',
              }}
            >
              ✓ INSPECTED
            </span>
            <span
              style={{
                fontFamily: 'var(--fo-serif)',
                fontSize: 14,
                color: 'var(--fo-rail-text)',
              }}
            >
              · {formatInspectionDate(latest.inspectedOn)}
            </span>
          </div>
          <Chips lead={latest.lead} helpers={latest.helpers} />
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontFamily: 'var(--fo-mono)',
              fontSize: 10,
              letterSpacing: 0.5,
              color: 'var(--fo-warn)',
            }}
          >
            ⏳ PENDING
          </span>
          <span style={{ ...muteStyle }}>ยังไม่ตรวจ</span>
        </div>
      )}

      {rest.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            aria-expanded={historyOpen}
            style={{
              ...muteStyle,
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            {historyOpen ? '▾' : '▸'} HISTORY ({rest.length})
          </button>
          {historyOpen && (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '8px 0 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {rest.map((row) => (
                <li
                  key={row.id}
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    border: '1px solid var(--fo-rail-border)',
                    background: 'rgba(255,255,255,0.015)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <span style={{ fontFamily: 'var(--fo-serif)', fontSize: 13, color: 'var(--fo-rail-text)' }}>
                    {formatInspectionDate(row.inspectedOn)}
                  </span>
                  <Chips lead={row.lead} helpers={row.helpers} />
                  {row.notes && (
                    <span style={{ ...muteStyle, fontStyle: 'italic' }}>{row.notes}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {recording && (
        <FieldOpsNewInspectionForm
          currentUser={currentUser}
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
