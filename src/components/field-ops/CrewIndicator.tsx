'use client';

import type { InspectorOption } from './CrewModal';

interface Props {
  defaultCrew: number[] | null;
  inspectors: InspectorOption[];
  onOpen: () => void;
  compact: boolean;
}

const baseBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  border: '1px solid var(--fo-accent)',
  color: 'var(--fo-accent)',
  background: 'transparent',
  borderRadius: 999,
  fontSize: 10,
  lineHeight: 1,
  letterSpacing: '0.16em',
  cursor: 'pointer',
  fontFamily: 'var(--fo-mono)',
};

function displayFor(id: number, inspectors: InspectorOption[]): string {
  const hit = inspectors.find((u) => u.id === id);
  return hit ? hit.displayName : `#${id}`;
}

export default function CrewIndicator({
  defaultCrew,
  inspectors,
  onOpen,
  compact,
}: Props) {
  if (defaultCrew === null) return null;

  if (compact) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={defaultCrew.length === 0 ? 'My crew (solo)' : 'My crew'}
        style={{ ...baseBtn, padding: '6px 10px' }}
      >
        <span aria-hidden>🧑</span>
        {defaultCrew.length > 0 && <span>{defaultCrew.length}</span>}
      </button>
    );
  }

  if (defaultCrew.length === 0) {
    return (
      <button type="button" onClick={onOpen} style={baseBtn}>
        <span aria-hidden>🧑</span>
        <span>MY CREW · SOLO</span>
      </button>
    );
  }

  const names = defaultCrew.slice(0, 2).map((id) => displayFor(id, inspectors));
  const extra = defaultCrew.length - names.length;
  const tail = extra > 0 ? ` · +${extra}` : '';
  return (
    <button type="button" onClick={onOpen} style={baseBtn}>
      <span aria-hidden>🧑</span>
      <span>MY CREW · {names.join(' · ')}{tail}</span>
    </button>
  );
}
