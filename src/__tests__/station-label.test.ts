import { describe, it, expect } from 'vitest';
import { stationLabel } from '@/utils/stationLabel';

describe('stationLabel', () => {
  it('prints the NBTC code id_fm now holds, as-is', () => {
    expect(stationLabel({ idFm: 'RFXL680654' })).toBe('RFXL680654');
  });

  it('prefixes a register StationID with FM-', () => {
    expect(stationLabel({ idFm: '5520003' })).toBe('FM-5520003');
  });

  it('renders an em dash when the station has no identifier', () => {
    expect(stationLabel({})).toBe('—');
    expect(stationLabel({ idFm: '  ' })).toBe('—');
  });
});
