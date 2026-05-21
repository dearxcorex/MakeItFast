'use client';

export type Timeframe = 'month' | 'ytd';

export default function TimeframePills({
  value,
  onChange,
  monthLabel,
}: {
  value: Timeframe;
  onChange: (next: Timeframe) => void;
  monthLabel: string;
}) {
  const pills: Array<{ key: Timeframe; label: string }> = [
    { key: 'month', label: monthLabel },
    { key: 'ytd', label: 'YTD' },
  ];

  return (
    <div
      role="tablist"
      aria-label="Timeframe"
      style={{ display: 'inline-flex', gap: 6, marginBottom: 16 }}
    >
      {pills.map((p) => {
        const active = p.key === value;
        return (
          <button
            key={p.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(p.key)}
            className="fo-mono"
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              border: `1px solid ${active ? 'var(--fo-accent)' : 'var(--fo-line)'}`,
              background: active ? 'var(--fo-accent)' : 'transparent',
              color: active ? 'var(--fo-ink)' : 'var(--fo-rail-mute)',
              fontSize: 11,
              letterSpacing: '0.14em',
              cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
