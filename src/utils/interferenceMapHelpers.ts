import L from 'leaflet';

export function getRankingColor(ranking: string | null): string {
  switch (ranking?.toLowerCase()) {
    case 'critical':
      return '#EF4444';
    case 'major':
      return '#F59E0B';
    case 'minor':
      return '#FACC15';
    default:
      return '#6B7280';
  }
}

export function createTowerIcon(
  ranking: string | null,
  isSelected: boolean = false
): L.DivIcon {
  const color = getRankingColor(ranking);
  const size = isSelected ? 36 : 28;
  const borderWidth = isSelected ? 3 : 2;
  const glowSize = isSelected ? 8 : 0;

  return L.divIcon({
    className: 'interference-tower-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          border: ${borderWidth}px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3)${glowSize ? `, 0 0 ${glowSize}px ${color}` : ''};
        ">
          <svg width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/>
            <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/>
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
          </svg>
        </div>
        <div style="
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 8px solid ${color};
        "></div>
      </div>
    `,
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 6],
    popupAnchor: [0, -size],
  });
}

export function createSourceIcon(): L.DivIcon {
  return L.divIcon({
    className: 'interference-source-marker',
    html: `
      <div style="
        width: 20px;
        height: 20px;
        background: #DC2626;
        border: 2px solid white;
        border-radius: 4px;
        transform: rotate(45deg);
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -14],
  });
}
