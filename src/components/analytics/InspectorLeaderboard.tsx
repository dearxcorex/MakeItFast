'use client';

export type LeaderboardInspector = {
  userId: number;
  displayName: string;
  points: number;
};

function Row({
  rank,
  inspector,
  isYou,
  pinned,
}: {
  rank: number;
  inspector: LeaderboardInspector;
  isYou: boolean;
  pinned?: boolean;
}) {
  return (
    <div
      data-row
      data-is-you={isYou}
      data-pinned={pinned ? 'true' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 14px',
        borderBottom: '1px solid var(--fo-line)',
        background: isYou ? 'rgba(0,237,100,0.08)' : 'transparent',
        borderLeft: isYou ? '3px solid var(--fo-accent)' : '3px solid transparent',
        color: isYou ? 'var(--fo-accent)' : 'inherit',
        fontWeight: isYou ? 700 : 400,
        position: pinned ? 'sticky' : 'static',
        top: pinned ? 0 : 'auto',
        zIndex: pinned ? 2 : 'auto',
      }}
    >
      <span
        className="fo-mono"
        style={{ width: 36, color: 'var(--fo-mute)', fontSize: 12 }}
      >
        #{rank}
      </span>
      <span style={{ flex: 1, fontSize: 14 }}>
        {isYou ? 'You' : inspector.displayName}
      </span>
      <span className="fo-mono" style={{ width: 48, textAlign: 'right', fontSize: 14 }}>
        {inspector.points}
      </span>
    </div>
  );
}

export default function InspectorLeaderboard({
  inspectors,
  currentUserId,
}: {
  inspectors: LeaderboardInspector[];
  currentUserId: number | null;
}) {
  const ranked = inspectors.map((i, idx) => ({ ...i, rank: idx + 1 }));
  const tailRows = ranked.filter((i) => i.rank >= 4);
  if (tailRows.length === 0) return null;

  const you = currentUserId !== null ? ranked.find((i) => i.userId === currentUserId) : undefined;
  const showPinned = !!you && you.rank >= 5;

  return (
    <div
      style={{
        border: '1px solid var(--fo-line)',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 24,
      }}
    >
      {showPinned && you && (
        <Row rank={you.rank} inspector={you} isYou pinned />
      )}
      {tailRows
        .filter((i) => !(showPinned && you && i.userId === you.userId))
        .map((i) => (
        <Row
          key={i.userId}
          rank={i.rank}
          inspector={i}
          isYou={!!you && i.userId === you.userId}
        />
      ))}
    </div>
  );
}
