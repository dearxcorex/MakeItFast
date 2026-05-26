// src/components/analytics/InspectorsSection.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { InspectorsAnalytics } from '@/types/analytics';
import FoBarChart from './charts/FoBarChart';
import TimeframePills, { type Timeframe } from './TimeframePills';
import InspectorPodium, { type PodiumInspector } from './InspectorPodium';
import InspectorPodiumMobile from './InspectorPodiumMobile';
import InspectorLeaderboard, { type LeaderboardInspector } from './InspectorLeaderboard';

const THAI_MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

function monthLabelFor(thisMonth: string): string {
  const [y, m] = thisMonth.split('-');
  const idx = Math.max(0, Math.min(11, Number(m) - 1));
  return `${THAI_MONTHS[idx]} ${y}`;
}

function SectionHeader() {
  return (
    <div style={{ marginTop: 32, marginBottom: 12 }}>
      <div className="fo-mono" style={{ color: 'var(--fo-accent)', letterSpacing: 0.6 }}>
        INSPECTORS
      </div>
      <div className="fo-serif" style={{ fontSize: 22, color: 'var(--fo-ink)' }}>
        Team leaderboard
      </div>
      <div
        style={{
          marginTop: 8,
          padding: '8px 12px',
          background: 'var(--fo-surface)',
          border: '1px solid var(--fo-line)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--fo-mute)',
          lineHeight: 1.5,
        }}
      >
        <span style={{ marginRight: 6 }}>💡</span>
        คะแนนนับจากการตรวจสถานี FM และ INT รวมกัน
        — ไม่ว่าจะเป็น<strong style={{ color: 'var(--fo-ink)' }}>หัวหน้าทีม</strong>หรือ<strong style={{ color: 'var(--fo-ink)' }}>ผู้ช่วย</strong>ได้ 1 คะแนนเท่ากัน
      </div>
    </div>
  );
}

function MonthlyParticipationChart({
  series,
  thisYear,
}: {
  series: InspectorsAnalytics['monthlySeries'];
  thisYear: number;
}) {
  const yearPrefix = `${thisYear}-`;
  const data = series
    .filter((m) => m.month.startsWith(yearPrefix))
    .map((m) => ({
      label: m.month.slice(5),
      v: Object.values(m.perUser).reduce((s, n) => s + n, 0),
      color: 'var(--fo-accent)',
    }));
  return (
    <div style={{ marginBottom: 24 }}>
      <FoBarChart data={data} title={`Participations per month · ${thisYear}`} />
    </div>
  );
}

export default function InspectorsSection({
  currentUserId = null,
}: {
  currentUserId?: number | null;
}) {
  const [data, setData] = useState<InspectorsAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('month');

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

  const ranked: (PodiumInspector & LeaderboardInspector)[] = useMemo(() => {
    if (!data) return [];
    return [...data.inspectors]
      .map((u) => ({
        userId: u.userId,
        displayName: u.displayName,
        points: timeframe === 'month' ? u.monthTotal : u.ytdTotal,
      }))
      .sort((a, b) => b.points - a.points);
  }, [data, timeframe]);

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

  const monthLabel = monthLabelFor(data.thisMonth);

  return (
    <section>
      <SectionHeader />
      <TimeframePills value={timeframe} onChange={setTimeframe} monthLabel={monthLabel} />
      <div className="hidden md:block">
        <InspectorPodium inspectors={ranked} currentUserId={currentUserId} />
      </div>
      <div className="block md:hidden">
        <InspectorPodiumMobile inspectors={ranked} currentUserId={currentUserId} />
      </div>
      <InspectorLeaderboard inspectors={ranked} currentUserId={currentUserId} />
      <MonthlyParticipationChart series={data.monthlySeries} thisYear={data.thisYear} />
    </section>
  );
}
