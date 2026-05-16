'use client';

import { useState } from 'react';

export interface InspectorOption {
  id: number;
  username: string;
  displayName: string;
}

interface Props {
  inspectors: InspectorOption[];
  currentUserId: number;
  value: number[];
  onChange: (helperUserIds: number[]) => void;
  disabled?: boolean;
}

const linkStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  marginTop: 6,
  fontFamily: 'var(--fo-mono)',
  fontSize: 11,
  letterSpacing: 0.4,
  color: 'var(--fo-accent)',
  cursor: 'pointer',
};

const chipStyleSelected: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 999,
  background: 'var(--fo-accent)',
  color: 'var(--fo-rail-bg)',
  fontSize: 11,
  fontWeight: 600,
};

const chipStyleUnselected: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 999,
  border: '1px solid var(--fo-rail-border)',
  color: 'var(--fo-rail-text)',
  fontSize: 11,
  cursor: 'pointer',
};

export default function TeammatePicker({
  inspectors,
  currentUserId,
  value,
  onChange,
  disabled = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const helperOptions = inspectors.filter((u) => u.id !== currentUserId);

  if (helperOptions.length === 0) return null;

  const selectedSet = new Set(value);

  function toggle(id: number) {
    if (disabled) return;
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  const selectedHelpers = helperOptions.filter((u) => selectedSet.has(u.id));

  if (!expanded) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          disabled={disabled}
          style={linkStyle}
        >
          + tag teammates
        </button>
        {selectedHelpers.map((u) => (
          <span key={u.id} style={chipStyleSelected}>{u.displayName}</span>
        ))}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {helperOptions.map((u) => {
          const selected = selectedSet.has(u.id);
          return (
            <label
              key={u.id}
              style={selected ? chipStyleSelected : chipStyleUnselected}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggle(u.id)}
                aria-label={u.displayName}
                disabled={disabled}
                style={{ margin: 0 }}
              />
              {u.displayName}
            </label>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setExpanded(false)}
        disabled={disabled}
        style={{ ...linkStyle, color: 'var(--fo-rail-mute)' }}
      >
        – collapse
      </button>
    </div>
  );
}
