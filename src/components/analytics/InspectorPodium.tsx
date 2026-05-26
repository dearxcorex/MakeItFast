'use client';

export type PodiumInspector = {
  userId: number;
  displayName: string;
  points: number;
};

const TONE = {
  gold: { bg: 'var(--fo-podium-gold)', ink: 'var(--fo-podium-gold-ink)', height: 140 },
  silver: { bg: 'var(--fo-podium-silver)', ink: 'var(--fo-podium-silver-ink)', height: 115 },
  bronze: { bg: 'var(--fo-podium-bronze)', ink: 'var(--fo-podium-bronze-ink)', height: 95 },
} as const;

type Tone = keyof typeof TONE;

function Pedestal({
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
      data-place={tone}
      data-is-you={isYou}
      style={{
        flex: 1,
        background: t.bg,
        color: t.ink,
        borderRadius: '12px 12px 0 0',
        padding: '14px 10px 10px',
        textAlign: 'center',
        height: t.height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        outline: isYou ? '3px solid var(--fo-accent)' : 'none',
        outlineOffset: 2,
      }}
    >
      {rank === 1 && <div style={{ fontSize: 18 }} aria-hidden>🏆</div>}
      <div className="fo-mono" style={{ fontSize: 10, letterSpacing: '0.14em' }}>
        {rank === 1 ? '1ST' : rank === 2 ? '2ND' : '3RD'}
      </div>
      <div className="fo-serif" style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
        {inspector.displayName}
      </div>
      <div className="fo-mono" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
        {inspector.points}
      </div>
    </div>
  );
}

export default function InspectorPodium({
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
          padding: '32px 16px',
          textAlign: 'center',
          color: 'var(--fo-rail-mute)',
          border: '1px dashed var(--fo-line)',
          borderRadius: 12,
          marginBottom: 24,
        }}
      >
        No inspections recorded yet this period.
      </div>
    );
  }

  const [first, second, third] = withPoints;
  const isYou = (i?: PodiumInspector) =>
    !!i && currentUserId !== null && i.userId === currentUserId;

  // When all 3 spots are filled, render silver/gold/bronze (gold centered).
  // When only 2 are filled, render gold/silver. When only 1, render gold alone.
  const showSilverLeft = !!second && !!third;

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
        justifyContent: 'center',
        maxWidth: 560,
        margin: '0 auto 24px',
      }}
    >
      {showSilverLeft && (
        <Pedestal inspector={second!} tone="silver" rank={2} isYou={isYou(second)} />
      )}
      {first && (
        <Pedestal inspector={first} tone="gold" rank={1} isYou={isYou(first)} />
      )}
      {!showSilverLeft && second && (
        <Pedestal inspector={second} tone="silver" rank={2} isYou={isYou(second)} />
      )}
      {third && (
        <Pedestal inspector={third} tone="bronze" rank={3} isYou={isYou(third)} />
      )}
    </div>
  );
}
