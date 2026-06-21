'use client';

import { useState, useMemo, useCallback } from 'react';
import { FMStation } from '@/types/station';
import {
  AircraftInput,
  InterferenceRisk,
  IntermodCalculationResult,
  RiskLevel,
} from '@/types/intermod';
import {
  findPairsForTargetFrequency,
  assessInterferenceRisk,
  calculateThirdOrderProducts,
  formatDistance,
  summarizeByService,
  filterRiskAssessments,
} from '@/utils/intermodCalculations';

type CalculatorMode = 'aircraft-check' | 'specific-frequency';

interface IntermodCalculatorProps {
  stations: FMStation[];
  onHighlightStations?: (station1Id: string | number, station2Id: string | number) => void;
  onSwitchToStations?: () => void;
}

const RISK_TONE: Record<RiskLevel, { color: string; pillClass: string }> = {
  CRITICAL: { color: 'var(--fo-crit)', pillClass: 'fo-risk-critical' },
  HIGH: { color: 'var(--fo-warn)', pillClass: 'fo-risk-high' },
  MEDIUM: { color: 'var(--fo-warn-2)', pillClass: 'fo-risk-medium' },
  LOW: { color: 'var(--fo-accent-2)', pillClass: 'fo-risk-low' },
};

export default function IntermodCalculator({
  stations,
  onHighlightStations,
  onSwitchToStations,
}: IntermodCalculatorProps) {
  const [mode, setMode] = useState<CalculatorMode>('aircraft-check');
  const [freq1, setFreq1] = useState<string>('');
  const [freq2, setFreq2] = useState<string>('');
  const [aircraftData, setAircraftData] = useState<AircraftInput>({});
  const [customFrequency, setCustomFrequency] = useState<string>('');
  const [calculationResult, setCalculationResult] = useState<IntermodCalculationResult | null>(null);
  const [riskAssessments, setRiskAssessments] = useState<InterferenceRisk[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'ALL'>('ALL');

  const totalStationsCount = stations.length;

  const targetAircraftFrequency = useMemo(() => {
    if (aircraftData.frequency) return aircraftData.frequency;
    if (customFrequency) {
      const parsed = parseFloat(customFrequency);
      if (!isNaN(parsed) && parsed >= 108 && parsed <= 137) return parsed;
    }
    return null;
  }, [aircraftData.frequency, customFrequency]);

  const handleCalculate = useCallback(() => {
    setIsCalculating(true);
    setTimeout(() => {
      try {
        if (mode === 'specific-frequency') {
          const f1 = parseFloat(freq1);
          const f2 = parseFloat(freq2);
          if (isNaN(f1) || isNaN(f2)) {
            alert('Please enter valid frequencies');
            setIsCalculating(false);
            return;
          }
          const products = calculateThirdOrderProducts(f1, f2);
          const aviationProducts = products.filter((p) => p.inAviationBand);
          setCalculationResult({
            totalPairsChecked: 1,
            dangerousPairs:
              aviationProducts.length > 0
                ? [
                    {
                      station1: {
                        id: 'manual-1',
                        name: `Manual ${f1} MHz`,
                        frequency: f1,
                        latitude: 0,
                        longitude: 0,
                        city: '-',
                        state: '-',
                        genre: '-',
                      },
                      station2: {
                        id: 'manual-2',
                        name: `Manual ${f2} MHz`,
                        frequency: f2,
                        latitude: 0,
                        longitude: 0,
                        city: '-',
                        state: '-',
                        genre: '-',
                      },
                      distance: 0,
                      products,
                      aviationProducts,
                    },
                  ]
                : [],
            calculationTimeMs: 0,
          });
          setRiskAssessments([]);
        } else {
          if (!targetAircraftFrequency) {
            alert('Please enter an aircraft frequency');
            setIsCalculating(false);
            return;
          }
          const result = findPairsForTargetFrequency(stations, targetAircraftFrequency);
          setCalculationResult(result);
          const assessments = assessInterferenceRisk(result.dangerousPairs, aircraftData);
          setRiskAssessments(assessments);
        }
      } catch (error) {
        console.error('Calculation error:', error);
        alert('An error occurred during calculation');
      } finally {
        setIsCalculating(false);
      }
    }, 50);
  }, [mode, freq1, freq2, stations, aircraftData, targetAircraftFrequency]);

  const handleClear = useCallback(() => {
    setFreq1('');
    setFreq2('');
    setAircraftData({});
    setCustomFrequency('');
    setCalculationResult(null);
    setRiskAssessments([]);
    setRiskFilter('ALL');
  }, []);

  const handleResultClick = useCallback(
    (risk: InterferenceRisk) => {
      if (onHighlightStations && onSwitchToStations) {
        onHighlightStations(risk.pair.station1.id, risk.pair.station2.id);
        onSwitchToStations();
      }
    },
    [onHighlightStations, onSwitchToStations]
  );

  const filteredResults = useMemo(() => {
    if (riskFilter === 'ALL') return riskAssessments;
    return filterRiskAssessments(riskAssessments, { minRiskLevel: riskFilter });
  }, [riskAssessments, riskFilter]);

  const summary = useMemo(() => {
    if (!riskAssessments.length) return null;
    return {
      total: riskAssessments.length,
      byRisk: {
        CRITICAL: riskAssessments.filter((r) => r.riskLevel === 'CRITICAL').length,
        HIGH: riskAssessments.filter((r) => r.riskLevel === 'HIGH').length,
        MEDIUM: riskAssessments.filter((r) => r.riskLevel === 'MEDIUM').length,
        LOW: riskAssessments.filter((r) => r.riskLevel === 'LOW').length,
      },
      byService: summarizeByService(riskAssessments),
    };
  }, [riskAssessments]);

  const handleExportPDF = useCallback(() => {
    if (!calculationResult || !riskAssessments.length) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to generate the PDF report');
      return;
    }
    const htmlContent = `<!DOCTYPE html>
<html><head><title>Intermodulation Analysis Report</title>
<style>
  body { font-family: 'Inter', sans-serif; padding: 32px; max-width: 920px; margin: 0 auto; color: #001e2b; }
  h1 { font-family: 'Playfair Display', Georgia, serif; color: #001e2b; border-bottom: 3px solid #00ed64; padding-bottom: 10px; font-weight: 400; }
  h2 { font-family: 'Source Code Pro', monospace; color: #00684a; text-transform: uppercase; letter-spacing: 0.16em; font-size: 12px; margin-top: 28px; }
  .summary { background: #f5f3ef; padding: 16px; border: 1px solid #e2dfd8; border-radius: 12px; margin: 18px 0; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px; }
  .summary-item { text-align: center; padding: 10px; background: #fff; border: 1px solid #e2dfd8; border-radius: 8px; }
  .summary-value { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 400; }
  .critical { color: #e34b4b; }
  .high { color: #f5a623; }
  .medium { color: #d4a017; }
  .low { color: #00684a; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  th, td { padding: 9px 10px; text-align: left; border-bottom: 1px solid #e2dfd8; font-size: 12px; }
  th { font-family: 'Source Code Pro', monospace; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: #5c6c75; background: #f5f3ef; }
  .risk-badge { padding: 2px 8px; border-radius: 999px; font-family: 'Source Code Pro', monospace; font-size: 9px; font-weight: 600; letter-spacing: 0.16em; border: 1px solid currentColor; }
  .risk-critical { color: #e34b4b; }
  .risk-high { color: #f5a623; }
  .risk-medium { color: #d4a017; }
  .risk-low { color: #00684a; }
  .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e2dfd8; color: #5c6c75; font-size: 11px; }
  @media print { body { padding: 0; } }
</style></head><body>
  <h1>FM Station Intermodulation Analysis</h1>
  <p style="color:#5c6c75;font-size:12px;">Generated ${new Date().toLocaleString()} · Target ${targetAircraftFrequency} MHz</p>

  <h2>Analysis Summary</h2>
  <div class="summary">
    <div class="summary-grid">
      <div class="summary-item"><div class="summary-value critical">${summary?.byRisk.CRITICAL || 0}</div><div>Critical</div></div>
      <div class="summary-item"><div class="summary-value high">${summary?.byRisk.HIGH || 0}</div><div>High</div></div>
      <div class="summary-item"><div class="summary-value medium">${summary?.byRisk.MEDIUM || 0}</div><div>Medium</div></div>
      <div class="summary-item"><div class="summary-value low">${summary?.byRisk.LOW || 0}</div><div>Low</div></div>
    </div>
    <p style="margin-top: 14px; margin-bottom: 0; font-size: 12px; color:#5c6c75;">
      Total stations analyzed: ${totalStationsCount}<br>
      FM station pairs found: ${calculationResult?.dangerousPairs.length}<br>
      Calculation time: ${calculationResult?.calculationTimeMs.toFixed(2)} ms
    </p>
  </div>

  <h2>FM Station Pairs · Target ${targetAircraftFrequency} MHz</h2>
  <table>
    <tr><th>Risk</th><th>Station 1</th><th>Station 2</th><th>Formula</th><th>Distance</th></tr>
    ${riskAssessments
      .slice(0, 100)
      .map(
        (r) => `
    <tr>
      <td><span class="risk-badge risk-${r.riskLevel.toLowerCase()}">${r.riskLevel}</span></td>
      <td>${r.pair.station1.name} (${r.pair.station1.frequency} MHz)</td>
      <td>${r.pair.station2.name} (${r.pair.station2.frequency} MHz)</td>
      <td>${r.pair.aviationProducts[0]?.type || '-'}</td>
      <td>${formatDistance(r.pair.distance)}</td>
    </tr>`
      )
      .join('')}
  </table>
  ${riskAssessments.length > 100 ? `<p style="font-size:11px;color:#5c6c75;"><em>Showing first 100 of ${riskAssessments.length} results</em></p>` : ''}

  <div class="footer">
    <p>FM Station Intermodulation Calculator · NBTC Thailand · field-ops dashboard</p>
  </div>
</body></html>`;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  }, [calculationResult, riskAssessments, summary, totalStationsCount, targetAircraftFrequency]);

  return (
    <div
      className="fo-light"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        gap: 16,
        padding: 4,
        flexDirection: 'row',
        flexWrap: 'wrap',
      }}
    >
      <style>{`@media (max-width: 900px) { .fo-imc-row { flex-direction: column !important; } .fo-imc-input { width: 100% !important; max-height: none !important; } }`}</style>

      {/* INPUT PANEL */}
      <aside
        className="fo-card fo-imc-input"
        style={{
          width: 400,
          flexShrink: 0,
          padding: 20,
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'var(--fo-accent-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width={20} height={20} fill="none" stroke="#fff" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div className="fo-mono" style={{ color: 'var(--fo-accent-2)' }}>
              INTERMOD CALCULATOR
            </div>
            <div className="fo-serif" style={{ fontSize: 22, marginTop: 2 }}>
              Aircraft <span className="fo-underline-accent">interference</span>
            </div>
          </div>
        </div>

        {/* Mode */}
        <div style={{ marginBottom: 14 }}>
          <label className="fo-mono" style={{ display: 'block', marginBottom: 6 }}>
            MODE
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as CalculatorMode)}
            className="fo-select"
          >
            <option value="aircraft-check">Find FM Pairs (Aircraft Freq)</option>
            <option value="specific-frequency">Check FM Frequencies</option>
          </select>
        </div>

        {/* Mode-specific inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'specific-frequency' ? (
            <>
              <div className="fo-card" style={{ padding: 14, background: 'var(--fo-canvas)' }}>
                <div className="fo-mono" style={{ marginBottom: 10 }}>
                  ENTER TWO FM FREQUENCIES
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label className="fo-mono" style={{ display: 'block', marginBottom: 4 }}>
                      FM FREQUENCY 1 (MHZ)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="87.5"
                      max="108"
                      value={freq1}
                      onChange={(e) => setFreq1(e.target.value)}
                      placeholder="98.0"
                      className="fo-input"
                    />
                  </div>
                  <div>
                    <label className="fo-mono" style={{ display: 'block', marginBottom: 4 }}>
                      FM FREQUENCY 2 (MHZ)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="87.5"
                      max="108"
                      value={freq2}
                      onChange={(e) => setFreq2(e.target.value)}
                      placeholder="88.0"
                      className="fo-input"
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(0,237,100,0.06)',
                  border: '1px solid rgba(0,104,74,0.2)',
                }}
              >
                <div className="fo-mono" style={{ color: 'var(--fo-accent-2)', marginBottom: 4 }}>
                  3RD ORDER PRODUCTS
                </div>
                <div style={{ fontFamily: 'var(--fo-mono)', fontSize: 12, color: 'var(--fo-ink)' }}>
                  2 × f1 − f2 ={' '}
                  {freq1 && freq2 ? (2 * parseFloat(freq1) - parseFloat(freq2)).toFixed(2) : '?'} MHz
                </div>
                <div style={{ fontFamily: 'var(--fo-mono)', fontSize: 12, color: 'var(--fo-ink)' }}>
                  2 × f2 − f1 ={' '}
                  {freq1 && freq2 ? (2 * parseFloat(freq2) - parseFloat(freq1)).toFixed(2) : '?'} MHz
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="fo-card" style={{ padding: 14, background: 'var(--fo-canvas)' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <svg width={16} height={16} fill="none" stroke="var(--fo-accent-2)" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span className="fo-mono" style={{ color: 'var(--fo-accent-2)' }}>
                    AIRCRAFT FREQUENCY · 108–137 MHZ
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="number"
                    step="0.1"
                    min="108"
                    max="137"
                    value={customFrequency}
                    onChange={(e) => {
                      setCustomFrequency(e.target.value);
                      setAircraftData((prev) => ({ ...prev, frequency: undefined }));
                    }}
                    placeholder="121.5"
                    className="fo-input"
                    style={{ flex: 1 }}
                  />
                  <span className="fo-mono">MHZ</span>
                </div>
                {targetAircraftFrequency && (
                  <div
                    className="fo-mono"
                    style={{
                      marginTop: 8,
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: 'rgba(0,104,74,0.1)',
                      color: 'var(--fo-accent-2)',
                      textAlign: 'center',
                    }}
                  >
                    TARGET · {targetAircraftFrequency} MHZ
                  </div>
                )}
              </div>

              <details className="fo-card" style={{ padding: 12, background: 'var(--fo-canvas)' }}>
                <summary
                  className="fo-mono"
                  style={{ cursor: 'pointer', color: 'var(--fo-ink)' }}
                >
                  COMMON FREQUENCIES REFERENCE
                </summary>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '4px 12px',
                    marginTop: 8,
                    fontFamily: 'var(--fo-mono)',
                    fontSize: 11,
                    color: 'var(--fo-mute)',
                    letterSpacing: '0.1em',
                  }}
                >
                  <span>108.0 VOR/ILS</span>
                  <span>121.5 EMERGENCY</span>
                  <span>118.0 ATC</span>
                  <span>125.0 APPROACH</span>
                </div>
              </details>

              <details className="fo-card" style={{ padding: 12, background: 'var(--fo-canvas)' }}>
                <summary className="fo-mono" style={{ cursor: 'pointer' }}>
                  OPTIONAL · AIRCRAFT LOCATION
                </summary>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  <div>
                    <label className="fo-mono" style={{ display: 'block', marginBottom: 4 }}>
                      LAT
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={aircraftData.latitude || ''}
                      onChange={(e) =>
                        setAircraftData((prev) => ({
                          ...prev,
                          latitude: e.target.value ? parseFloat(e.target.value) : undefined,
                        }))
                      }
                      placeholder="13.75"
                      className="fo-input"
                      style={{ fontSize: 12, padding: '7px 10px' }}
                    />
                  </div>
                  <div>
                    <label className="fo-mono" style={{ display: 'block', marginBottom: 4 }}>
                      LNG
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={aircraftData.longitude || ''}
                      onChange={(e) =>
                        setAircraftData((prev) => ({
                          ...prev,
                          longitude: e.target.value ? parseFloat(e.target.value) : undefined,
                        }))
                      }
                      placeholder="100.50"
                      className="fo-input"
                      style={{ fontSize: 12, padding: '7px 10px' }}
                    />
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <label className="fo-mono" style={{ display: 'block', marginBottom: 4 }}>
                    ALTITUDE (FT)
                  </label>
                  <input
                    type="number"
                    step="500"
                    min="0"
                    value={aircraftData.altitude || ''}
                    onChange={(e) =>
                      setAircraftData((prev) => ({
                        ...prev,
                        altitude: e.target.value ? parseFloat(e.target.value) : undefined,
                      }))
                    }
                    placeholder="35000"
                    className="fo-input"
                    style={{ fontSize: 12, padding: '7px 10px' }}
                  />
                  <div
                    className="fo-mono"
                    style={{ marginTop: 4, fontSize: 10, color: 'var(--fo-mute)', letterSpacing: '0.08em' }}
                  >
                    LAT/LNG + ALTITUDE ENABLE LINE-OF-SIGHT (TOWER {`${60}`}M)
                  </div>
                </div>
              </details>

              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(0,237,100,0.06)',
                  border: '1px solid rgba(0,104,74,0.2)',
                  fontSize: 12,
                  color: 'var(--fo-mute)',
                  lineHeight: 1.4,
                }}
              >
                <span className="fo-mono" style={{ color: 'var(--fo-accent-2)', marginRight: 4 }}>
                  REVERSE LOOKUP ·
                </span>
                Finds all FM station pairs from {totalStationsCount} stations that could create
                interference at the target aircraft frequency.
              </div>
            </>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
            <button
              type="button"
              onClick={handleCalculate}
              disabled={isCalculating || (mode === 'aircraft-check' && !targetAircraftFrequency)}
              className="fo-btn fo-btn-primary"
              style={{ width: '100%', padding: 14 }}
            >
              {isCalculating ? (
                <span className="fo-mono" style={{ color: '#fff' }}>SEARCHING…</span>
              ) : (
                <>
                  <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="fo-mono" style={{ color: '#fff' }}>
                    {mode === 'aircraft-check' ? 'FIND FM PAIRS' : 'CALCULATE'}
                  </span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="fo-btn"
              style={{ width: '100%' }}
            >
              <span className="fo-mono">CLEAR ALL</span>
            </button>
          </div>
        </div>

        {/* Aviation Band Info */}
        <div
          style={{
            marginTop: 20,
            padding: 14,
            borderRadius: 12,
            background: 'var(--fo-canvas)',
            border: '1px solid var(--fo-line)',
          }}
        >
          <div className="fo-mono" style={{ color: 'var(--fo-accent-2)', marginBottom: 8 }}>
            AVIATION BAND · 108–137 MHZ
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fo-mute)' }}>
              <span>VOR/ILS Navigation</span>
              <span style={{ fontFamily: 'var(--fo-mono)' }}>108.0 – 117.95</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fo-mute)' }}>
              <span>Emergency</span>
              <span style={{ fontFamily: 'var(--fo-mono)' }}>121.5</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fo-mute)' }}>
              <span>ATC Voice</span>
              <span style={{ fontFamily: 'var(--fo-mono)' }}>118.0 – 137.0</span>
            </div>
          </div>
        </div>
      </aside>

      {/* RESULTS PANEL */}
      <section
        className="fo-card"
        style={{
          flex: 1,
          minWidth: 0,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 200px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            gap: 12,
          }}
        >
          <div>
            <div className="fo-mono" style={{ color: 'var(--fo-accent-2)' }}>
              RESULTS
            </div>
            <div className="fo-serif" style={{ fontSize: 22 }}>
              Interference pairs
            </div>
          </div>
          {calculationResult && riskAssessments.length > 0 && (
            <button
              type="button"
              onClick={handleExportPDF}
              className="fo-pill"
            >
              <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              EXPORT PDF
            </button>
          )}
        </div>

        {!calculationResult ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: 32,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 16,
                background: 'var(--fo-canvas)',
                border: '1px solid var(--fo-line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <svg width={36} height={36} fill="none" stroke="var(--fo-mute)" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="fo-serif" style={{ fontSize: 22, marginBottom: 6 }}>
              No results yet
            </div>
            <div className="fo-mono" style={{ maxWidth: 360 }}>
              {mode === 'aircraft-check'
                ? 'ENTER AN AIRCRAFT FREQUENCY TO FIND FM PAIRS THAT COULD CAUSE INTERFERENCE'
                : 'ENTER TWO FM FREQUENCIES TO SEE THEIR INTERMODULATION PRODUCTS'}
            </div>
          </div>
        ) : (
          <>
            {/* Specific frequency mode results */}
            {mode === 'specific-frequency' &&
              calculationResult &&
              calculationResult.dangerousPairs.length > 0 && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: 14,
                    borderRadius: 12,
                    background: 'var(--fo-canvas)',
                    border: '1px solid var(--fo-line)',
                  }}
                >
                  <div className="fo-mono" style={{ marginBottom: 10 }}>
                    3RD ORDER INTERMOD PRODUCTS
                  </div>
                  {calculationResult.dangerousPairs[0].products.map((product, idx) => {
                    const f1 = parseFloat(freq1);
                    const f2 = parseFloat(freq2);
                    const isInAviation = product.inAviationBand;
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          marginBottom: 8,
                          background: '#fff',
                          border: `1px solid ${isInAviation ? 'var(--fo-crit)' : 'var(--fo-line)'}`,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 6,
                          }}
                        >
                          <span style={{ fontFamily: 'var(--fo-mono)', fontWeight: 600 }}>
                            {product.type}
                          </span>
                          {isInAviation && (
                            <span className="fo-risk-pill fo-risk-critical">AVIATION BAND</span>
                          )}
                        </div>
                        <div className="fo-mono" style={{ marginBottom: 4 }}>
                          {product.type === '2f1-f2'
                            ? `2 × ${f1} − ${f2}`
                            : `2 × ${f2} − ${f1}`}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            className="fo-serif"
                            style={{ fontSize: 18, color: 'var(--fo-accent-2)' }}
                          >
                            = {product.frequency.toFixed(3)} MHz
                          </span>
                          {product.affectedService && (
                            <span
                              className="fo-mono"
                              style={{
                                color: 'var(--fo-accent-2)',
                                background: 'rgba(0,104,74,0.1)',
                                padding: '2px 6px',
                                borderRadius: 4,
                              }}
                            >
                              {product.affectedService}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {calculationResult.dangerousPairs[0].aviationProducts.length > 0 ? (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 8,
                        borderRadius: 8,
                        background: 'rgba(227,75,75,0.08)',
                        border: '1px solid rgba(227,75,75,0.3)',
                        textAlign: 'center',
                        color: 'var(--fo-crit)',
                        fontFamily: 'var(--fo-mono)',
                        fontSize: 11,
                        letterSpacing: '0.12em',
                      }}
                    >
                      ⚠ {calculationResult.dangerousPairs[0].aviationProducts.length} PRODUCT(S) FALL IN AVIATION BAND
                    </div>
                  ) : (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 8,
                        borderRadius: 8,
                        background: 'rgba(0,237,100,0.08)',
                        border: '1px solid rgba(0,104,74,0.3)',
                        textAlign: 'center',
                        color: 'var(--fo-accent-2)',
                        fontFamily: 'var(--fo-mono)',
                        fontSize: 11,
                        letterSpacing: '0.12em',
                      }}
                    >
                      ✓ NO PRODUCTS IN AVIATION BAND
                    </div>
                  )}
                </div>
              )}

            {/* Target frequency for aircraft mode */}
            {mode === 'aircraft-check' && targetAircraftFrequency && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 14,
                  borderRadius: 12,
                  background: 'rgba(0,104,74,0.06)',
                  border: '1px solid var(--fo-accent-2)',
                  textAlign: 'center',
                }}
              >
                <div className="fo-mono">SEARCHING FOR FM PAIRS THAT CREATE</div>
                <div
                  className="fo-serif"
                  style={{ fontSize: 30, color: 'var(--fo-accent-2)', marginTop: 4 }}
                >
                  {targetAircraftFrequency} MHz
                </div>
              </div>
            )}

            {/* Summary stats */}
            {summary && riskAssessments.length > 0 && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 14,
                  borderRadius: 12,
                  background: 'var(--fo-canvas)',
                  border: '1px solid var(--fo-line)',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as RiskLevel[]).map((lv) => (
                    <div
                      key={lv}
                      style={{
                        textAlign: 'center',
                        padding: '8px 4px',
                        background: '#fff',
                        border: '1px solid var(--fo-line)',
                        borderRadius: 8,
                      }}
                    >
                      <div
                        className="fo-serif"
                        style={{ fontSize: 24, color: RISK_TONE[lv].color, lineHeight: 1.1 }}
                      >
                        {summary.byRisk[lv]}
                      </div>
                      <div className="fo-mono">{lv}</div>
                    </div>
                  ))}
                </div>
                <div className="fo-mono" style={{ textAlign: 'center' }}>
                  FOUND {calculationResult.dangerousPairs.length} PAIRS · {calculationResult.calculationTimeMs.toFixed(2)} MS
                </div>
              </div>
            )}

            {/* Risk filter */}
            {riskAssessments.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 14,
                  flexWrap: 'wrap',
                }}
              >
                <span className="fo-mono">FILTER ·</span>
                {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => setRiskFilter(lv)}
                    className={`fo-pill ${riskFilter === lv ? 'is-active' : ''}`}
                    style={{ padding: '4px 12px', fontSize: 10 }}
                  >
                    {lv}
                  </button>
                ))}
              </div>
            )}

            {/* Results list */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                paddingRight: 4,
                minHeight: 0,
              }}
            >
              {calculationResult.dangerousPairs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      background: 'rgba(0,237,100,0.12)',
                      border: '1px solid var(--fo-accent-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px',
                    }}
                  >
                    <svg width={28} height={28} fill="none" stroke="var(--fo-accent-2)" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="fo-serif" style={{ fontSize: 20, marginBottom: 4 }}>
                    No interference found
                  </div>
                  <div className="fo-mono">
                    NO FM PAIRS WOULD CREATE {targetAircraftFrequency} MHZ
                  </div>
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="fo-mono" style={{ textAlign: 'center', padding: 32 }}>
                  NO RESULTS MATCH THE CURRENT FILTER
                </div>
              ) : (
                filteredResults.map((risk, index) => {
                  const product = risk.pair.aviationProducts[0];
                  const f1 = risk.pair.station1.frequency;
                  const f2 = risk.pair.station2.frequency;
                  const formulaDisplay =
                    product?.type === '2f1-f2'
                      ? `2 × ${f1} − ${f2} = ${(2 * f1 - f2).toFixed(2)} MHz`
                      : `2 × ${f2} − ${f1} = ${(2 * f2 - f1).toFixed(2)} MHz`;
                  const tone = RISK_TONE[risk.riskLevel];

                  return (
                    <div
                      key={`${risk.pair.station1.id}-${risk.pair.station2.id}-${index}`}
                      onClick={() => handleResultClick(risk)}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        background: '#fff',
                        border: `1px solid var(--fo-line)`,
                        borderLeft: `3px solid ${tone.color}`,
                        cursor: onHighlightStations ? 'pointer' : 'default',
                        transition: 'border-color 120ms ease, transform 120ms ease',
                      }}
                      onMouseEnter={(e) => {
                        if (onHighlightStations)
                          e.currentTarget.style.borderColor = 'var(--fo-accent-2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--fo-line)';
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 10,
                          gap: 8,
                        }}
                      >
                        <span className={`fo-risk-pill ${tone.pillClass}`}>{risk.riskLevel}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {risk.lineOfSight === false && (
                            <span
                              className="fo-mono"
                              style={{
                                color: 'var(--fo-crit)',
                                background: 'rgba(227,75,75,0.1)',
                                padding: '2px 8px',
                                borderRadius: 999,
                                border: '1px solid rgba(227,75,75,0.35)',
                              }}
                            >
                              NO LINE OF SIGHT
                            </span>
                          )}
                          {product?.affectedService && (
                            <span
                              className="fo-mono"
                              style={{
                                color: 'var(--fo-accent-2)',
                                background: 'rgba(0,104,74,0.08)',
                                padding: '2px 8px',
                                borderRadius: 999,
                                border: '1px solid rgba(0,104,74,0.2)',
                              }}
                            >
                              {product.affectedService}
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          marginBottom: 10,
                          padding: 10,
                          borderRadius: 8,
                          background: 'var(--fo-canvas)',
                          border: '1px solid var(--fo-line)',
                        }}
                      >
                        <div className="fo-mono" style={{ marginBottom: 4 }}>
                          INTERMOD CALCULATION
                        </div>
                        <div style={{ fontFamily: 'var(--fo-mono)', fontSize: 13, fontWeight: 600 }}>
                          {formulaDisplay}
                        </div>
                        <div
                          style={{
                            marginTop: 6,
                            display: 'flex',
                            gap: 12,
                            alignItems: 'baseline',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span className="fo-mono">FORMULA · {product?.type ?? '—'}</span>
                          {product?.frequency !== undefined && (
                            <span
                              className="fo-serif"
                              style={{ fontSize: 16, color: 'var(--fo-accent-2)' }}
                            >
                              {product.frequency.toFixed(3)} MHz
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            padding: 8,
                            borderRadius: 8,
                            background: 'var(--fo-canvas)',
                          }}
                        >
                          <span className="fo-mono" style={{ width: 24 }}>
                            f1
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500 }}>{risk.pair.station1.name}</div>
                            <div
                              style={{
                                display: 'flex',
                                gap: 6,
                                fontSize: 12,
                                color: 'var(--fo-mute)',
                                flexWrap: 'wrap',
                              }}
                            >
                              <span style={{ fontFamily: 'var(--fo-mono)', color: 'var(--fo-accent-2)' }}>
                                {f1} MHz
                              </span>
                              <span>·</span>
                              <span>
                                {risk.pair.station1.city}, {risk.pair.station1.state}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            padding: 8,
                            borderRadius: 8,
                            background: 'var(--fo-canvas)',
                          }}
                        >
                          <span className="fo-mono" style={{ width: 24 }}>
                            f2
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500 }}>{risk.pair.station2.name}</div>
                            <div
                              style={{
                                display: 'flex',
                                gap: 6,
                                fontSize: 12,
                                color: 'var(--fo-mute)',
                                flexWrap: 'wrap',
                              }}
                            >
                              <span style={{ fontFamily: 'var(--fo-mono)', color: 'var(--fo-accent-2)' }}>
                                {f2} MHz
                              </span>
                              <span>·</span>
                              <span>
                                {risk.pair.station2.city}, {risk.pair.station2.state}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginTop: 10,
                          paddingTop: 8,
                          borderTop: '1px solid var(--fo-line)',
                          fontFamily: 'var(--fo-mono)',
                          fontSize: 10,
                          letterSpacing: '0.12em',
                          color: 'var(--fo-mute)',
                          textTransform: 'uppercase',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        <span>STATION DIST · {formatDistance(risk.pair.distance)}</span>
                        {risk.distanceToAircraft !== undefined && (
                          <span>TO AIRCRAFT · {formatDistance(risk.distanceToAircraft)}</span>
                        )}
                        {onHighlightStations && (
                          <span style={{ color: 'var(--fo-accent-2)' }}>VIEW ON MAP →</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
