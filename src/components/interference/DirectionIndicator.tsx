'use client';

interface DirectionIndicatorProps {
  storedDirection: number;
  calculatedBearing: number;
  isMatch: boolean;
  size?: number;
}

export default function DirectionIndicator({
  storedDirection,
  calculatedBearing,
  isMatch,
  size = 80,
}: DirectionIndicatorProps) {
  const center = size / 2;
  const radius = center - 12;
  const lineLen = radius - 4;

  const toXY = (deg: number, len: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: center + len * Math.cos(rad), y: center + len * Math.sin(rad) };
  };

  const stored = toXY(storedDirection, lineLen);
  const calc = toXY(calculatedBearing, lineLen);
  const arcColor = isMatch ? '#22C55E' : '#EF4444';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      {/* Outer circle */}
      <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.2} />

      {/* Cardinal labels */}
      {[
        { label: 'N', deg: 0 },
        { label: 'E', deg: 90 },
        { label: 'S', deg: 180 },
        { label: 'W', deg: 270 },
      ].map(({ label, deg }) => {
        const pos = toXY(deg, radius + 8);
        return (
          <text
            key={label}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={8}
            fill="currentColor"
            opacity={0.5}
          >
            {label}
          </text>
        );
      })}

      {/* Arc between the two directions */}
      <line x1={center} y1={center} x2={stored.x} y2={stored.y} stroke={arcColor} strokeWidth={1} opacity={0.15} />
      <line x1={center} y1={center} x2={calc.x} y2={calc.y} stroke={arcColor} strokeWidth={1} opacity={0.15} />

      {/* Stored direction - dashed line (antenna) */}
      <line
        x1={center} y1={center} x2={stored.x} y2={stored.y}
        stroke="#6366F1" strokeWidth={2} strokeDasharray="4 2"
      />
      <circle cx={stored.x} cy={stored.y} r={2.5} fill="#6366F1" />

      {/* Calculated bearing - solid line (source) */}
      <line
        x1={center} y1={center} x2={calc.x} y2={calc.y}
        stroke={arcColor} strokeWidth={2}
      />
      <circle cx={calc.x} cy={calc.y} r={2.5} fill={arcColor} />

      {/* Center dot */}
      <circle cx={center} cy={center} r={2} fill="currentColor" opacity={0.4} />
    </svg>
  );
}
