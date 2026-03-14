'use client';

import { useState, useMemo } from 'react';
import type { InterferenceSite } from '@/types/interference';
import { validateBearing } from '@/utils/bearingUtils';
import DirectionIndicator from './DirectionIndicator';

interface BearingValidationProps {
  site: InterferenceSite;
}

export default function BearingValidation({ site }: BearingValidationProps) {
  const [tolerance, setTolerance] = useState(30);

  const validation = useMemo(
    () => validateBearing(site, tolerance),
    [site, tolerance]
  );

  if (!validation) return null;

  const { isMatch, calculatedBearing, storedDirection, angularDifference: diff, compassDirection } = validation;

  return (
    <div className={`p-3 rounded-lg border ${
      isMatch
        ? 'bg-green-500/10 border-green-500/20'
        : 'bg-red-500/10 border-red-500/20'
    }`}>
      <div className="flex items-start gap-3">
        <DirectionIndicator
          storedDirection={storedDirection}
          calculatedBearing={calculatedBearing}
          isMatch={isMatch}
        />
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-semibold flex items-center gap-1.5 ${
            isMatch ? 'text-green-500' : 'text-red-500'
          }`}>
            {isMatch ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {isMatch ? 'Direction Match' : 'Direction Mismatch'}
          </div>

          <div className="mt-1.5 space-y-0.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Antenna (stored):</span>
              <span className="text-foreground font-medium" style={{ color: '#6366F1' }}>
                {storedDirection}° <span className="text-muted-foreground">(dashed)</span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">To source (calc):</span>
              <span className={`font-medium ${isMatch ? 'text-green-500' : 'text-red-500'}`}>
                {compassDirection} <span className="text-muted-foreground">(solid)</span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Difference:</span>
              <span className={`font-medium ${isMatch ? 'text-green-500' : 'text-red-500'}`}>
                {diff}°
              </span>
            </div>
          </div>

          {/* Tolerance slider */}
          <div className="mt-2">
            <label className="text-[10px] text-muted-foreground flex justify-between">
              <span>Tolerance</span>
              <span>{tolerance}°</span>
            </label>
            <input
              type="range"
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              className="w-full h-4"
              min={10}
              max={60}
              step={5}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
