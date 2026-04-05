'use client';

import { useEffect, useState } from 'react';

interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  icon?: React.ReactNode;
  tone?: 'teal' | 'gold' | 'coral' | 'jade';
  subtitle?: string;
}

export default function StatCard({ label, value, suffix, icon, tone = 'teal', subtitle }: StatCardProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 800;
    const start = performance.now();
    const from = 0;
    const diff = value - from;
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + diff * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const toneColors: Record<string, string> = {
    teal: 'var(--tt-teal)',
    gold: 'var(--tt-gold)',
    coral: 'var(--tt-coral)',
    jade: 'var(--tt-jade)',
  };

  return (
    <div className="tt-card">
      <div className="flex items-start justify-between mb-3">
        <div className="tt-stat-label">{label}</div>
        {icon && (
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `color-mix(in srgb, ${toneColors[tone]} 12%, transparent)`,
              color: toneColors[tone],
            }}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="tt-stat-value">
        {display.toLocaleString()}
        {suffix && <span className="text-xl ml-1 opacity-70">{suffix}</span>}
      </div>
      {subtitle && <div className="text-xs mt-2" style={{ color: 'var(--tt-brown)' }}>{subtitle}</div>}
    </div>
  );
}
