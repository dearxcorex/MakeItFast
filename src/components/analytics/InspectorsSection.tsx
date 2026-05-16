// src/components/analytics/InspectorsSection.tsx
'use client';

import { useEffect, useState } from 'react';
import type { InspectorsAnalytics } from '@/types/analytics';
import FoKPI from './FoKPI';
import FoBarChart from './charts/FoBarChart';
import FoDonut from './charts/FoDonut';

// Stable palette for usernames. Falls back to ink for unknown names.
const USER_COLORS: Record<string, string> = {
  admin: '#5d4fff',
  ice: '#1da1c4',
  iff: '#e07b00',
  dao: '#7b5cff',
  daf: '#22a06b',
};
function colorFor(username: string): string {
  return USER_COLORS[username] ?? 'var(--fo-ink)';
}

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

function SectionHeader() {
  return (
    <div style={{ marginTop: 32, marginBottom: 12 }}>
      <div className="fo-mono" style={{ color: 'var(--fo-accent)', letterSpacing: 0.6 }}>
        INSPECTORS
      </div>
      <div className="fo-serif" style={{ fontSize: 22, color: 'var(--fo-ink)' }}>
        Year-to-date team performance
      </div>
    </div>
  );
}

function KpiStrip({ kpis }: { kpis: InspectorsAnalytics['kpis'] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
      <FoKPI label="Active inspectors this month" value={kpis.activeThisMonth} />
      <FoKPI
        label="Largest team"
        value={kpis.largestTeam ? `${kpis.largestTeam.memberCount}` : '—'}
        sub={kpis.largestTeam ? `${kpis.largestTeam.stationName} · ${kpis.largestTeam.inspectedOn}` : 'no data'}
      />
      <FoKPI
        label="Most-tagged helper"
        value={kpis.mostTaggedHelperThisYear ? kpis.mostTaggedHelperThisYear.displayName : '—'}
        sub={kpis.mostTaggedHelperThisYear ? `${kpis.mostTaggedHelperThisYear.count} helper assists this year` : 'no data'}
      />
    </div>
  );
}

function LeaderboardTable({ inspectors }: { inspectors: InspectorsAnalytics['inspectors'] }) {
  const top = inspectors[0];
  return (
    <div style={{ overflowX: 'auto', marginBottom: 24 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--fo-body)' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--fo-line)' }}>
            <th style={{ padding: '8px 12px' }}>Inspector</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>YTD total</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>This month</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>As lead</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>As helper</th>
            <th style={{ padding: '8px 12px' }}>Last active</th>
          </tr>
        </thead>
        <tbody>
          {inspectors.map((u) => (
            <tr key={u.userId} style={{ borderBottom: '1px solid var(--fo-line)' }}>
              <td style={{ padding: '8px 12px' }}>
                {top && u.userId === top.userId && u.ytdTotal > 0 && (
                  <span style={{ color: '#ffd24a', marginRight: 4 }} aria-hidden>★</span>
                )}
                {u.displayName}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{u.ytdTotal}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{u.monthTotal}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{u.ytdAsLead}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{u.ytdAsHelper}</td>
              <td style={{ padding: '8px 12px' }}>{daysAgo(u.lastActive)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthlyParticipationChart({ series }: { series: InspectorsAnalytics['monthlySeries'] }) {
  const data = series.map((m) => ({
    label: m.month.slice(2), // "25-06" style — compact
    v: Object.values(m.perUser).reduce((s, n) => s + n, 0),
    color: 'var(--fo-accent)',
  }));
  return (
    <div style={{ marginBottom: 24 }}>
      <FoBarChart data={data} title="Participations per month (last 12)" />
    </div>
  );
}

function PerUserRoleDonuts({ inspectors }: { inspectors: InspectorsAnalytics['inspectors'] }) {
  const withActivity = inspectors.filter((u) => u.ytdTotal > 0);
  if (withActivity.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
      {withActivity.map((u) => (
        <FoDonut
          key={u.userId}
          title={u.displayName}
          segments={[
            { label: 'Lead', v: u.ytdAsLead, c: colorFor(u.username) },
            { label: 'Helper', v: u.ytdAsHelper, c: 'var(--fo-line)' },
          ]}
          centerLabel={`${u.ytdTotal}`}
          centerSub="YTD"
        />
      ))}
    </div>
  );
}

export default function InspectorsSection() {
  const [data, setData] = useState<InspectorsAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/analytics/inspectors');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as InspectorsAnalytics;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'unknown');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <section>
        <SectionHeader />
        <div className="fo-mono" style={{ padding: 12, border: '1px solid var(--fo-crit)', color: 'var(--fo-crit)', borderRadius: 8 }}>
          Failed to load inspector analytics ({error}).
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section>
        <SectionHeader />
        <div className="fo-mono" style={{ padding: 12, color: 'var(--fo-rail-mute)' }}>
          Loading...
        </div>
      </section>
    );
  }

  const hasAnyActivity = data.inspectors.some((u) => u.ytdTotal > 0)
    || data.monthlySeries.some((m) => Object.keys(m.perUser).length > 0);

  if (!hasAnyActivity) {
    return (
      <section>
        <SectionHeader />
        <div className="fo-mono" style={{ padding: 12, color: 'var(--fo-rail-mute)' }}>
          No inspection activity yet.
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader />
      <KpiStrip kpis={data.kpis} />
      <LeaderboardTable inspectors={data.inspectors} />
      <MonthlyParticipationChart series={data.monthlySeries} />
      <PerUserRoleDonuts inspectors={data.inspectors} />
    </section>
  );
}
