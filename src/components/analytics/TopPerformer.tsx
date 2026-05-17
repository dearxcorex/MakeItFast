// src/components/analytics/TopPerformer.tsx
'use client';

import type { InspectorsAnalytics } from '@/types/analytics';

interface Props {
  inspectors: InspectorsAnalytics['inspectors']; // already sorted DESC by ytdTotal
  thisYear: number;
}

// Local copy of the helper used by InspectorsSection. Kept duplicated by
// design (see spec "Out of scope") — a shared util would expand this PR
// beyond the redesign's intent.
function daysAgo(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(`${iso}T00:00:00Z`);
  const now = new Date();
  const ms = now.getTime() - then.getTime();
  const days = Math.max(0, Math.floor(ms / 86_400_000));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

const cardBase: React.CSSProperties = {
  background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
  border: '1px solid #86efac',
  borderRadius: 12,
  padding: 18,
  marginBottom: 16,
};

const cardEmpty: React.CSSProperties = {
  background: '#f4f4f1',
  border: '1px solid #e2dfd8',
  borderRadius: 12,
  padding: 18,
  marginBottom: 16,
  color: '#5c6c75',
};

const pillLed: React.CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 999,
  background: '#f0fdf4',
  border: '1px solid #86efac',
  color: '#166534',
  fontFamily: 'var(--fo-mono)',
  fontSize: 11,
  fontWeight: 600,
  marginRight: 6,
};

const pillHelped: React.CSSProperties = {
  ...pillLed,
  background: '#ffffff',
  borderColor: '#cbd5e1',
  color: '#5c6c75',
};

export default function TopPerformer({ inspectors, thisYear }: Props) {
  const top = inspectors[0];
  const isEmpty = !top || top.ytdTotal === 0;

  if (isEmpty) {
    return (
      <div style={cardEmpty}>
        <div className="fo-mono" style={{ color: 'var(--fo-mute)' }}>
          🏆 TOP PERFORMER · YTD {thisYear}
        </div>
        <div className="fo-serif" style={{ fontSize: 22, marginTop: 8 }}>
          No activity yet for {thisYear}
        </div>
      </div>
    );
  }

  return (
    <div style={cardBase}>
      <div className="fo-mono" style={{ color: '#166534' }}>
        🏆 TOP PERFORMER · YTD {thisYear}
      </div>
      <div
        className="fo-serif"
        style={{ fontSize: 42, marginTop: 8, lineHeight: 1, color: '#001e2b' }}
      >
        {top.displayName}
      </div>
      <div
        style={{
          color: '#166534',
          fontSize: 14,
          marginTop: 6,
          fontWeight: 600,
        }}
      >
        {top.ytdTotal} inspections this year
      </div>
      <div style={{ marginTop: 14 }}>
        <span style={pillLed}>{top.ytdAsLead} led</span>
        <span style={pillHelped}>{top.ytdAsHelper} helped</span>
      </div>
      <div style={{ color: '#5c6c75', fontSize: 11, marginTop: 10 }}>
        Last active {daysAgo(top.lastActive)} · {top.monthTotal} this month
      </div>
    </div>
  );
}
