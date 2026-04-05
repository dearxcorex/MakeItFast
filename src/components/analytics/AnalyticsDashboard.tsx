'use client';

import { useEffect, useState } from 'react';
import type { AnalyticsSummary } from '@/types/analytics';
import StatCard from './StatCard';
import ChartCard from './ChartCard';
import ProgressRing from './ProgressRing';
import ProvinceBarChart from './charts/ProvinceBarChart';
import RankingDonutChart from './charts/RankingDonutChart';
import FMProvinceBarChart from './charts/FMProvinceBarChart';

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics/summary');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading && !data) {
    return (
      <div className="analytics-theme flex-1 flex items-center justify-center p-8 rounded-3xl">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-current border-t-transparent rounded-full animate-spin" style={{ color: 'var(--tt-teal)' }} />
          <p className="mt-4 text-sm" style={{ color: 'var(--tt-brown)' }}>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="analytics-theme flex-1 flex items-center justify-center p-8 rounded-3xl">
        <div className="tt-card max-w-md text-center">
          <div className="tt-heading text-lg mb-2">Unable to load analytics</div>
          <p className="text-sm mb-4" style={{ color: 'var(--tt-brown)' }}>{error || 'No data available'}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 rounded-xl font-medium text-sm"
            style={{ background: 'var(--tt-teal)', color: '#fff' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-theme flex-1 overflow-y-auto p-6 lg:p-8 rounded-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="tt-heading tt-heading-gradient text-3xl lg:text-4xl font-bold">
            Analytics Dashboard
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--tt-brown)' }}>
            ภาพรวมการตรวจสอบสถานีวิทยุ FM และการวิเคราะห์สัญญาณรบกวน
          </p>
          <span className="tt-scallop" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs" style={{ color: 'var(--tt-brown)' }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 rounded-xl font-medium text-sm flex items-center gap-2 disabled:opacity-50"
            style={{ background: 'var(--tt-teal)', color: '#fff' }}
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Row 1: Hero Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="FM Stations"
          value={data.heroStats.totalStations}
          tone="teal"
          subtitle={`${data.heroStats.inspectedStations} inspected`}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>}
        />
        <StatCard
          label="Interference Sites"
          value={data.heroStats.totalInterferenceSites}
          tone="gold"
          subtitle={`${data.heroStats.pendingInterference} pending inspection`}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>}
        />
        <StatCard
          label="Critical Alerts"
          value={data.heroStats.criticalInterference}
          tone="coral"
          subtitle="Need immediate action"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
        <StatCard
          label="Direction Match"
          value={data.heroStats.directionMatchRate}
          suffix="%"
          tone="jade"
          subtitle="Antenna bearing validation"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
        />
      </div>

      {/* Row 2: Charts - Province + Ranking + Inspection Ring */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <ChartCard title="Interference by Province" subtitle="Top provinces by reported sites" className="lg:col-span-2">
          <ProvinceBarChart data={data.byProvince.slice(0, 8)} />
        </ChartCard>
        <ChartCard title="Severity Distribution" subtitle="By ranking">
          <RankingDonutChart data={data.rankingDistribution} />
        </ChartCard>
      </div>

      {/* Row 3: FM Station Analytics */}
      <div className="mb-2 mt-2">
        <h2 className="tt-heading tt-heading-gradient text-xl lg:text-2xl font-bold">FM Station Insights</h2>
        <p className="text-xs mt-1" style={{ color: 'var(--tt-brown)' }}>
          ข้อมูลเชิงลึกเกี่ยวกับสถานีวิทยุ FM
        </p>
        <span className="tt-scallop" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 mt-4">
        <ChartCard title="FM Stations by Province" subtitle="ตรวจแล้วปี 69 per province" className="lg:col-span-2">
          <FMProvinceBarChart data={data.fmStationsByProvince.slice(0, 8)} />
        </ChartCard>
        <ChartCard title="Inspection Coverage" subtitle="ตรวจสอบปี 69">
          {(() => {
            const inspected = data.fmStationInspection.inspection69 + data.fmStationInspection.bothYears;
            const total = data.heroStats.totalStations;
            const notInspected = total - inspected;
            const percent = total > 0 ? Math.round((inspected / total) * 100) : 0;
            return (
              <div className="flex flex-col items-center justify-center py-4">
                <ProgressRing value={percent} size={160} label="coverage" />
                <div className="mt-3 text-xs" style={{ color: 'var(--tt-brown)' }}>
                  {inspected} / {total} stations
                </div>
                <div className="mt-4 flex gap-6 text-xs w-full justify-around">
                  <div className="text-center">
                    <div className="tt-heading text-2xl" style={{ color: 'var(--tt-jade)' }}>
                      {inspected}
                    </div>
                    <div style={{ color: 'var(--tt-brown)' }}>ตรวจแล้ว</div>
                  </div>
                  <div className="text-center">
                    <div className="tt-heading text-2xl" style={{ color: 'var(--tt-coral)' }}>
                      {notInspected}
                    </div>
                    <div style={{ color: 'var(--tt-brown)' }}>ยังไม่ตรวจ</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </ChartCard>
      </div>
    </div>
  );
}
