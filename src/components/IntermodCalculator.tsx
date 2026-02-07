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
  getRiskLevelColor,
  getRiskLevelBgColor,
  summarizeByService,
  filterRiskAssessments,
} from '@/utils/intermodCalculations';

// Calculator modes
type CalculatorMode = 'aircraft-check' | 'specific-frequency';

interface IntermodCalculatorProps {
  stations: FMStation[];
  onHighlightStations?: (station1Id: string | number, station2Id: string | number) => void;
  onSwitchToStations?: () => void;
}

export default function IntermodCalculator({
  stations,
  onHighlightStations,
  onSwitchToStations,
}: IntermodCalculatorProps) {
  // Calculator mode - default to aircraft check
  const [mode, setMode] = useState<CalculatorMode>('aircraft-check');

  // Manual frequency inputs (for specific-frequency mode)
  const [freq1, setFreq1] = useState<string>('');
  const [freq2, setFreq2] = useState<string>('');

  // Aircraft data inputs
  const [aircraftData, setAircraftData] = useState<AircraftInput>({});
  const [customFrequency, setCustomFrequency] = useState<string>('');

  // Results state
  const [calculationResult, setCalculationResult] = useState<IntermodCalculationResult | null>(null);
  const [riskAssessments, setRiskAssessments] = useState<InterferenceRisk[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  // Filter state for results
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'ALL'>('ALL');

  // Get total stations count (including off-air)
  const totalStationsCount = stations.length;

  // Get the target frequency for aircraft mode
  const targetAircraftFrequency = useMemo(() => {
    if (aircraftData.frequency) return aircraftData.frequency;
    if (customFrequency) {
      const parsed = parseFloat(customFrequency);
      if (!isNaN(parsed) && parsed >= 108 && parsed <= 137) return parsed;
    }
    return null;
  }, [aircraftData.frequency, customFrequency]);

  // Run calculation
  const handleCalculate = useCallback(() => {
    setIsCalculating(true);

    // Use setTimeout to allow UI to update before heavy calculation
    setTimeout(() => {
      try {
        if (mode === 'specific-frequency') {
          // Manual frequency calculation - shows what intermod products they create
          const f1 = parseFloat(freq1);
          const f2 = parseFloat(freq2);

          if (isNaN(f1) || isNaN(f2)) {
            alert('Please enter valid frequencies');
            setIsCalculating(false);
            return;
          }

          const products = calculateThirdOrderProducts(f1, f2);
          const aviationProducts = products.filter((p) => p.inAviationBand);

          // Create a mock result for display
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
          // Aircraft interference check - reverse lookup
          if (!targetAircraftFrequency) {
            alert('Please select or enter an aircraft frequency');
            setIsCalculating(false);
            return;
          }

          // Find FM station pairs that would create this aircraft frequency
          const result = findPairsForTargetFrequency(stations, targetAircraftFrequency);
          setCalculationResult(result);

          // Assess risk levels
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

  // Clear results
  const handleClear = useCallback(() => {
    setFreq1('');
    setFreq2('');
    setAircraftData({});
    setCustomFrequency('');
    setCalculationResult(null);
    setRiskAssessments([]);
    setRiskFilter('ALL');
  }, []);

  // Handle clicking on a result to highlight on map
  const handleResultClick = useCallback(
    (risk: InterferenceRisk) => {
      if (onHighlightStations && onSwitchToStations) {
        onHighlightStations(risk.pair.station1.id, risk.pair.station2.id);
        onSwitchToStations();
      }
    },
    [onHighlightStations, onSwitchToStations]
  );

  // Filter displayed results
  const filteredResults = useMemo(() => {
    if (riskFilter === 'ALL') return riskAssessments;
    return filterRiskAssessments(riskAssessments, { minRiskLevel: riskFilter });
  }, [riskAssessments, riskFilter]);

  // Summary statistics
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

  // Generate PDF report
  const handleExportPDF = useCallback(() => {
    if (!calculationResult || !riskAssessments.length) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to generate the PDF report');
      return;
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Intermodulation Analysis Report</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    .summary { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px; }
    .summary-item { text-align: center; padding: 10px; background: white; border-radius: 4px; }
    .summary-value { font-size: 24px; font-weight: bold; }
    .critical { color: #ef4444; }
    .high { color: #f97316; }
    .medium { color: #eab308; }
    .low { color: #22c55e; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .risk-badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .risk-critical { background: #fef2f2; color: #ef4444; }
    .risk-high { background: #fff7ed; color: #f97316; }
    .risk-medium { background: #fefce8; color: #eab308; }
    .risk-low { background: #f0fdf4; color: #22c55e; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>FM Station Intermodulation Analysis Report</h1>
  <p>Generated: ${new Date().toLocaleString()}</p>
  <p><strong>Target Aircraft Frequency: ${targetAircraftFrequency} MHz</strong></p>

  <div class="summary">
    <strong>Analysis Summary</strong>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-value critical">${summary?.byRisk.CRITICAL || 0}</div>
        <div>Critical</div>
      </div>
      <div class="summary-item">
        <div class="summary-value high">${summary?.byRisk.HIGH || 0}</div>
        <div>High</div>
      </div>
      <div class="summary-item">
        <div class="summary-value medium">${summary?.byRisk.MEDIUM || 0}</div>
        <div>Medium</div>
      </div>
      <div class="summary-item">
        <div class="summary-value low">${summary?.byRisk.LOW || 0}</div>
        <div>Low</div>
      </div>
    </div>
    <p style="margin-top: 15px; margin-bottom: 0;">
      Total stations analyzed: ${totalStationsCount}<br>
      FM station pairs found: ${calculationResult?.dangerousPairs.length}<br>
      Calculation time: ${calculationResult?.calculationTimeMs.toFixed(2)} ms
    </p>
  </div>

  <h2>FM Station Pairs Causing Interference at ${targetAircraftFrequency} MHz</h2>
  <table>
    <tr>
      <th>Risk</th>
      <th>Station 1</th>
      <th>Station 2</th>
      <th>Formula</th>
      <th>Distance</th>
    </tr>
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
    </tr>
    `
      )
      .join('')}
  </table>
  ${riskAssessments.length > 100 ? `<p><em>Showing first 100 of ${riskAssessments.length} results</em></p>` : ''}

  <div class="footer">
    <p>This report was generated by the FM Station Intermodulation Calculator.<br>
    Aviation frequency interference analysis for NBTC regulatory compliance.</p>
  </div>
</body>
</html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  }, [calculationResult, riskAssessments, summary, totalStationsCount, targetAircraftFrequency]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
      {/* Calculator Input Panel */}
      <div className="lg:w-[400px] shrink-0 glass-card p-4 sm:p-6 rounded-2xl lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center glow-purple shrink-0">
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-heading font-bold text-foreground">
              Intermod Calculator
            </h2>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Find FM pairs causing aircraft interference
            </p>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="mb-3">
          <label className="block text-xs sm:text-sm font-medium text-foreground mb-1.5">
            Mode
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as CalculatorMode)}
            className="w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl bg-secondary/50 border border-border/50 text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          >
            <option value="aircraft-check">Find FM Pairs (Aircraft Freq)</option>
            <option value="specific-frequency">Check FM Frequencies</option>
          </select>
        </div>

        {/* Mode-specific inputs */}
        <div className="space-y-4">
          {mode === 'specific-frequency' ? (
            <>
              {/* Manual frequency inputs */}
              <div className="p-4 rounded-xl bg-secondary/30 border border-border/30">
                <h4 className="text-sm font-semibold text-foreground mb-3">
                  Enter two FM frequencies to see their intermod products
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      FM Frequency 1 (MHz)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="87.5"
                      max="108"
                      value={freq1}
                      onChange={(e) => setFreq1(e.target.value)}
                      placeholder="e.g., 98.0"
                      className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border/50 text-foreground placeholder-muted-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      FM Frequency 2 (MHz)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="87.5"
                      max="108"
                      value={freq2}
                      onChange={(e) => setFreq2(e.target.value)}
                      placeholder="e.g., 88.0"
                      className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border/50 text-foreground placeholder-muted-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Show formula explanation */}
              <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-accent">3rd Order Products:</strong><br />
                  2 x f1 - f2 = {freq1 && freq2 ? (2 * parseFloat(freq1) - parseFloat(freq2)).toFixed(2) : '?'} MHz<br />
                  2 x f2 - f1 = {freq1 && freq2 ? (2 * parseFloat(freq2) - parseFloat(freq1)).toFixed(2) : '?'} MHz
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Aircraft frequency input - REQUIRED */}
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/30">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span className="text-xs sm:text-sm font-semibold text-foreground">Aircraft Frequency</span>
                  <span className="text-xs text-primary">(108-137 MHz)</span>
                </div>

                <div className="flex gap-2 items-center">
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
                    className="flex-1 px-3 py-2 rounded-lg bg-secondary/50 border border-border/50 text-foreground placeholder-muted-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                  <span className="text-sm text-muted-foreground">MHz</span>
                </div>

                {targetAircraftFrequency && (
                  <div className="mt-2 p-1.5 rounded-lg bg-primary/20 text-center">
                    <span className="text-xs font-semibold text-primary">
                      Target: {targetAircraftFrequency} MHz
                    </span>
                  </div>
                )}
              </div>

              {/* Common frequencies reference - collapsible on mobile */}
              <details className="p-2 rounded-lg bg-secondary/30 border border-border/30">
                <summary className="text-xs font-medium text-foreground cursor-pointer">
                  Common Frequencies Reference
                </summary>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-2">
                  <span>108.0 VOR/ILS</span>
                  <span>121.5 Emergency</span>
                  <span>118.0 ATC</span>
                  <span>125.0 Approach</span>
                </div>
              </details>

              {/* Optional aircraft location - collapsible */}
              <details className="p-2 rounded-lg bg-secondary/30 border border-border/30">
                <summary className="text-xs font-medium text-muted-foreground cursor-pointer">
                  Optional: Aircraft Location
                </summary>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Lat</label>
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
                      className="w-full px-2 py-1.5 rounded-lg bg-secondary/50 border border-border/50 text-foreground placeholder-muted-foreground text-xs focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Lng</label>
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
                      className="w-full px-2 py-1.5 rounded-lg bg-secondary/50 border border-border/50 text-foreground placeholder-muted-foreground text-xs focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </details>

              {/* Info about reverse lookup */}
              <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-accent">Reverse Lookup:</strong> Finds all FM station pairs
                  from {totalStationsCount} FM stations that could create interference at the
                  target aircraft frequency.
                </p>
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="pt-2">
            <button
              onClick={handleCalculate}
              disabled={isCalculating || (mode === 'aircraft-check' && !targetAircraftFrequency)}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold hover:opacity-90 transition-all glow-gold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCalculating ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Searching...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {mode === 'aircraft-check' ? 'Find FM Pairs' : 'Calculate'}
                </>
              )}
            </button>
          </div>

          <div className="pt-2">
            <button
              onClick={handleClear}
              className="w-full py-2 px-4 rounded-xl bg-secondary/50 text-muted-foreground font-medium hover:text-foreground hover:bg-secondary transition-all"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Aviation Band Info */}
        <div className="mt-6 p-4 rounded-xl bg-accent/10 border border-accent/20">
          <h4 className="text-sm font-semibold text-accent mb-2">Aviation Band (108-137 MHz)</h4>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>VOR/ILS Navigation</span>
              <span>108.0 - 117.95 MHz</span>
            </div>
            <div className="flex justify-between">
              <span>Emergency</span>
              <span>121.5 MHz</span>
            </div>
            <div className="flex justify-between">
              <span>ATC Voice</span>
              <span>118.0 - 137.0 MHz</span>
            </div>
          </div>
        </div>
      </div>

      {/* Results Panel */}
      <div className="flex-1 glass-card p-6 rounded-2xl flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-bold text-foreground">Results</h3>
          {calculationResult && riskAssessments.length > 0 && (
            <button
              onClick={handleExportPDF}
              className="px-3 py-1.5 rounded-lg bg-secondary/50 text-muted-foreground text-sm font-medium hover:text-foreground hover:bg-secondary transition-all flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export PDF
            </button>
          )}
        </div>

        {!calculationResult ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
              <svg
                className="w-10 h-10 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-foreground mb-2">No Results Yet</h4>
            <p className="text-sm text-muted-foreground max-w-md">
              {mode === 'aircraft-check'
                ? 'Enter an aircraft frequency to find which FM station pairs could cause interference.'
                : 'Enter two FM frequencies to see their intermodulation products.'}
            </p>
          </div>
        ) : (
          <>
            {/* Specific Frequency Mode Results */}
            {mode === 'specific-frequency' && calculationResult && calculationResult.dangerousPairs.length > 0 && (
              <div className="mb-4">
                <div className="p-4 rounded-xl bg-secondary/30 border border-border/30">
                  <h4 className="text-sm font-semibold text-foreground mb-3">3rd Order Intermodulation Products</h4>

                  {calculationResult.dangerousPairs[0].products.map((product, idx) => {
                    const f1 = parseFloat(freq1);
                    const f2 = parseFloat(freq2);
                    const isInAviation = product.inAviationBand;

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg mb-2 ${
                          isInAviation
                            ? 'bg-red-500/10 border border-red-500/30'
                            : 'bg-secondary/50 border border-border/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {product.type}
                          </span>
                          {isInAviation && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-500">
                              AVIATION BAND
                            </span>
                          )}
                        </div>

                        <div className="font-mono text-sm text-muted-foreground mb-1">
                          {product.type === '2f1-f2'
                            ? `2 × ${f1} - ${f2}`
                            : `2 × ${f2} - ${f1}`}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-primary">
                            = {product.frequency.toFixed(3)} MHz
                          </span>
                          {product.affectedService && (
                            <span className="text-xs text-accent px-2 py-0.5 rounded bg-accent/10">
                              {product.affectedService}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {calculationResult.dangerousPairs[0].aviationProducts.length > 0 ? (
                    <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
                      <span className="text-sm font-semibold text-red-500">
                        ⚠️ {calculationResult.dangerousPairs[0].aviationProducts.length} product(s) fall within Aviation Band (108-137 MHz)
                      </span>
                    </div>
                  ) : (
                    <div className="mt-3 p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                      <span className="text-sm font-semibold text-green-500">
                        ✓ No products fall within Aviation Band
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Target frequency display for aircraft mode */}
            {mode === 'aircraft-check' && targetAircraftFrequency && (
              <div className="mb-4 p-3 rounded-xl bg-primary/20 border border-primary/30">
                <div className="text-center">
                  <span className="text-sm text-muted-foreground">Searching for FM pairs that create</span>
                  <div className="text-2xl font-bold text-primary">{targetAircraftFrequency} MHz</div>
                </div>
              </div>
            )}

            {/* Summary Stats */}
            {summary && riskAssessments.length > 0 && (
              <div className="mb-4 p-4 rounded-xl bg-secondary/30 border border-border/30">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${getRiskLevelColor('CRITICAL')}`}>
                      {summary.byRisk.CRITICAL}
                    </div>
                    <div className="text-xs text-muted-foreground">Critical</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${getRiskLevelColor('HIGH')}`}>
                      {summary.byRisk.HIGH}
                    </div>
                    <div className="text-xs text-muted-foreground">High</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${getRiskLevelColor('MEDIUM')}`}>
                      {summary.byRisk.MEDIUM}
                    </div>
                    <div className="text-xs text-muted-foreground">Medium</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${getRiskLevelColor('LOW')}`}>
                      {summary.byRisk.LOW}
                    </div>
                    <div className="text-xs text-muted-foreground">Low</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground text-center">
                  Found {calculationResult.dangerousPairs.length} FM station pairs in{' '}
                  {calculationResult.calculationTimeMs.toFixed(2)} ms
                </div>
              </div>
            )}

            {/* Risk Filter */}
            {riskAssessments.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-muted-foreground">Filter by risk:</span>
                <div className="flex gap-1">
                  {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setRiskFilter(level)}
                      className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                        riskFilter === level
                          ? level === 'ALL'
                            ? 'bg-primary text-primary-foreground'
                            : `${getRiskLevelBgColor(level)} ${getRiskLevelColor(level)}`
                          : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Results List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 min-h-0 max-h-[40vh] lg:max-h-[calc(100vh-450px)]">
              {calculationResult.dangerousPairs.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-foreground font-medium">No Interference Found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    No FM station pairs would create {targetAircraftFrequency} MHz interference.
                  </p>
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No results match the current filter.</p>
                </div>
              ) : (
                filteredResults.map((risk, index) => {
                  const product = risk.pair.aviationProducts[0];
                  const f1 = risk.pair.station1.frequency;
                  const f2 = risk.pair.station2.frequency;

                  // Calculate the formula display
                  const formulaDisplay = product?.type === '2f1-f2'
                    ? `2 × ${f1} - ${f2} = ${(2 * f1 - f2).toFixed(2)} MHz`
                    : `2 × ${f2} - ${f1} = ${(2 * f2 - f1).toFixed(2)} MHz`;

                  return (
                    <div
                      key={`${risk.pair.station1.id}-${risk.pair.station2.id}-${index}`}
                      onClick={() => handleResultClick(risk)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] ${getRiskLevelBgColor(
                        risk.riskLevel
                      )}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${getRiskLevelColor(
                            risk.riskLevel
                          )}`}
                        >
                          {risk.riskLevel}
                        </span>
                        {product?.affectedService && (
                          <span className="text-xs text-accent font-medium px-2 py-0.5 rounded bg-accent/10">
                            {product.affectedService}
                          </span>
                        )}
                      </div>

                      {/* Calculation Result - Main Display */}
                      <div className="mb-3 p-3 rounded-lg bg-background/50 border border-border/50">
                        <div className="text-xs text-muted-foreground mb-1">Intermod Calculation</div>
                        <div className="font-mono text-sm text-foreground font-semibold">
                          {formulaDisplay}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">Formula:</span>
                          <span className="text-xs font-mono text-primary">{product?.type}</span>
                        </div>
                        {product?.frequency && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">Result:</span>
                            <span className="text-sm font-bold text-primary">{product.frequency.toFixed(3)} MHz</span>
                            <span className="text-xs text-green-500">(matches target)</span>
                          </div>
                        )}
                      </div>

                      {/* Station Details */}
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-secondary/30">
                          <span className="text-xs text-muted-foreground font-mono w-6">f1:</span>
                          <div className="flex-1">
                            <div className="text-foreground font-medium">{risk.pair.station1.name}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-mono text-primary">{f1} MHz</span>
                              <span>•</span>
                              <span>{risk.pair.station1.city}, {risk.pair.station1.state}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-secondary/30">
                          <span className="text-xs text-muted-foreground font-mono w-6">f2:</span>
                          <div className="flex-1">
                            <div className="text-foreground font-medium">{risk.pair.station2.name}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-mono text-primary">{f2} MHz</span>
                              <span>•</span>
                              <span>{risk.pair.station2.city}, {risk.pair.station2.state}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30 text-xs text-muted-foreground">
                        <span>Station distance: {formatDistance(risk.pair.distance)}</span>
                        {risk.distanceToAircraft !== undefined && (
                          <span>To aircraft: {formatDistance(risk.distanceToAircraft)}</span>
                        )}
                        {onHighlightStations && (
                          <span className="text-primary">Click to view on map →</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
