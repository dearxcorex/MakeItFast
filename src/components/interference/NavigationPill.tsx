'use client';

function formatBearing(b: number): string {
  const rounded = Math.round(((b % 360) + 360) % 360);
  return `${String(rounded).padStart(3, '0')}°`;
}

export default function NavigationPill({
  bearing,
  distance,
  className,
  style,
}: {
  bearing: number | null;
  distance: number | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (bearing === null && distance === null) return null;

  const parts: string[] = [];
  if (bearing !== null) {
    parts.push(`→ ${formatBearing(bearing)}`);
  }
  if (distance !== null) {
    parts.push(`${distance.toFixed(1)} km`);
  } else if (bearing !== null) {
    parts.push('pending source');
  }

  return (
    <div
      className={`fo-mono ${className ?? ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 10px',
        borderRadius: 999,
        background: 'var(--fo-canvas)',
        color: 'var(--fo-accent)',
        border: '1px solid var(--fo-accent)',
        fontSize: 11,
        letterSpacing: '0.12em',
        ...style,
      }}
    >
      {parts.join(' · ')}
    </div>
  );
}
