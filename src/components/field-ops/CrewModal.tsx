'use client';

import { useEffect, useMemo, useState } from 'react';

export interface InspectorOption {
  id: number;
  username: string;
  displayName: string;
}

interface Props {
  open: boolean;
  inspectors: InspectorOption[];
  currentUserId: number;
  initialSelected: number[];
  onSave: (ids: number[]) => Promise<void> | void;
  onSolo: () => Promise<void> | void;
  onClose: () => void;
  error?: string;
  pending?: boolean;
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const cardStyle: React.CSSProperties = {
  width: 'min(480px, 92vw)',
  maxHeight: '92vh',
  overflowY: 'auto',
  position: 'relative',
  background: 'var(--fo-rail-bg)',
  color: 'var(--fo-rail-text)',
  border: '1px solid var(--fo-rail-border)',
  borderRadius: 12,
  padding: '22px 22px 18px',
};

const closeStyle: React.CSSProperties = {
  position: 'absolute',
  top: 14,
  right: 14,
  background: 'transparent',
  border: 'none',
  color: 'var(--fo-rail-mute)',
  fontSize: 18,
  cursor: 'pointer',
  width: 28,
  height: 28,
};

const chipBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid var(--fo-rail-border)',
  background: 'transparent',
  color: 'var(--fo-rail-text)',
};

const chipOn: React.CSSProperties = {
  ...chipBase,
  background: 'var(--fo-accent)',
  color: 'var(--fo-rail-bg)',
  borderColor: 'var(--fo-accent)',
};

const primaryBtn: React.CSSProperties = {
  flex: 1,
  padding: '11px 14px',
  background: 'var(--fo-accent)',
  color: 'var(--fo-rail-bg)',
  border: 'none',
  borderRadius: 8,
  fontFamily: 'var(--fo-mono)',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  padding: '11px 14px',
  background: 'transparent',
  color: 'var(--fo-rail-mute)',
  border: '1px solid var(--fo-rail-border)',
  borderRadius: 8,
  fontFamily: 'var(--fo-mono)',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  cursor: 'pointer',
};

export default function CrewModal({
  open,
  inspectors,
  currentUserId,
  initialSelected,
  onSave,
  onSolo,
  onClose: _onClose,
  error,
  pending = false,
}: Props) {
  const [selected, setSelected] = useState<number[]>(initialSelected);

  useEffect(() => {
    if (open) setSelected(initialSelected);
  }, [open, initialSelected]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void onSolo();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onSolo]);

  const options = useMemo(
    () => inspectors.filter((u) => u.id !== currentUserId),
    [inspectors, currentUserId],
  );

  if (!open) return null;

  const selectedSet = new Set(selected);
  const toggle = (id: number) => {
    if (pending) return;
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // Preserve inspector order so display is stable across toggles.
    setSelected(options.filter((u) => next.has(u.id)).map((u) => u.id));
  };

  return (
    <div
      data-testid="crew-modal-backdrop"
      style={backdropStyle}
      onClick={(e) => {
        // Backdrop click is intentionally inert; the user must use a button.
        e.stopPropagation();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crew-modal-title"
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => void onSolo()}
          disabled={pending}
          style={closeStyle}
        >
          ×
        </button>
        <div className="fo-mono" style={{ color: 'var(--fo-accent)' }}>FIRST LOGIN</div>
        <div
          id="crew-modal-title"
          className="fo-serif"
          style={{ fontSize: 22, marginTop: 4 }}
        >
          Tag your default crew
        </div>
        <div style={{ color: 'var(--fo-rail-mute)', fontSize: 13, marginTop: 4, marginBottom: 16, lineHeight: 1.4 }}>
          Pre-filled on every inspection — override per station.
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '6px 0 4px 0' }}>
          {options.map((u) => {
            const on = selectedSet.has(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                disabled={pending}
                style={on ? chipOn : chipBase}
              >
                {u.displayName}
              </button>
            );
          })}
        </div>

        {error && (
          <div
            role="alert"
            style={{ marginTop: 12, color: 'var(--fo-crit)', fontSize: 12 }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 18,
            paddingTop: 14,
            borderTop: '1px solid var(--fo-rail-border)',
          }}
        >
          <button
            type="button"
            onClick={() => void onSave(selected)}
            disabled={pending || selected.length === 0}
            style={{ ...primaryBtn, opacity: pending || selected.length === 0 ? 0.5 : 1 }}
          >
            SAVE CREW ({selected.length})
          </button>
          <button
            type="button"
            onClick={() => void onSolo()}
            disabled={pending}
            style={secondaryBtn}
          >
            I WORK SOLO
          </button>
        </div>
      </div>
    </div>
  );
}
