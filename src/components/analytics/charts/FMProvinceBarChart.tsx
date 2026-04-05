'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface FMProvinceBarChartProps {
  data: Array<{ name: string; total: number; inspected69: number }>;
}

interface TooltipPayload {
  payload: { name: string; total: number; inspected69: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const rate = d.total > 0 ? Math.round((d.inspected69 / d.total) * 100) : 0;
  return (
    <div className="tt-tooltip">
      <div className="tt-tooltip-label">{d.name}</div>
      <div className="tt-tooltip-item">Total: <strong>{d.total}</strong></div>
      <div className="tt-tooltip-item">ตรวจแล้ว (69): <strong style={{ color: '#2A9D8F' }}>{d.inspected69}</strong></div>
      <div className="tt-tooltip-item">Rate: <strong>{rate}%</strong></div>
    </div>
  );
}

export default function FMProvinceBarChart({ data }: FMProvinceBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="inspected69-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2A9D8F" />
            <stop offset="100%" stopColor="#D4A017" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" />
        <YAxis type="category" dataKey="name" width={90} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(212, 160, 23, 0.08)' }} />
        <Bar
          dataKey="inspected69"
          fill="url(#inspected69-gradient)"
          radius={[0, 8, 8, 0]}
          barSize={24}
          name="ตรวจแล้ว (69)"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
