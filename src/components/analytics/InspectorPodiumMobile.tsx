'use client';

import type { PodiumInspector } from './InspectorPodium';

const TONE = {
  gold: { bg: '#ffc845', ink: '#001e2b', label: '1ST', icon: '🏆' },
  silver: { bg: '#c0c0c0', ink: '#001e2b', label: '2ND', icon: '2' },
  bronze: { bg: '#cd7f32', ink: '#ffffff', label: '3RD', icon: '3' },
} as const;

type Tone = keyof typeof TONE;

function MedalCard({
  inspector,
  tone,
  rank,
  isYou,
}: {
  inspector: PodiumInspector;
  tone: Tone;
  rank: 1 | 2 | 3;
  isYou: boolean;
}) {
  const t = TONE[tone];
  return (
    <div
      data-medal={tone}
      data-is-you={isYou}
      style={{
        background: t.bg,
        color: t.ink,
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        outline: isYou ? '3px solid var(--fo-accent)' : 'none',
        outlineOffset: 2,
      }}
    >
      <div
        className="fo-mono"
        style={{ fontSize: 20, fontWeight: 800, width: 28, textAlign: 'center' }}
        aria-hidden
      >
        {rank === 1 ? t.icon : rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="fo-mono" style={{ fontSize: 10, letterSpacing: '0.14em', opacity: 0.75 }}>
          {t.label}
        </div>
        <div className="fo-serif" style={{ fontSize: 16, fontWeight: 700 }}>
          {inspector.displayName}
        </div>
      </div>
      <div className="fo-mono" style={{ fontSize: 22, fontWeight: 800 }}>
        {inspector.points}
      </div>
    </div>
  );
}

export default function InspectorPodiumMobile({
  inspectors,
  currentUserId,
}: {
  inspectors: PodiumInspector[];
  currentUserId: number | null;
}) {
  const withPoints = inspectors.filter((i) => i.points > 0);
  if (withPoints.length === 0) {
    return (
      <div
        className="fo-mono"
        style={{
          padding: 24,
          textAlign: 'center',
          color: 'var(--fo-rail-mute)',
          border: '1px dashed var(--fo-line)',
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        No inspections recorded yet this period.
      </div>
    );
  }
  const [first, second, third] = withPoints;
  const isYou = (i?: PodiumInspector) =>
    !!i && currentUserId !== null && i.userId === currentUserId;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      {first && <MedalCard inspector={first} tone="gold" rank={1} isYou={isYou(first)} />}
      {second && <MedalCard inspector={second} tone="silver" rank={2} isYou={isYou(second)} />}
      {third && <MedalCard inspector={third} tone="bronze" rank={3} isYou={isYou(third)} />}
    </div>
  );
}
