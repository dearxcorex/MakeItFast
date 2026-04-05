'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface RankingDonutChartProps {
  data: Array<{ ranking: string; count: number }>;
}

const RANKING_COLORS: Record<string, string> = {
  critical: '#D7263D',
  major: '#F4A261',
  minor: '#D4A017',
  unknown: '#7A6F63',
};

interface TooltipPayload {
  name: string;
  value: number;
  payload: { ranking: string; count: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0];
  return (
    <div className="tt-tooltip">
      <div className="tt-tooltip-label">{d.name}</div>
      <div className="tt-tooltip-item">Count: <strong>{d.value}</strong></div>
    </div>
  );
}

export default function RankingDonutChart({ data }: RankingDonutChartProps) {
  const chartData = data.map((d) => ({ name: d.ranking, value: d.count, ranking: d.ranking, count: d.count }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={3}
          stroke="none"
        >
          {chartData.map((entry, i) => (
            <Cell
              key={i}
              fill={RANKING_COLORS[entry.name.toLowerCase()] || RANKING_COLORS.unknown}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          wrapperStyle={{ fontSize: '12px', fontFamily: 'Prompt, system-ui, sans-serif' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
