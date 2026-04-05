'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ProvinceBarChartProps {
  data: Array<{ name: string; total: number; critical: number; major: number; minor: number }>;
}

const TT_COLORS = ['#0F6B6B', '#D4A017', '#E76F51', '#2A9D8F', '#9C6ADE'];

interface TooltipPayload {
  payload: { name: string; total: number; critical: number; major: number; minor: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="tt-tooltip">
      <div className="tt-tooltip-label">{d.name}</div>
      <div className="tt-tooltip-item">Total: <strong>{d.total}</strong></div>
      <div className="tt-tooltip-item">Critical: <strong style={{ color: '#D7263D' }}>{d.critical}</strong></div>
      <div className="tt-tooltip-item">Major: <strong style={{ color: '#F4A261' }}>{d.major}</strong></div>
      <div className="tt-tooltip-item">Minor: <strong style={{ color: '#D4A017' }}>{d.minor}</strong></div>
    </div>
  );
}

export default function ProvinceBarChart({ data }: ProvinceBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="bar-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0F6B6B" />
            <stop offset="100%" stopColor="#D4A017" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" />
        <YAxis type="category" dataKey="name" width={90} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(212, 160, 23, 0.08)' }} />
        <Bar dataKey="total" fill="url(#bar-gradient)" radius={[0, 8, 8, 0]} barSize={24}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? 'url(#bar-gradient)' : TT_COLORS[i % TT_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
