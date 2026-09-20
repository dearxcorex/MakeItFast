import { describe, it, expect } from 'vitest';
import { stationLabel } from '@/utils/stationLabel';

describe('stationLabel', () => {
  it('prints the NBTC code id_fm now holds, as-is', () => {
    expect(stationLabel({ idFm: 'RFXL680654' })).toBe('RFXL680654');
  });

  it('prefixes a register StationID with FM-', () => {
    expect(stationLabel({ idFm: '5520003' })).toBe('FM-5520003');
  });

  it('falls back to nbtcCode when id_fm has not caught up', () => {
    expect(stationLabel({ nbtcCode: 'RFY217640017' })).toBe('RFY217640017');
  });

  it('prefers id_fm over nbtcCode', () => {
    expect(stationLabel({ idFm: 'RFXL680654', nbtcCode: 'RFXL999999' })).toBe('RFXL680654');
  });

  it('renders an em dash when the station has neither', () => {
    expect(stationLabel({})).toBe('—');
    expect(stationLabel({ idFm: '  ', nbtcCode: '' })).toBe('—');
  });
});
