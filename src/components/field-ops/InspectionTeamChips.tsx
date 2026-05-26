'use client';

interface InspectionMember {
  userId: number;
  username: string;
  displayName: string;
}

export default function InspectionTeamChips({
  lead,
  helpers,
  inspectedOn,
}: {
  lead: InspectionMember | null;
  helpers: InspectionMember[];
  inspectedOn?: string;
}) {
  if (!lead) return null;

  return (
    <div style={{ padding: '8px 0' }}>
      <div
        className="fo-mono"
        style={{ fontSize: 9, letterSpacing: '0.16em', color: 'var(--fo-rail-mute)', marginBottom: 6 }}
      >
        INSPECTED BY{inspectedOn ? ` · ${inspectedOn}` : ''}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <span
          data-role="lead"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'var(--fo-accent)',
            color: 'var(--fo-ink, #001e2b)',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {lead.displayName}
        </span>
        {helpers.map((h) => (
          <span
            key={h.userId}
            data-role="helper"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid var(--fo-rail-border, var(--fo-line))',
              color: 'var(--fo-rail-text, var(--fo-ink))',
              fontSize: 12,
            }}
          >
            {h.displayName}
          </span>
        ))}
      </div>
    </div>
  );
}
