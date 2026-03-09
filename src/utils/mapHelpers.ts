import L from 'leaflet';
import { FMStation } from '@/types/station';

// SVG icons for station markers
const radioOnSvg = `<svg class="station-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="3"/>
  <path d="M4.93 4.93a10 10 0 0 1 14.14 0"/>
  <path d="M7.76 7.76a6 6 0 0 1 8.48 0"/>
</svg>`;

const radioOffSvg = `<svg class="station-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="3"/>
  <path d="M4.93 4.93a10 10 0 0 1 14.14 0" opacity="0.3"/>
  <path d="M7.76 7.76a6 6 0 0 1 8.48 0" opacity="0.3"/>
  <line x1="4" y1="4" x2="20" y2="20" stroke-width="2"/>
</svg>`;

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatInspectionDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

export function createStationIcon(
  station: FMStation,
  isHighlighted: boolean = false,
  stationCount: number = 1,
  hasMainStation: boolean = false
): L.DivIcon {
  const hasNoRequest = station.submitRequest === 'ไม่ยื่น';
  const isOffAir = !station.onAir;
  const isInspected = station.inspection69 === 'ตรวจแล้ว';
  const isMainStation = hasMainStation || station.type === 'สถานีหลัก' || station.genre === 'สถานีหลัก';

  let colorClass = 'station-marker--orange';
  if (isHighlighted) {
    colorClass = 'station-marker--gold';
  } else if (hasNoRequest) {
    colorClass = 'station-marker--black';
  } else if (isOffAir) {
    colorClass = 'station-marker--grey';
  } else if (isInspected) {
    colorClass = 'station-marker--green';
  }

  let badge = '';
  if (stationCount > 1 && isMainStation) {
    badge = `<div class="station-badge station-badge--info">★${stationCount}</div>`;
  } else if (stationCount > 1) {
    badge = `<div class="station-badge station-badge--danger">${stationCount}</div>`;
  } else if (isMainStation) {
    badge = '<div class="station-badge station-badge--info">★</div>';
  } else if (hasNoRequest) {
    badge = '<div class="station-badge station-badge--danger">!</div>';
  } else if (isHighlighted) {
    badge = '<div class="station-badge station-badge--warning">⚠</div>';
  } else if (!isInspected) {
    badge = '<div class="station-badge station-badge--warning">⏳</div>';
  }

  const radioIcon = isOffAir ? radioOffSvg : radioOnSvg;
  const pulseRing = isHighlighted ? '<div class="station-marker-pulse"></div>' : '';
  const inspectedMark = isInspected ? '<div class="station-inspected-mark">✓</div>' : '';

  return L.divIcon({
    className: 'custom-station-marker',
    html: `
      <div class="station-marker ${colorClass}">
        ${pulseRing}
        <div class="station-marker-circle">
          ${radioIcon}
        </div>
        <div class="station-marker-pointer"></div>
        ${badge}
        ${inspectedMark}
      </div>
    `,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -38]
  });
}

export function createLocationIcon(): L.DivIcon {
  return L.divIcon({
    className: 'custom-location-icon',
    html: `
      <div class="location-marker">
        <div class="location-pulse"></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });
}

export function getStationIcon(
  stationOrGroup: FMStation | FMStation[],
  highlightedStationIds: (string | number)[],
  count?: number
): L.DivIcon {
  const station = Array.isArray(stationOrGroup) ? stationOrGroup[0] : stationOrGroup;
  const stationsToCheck = Array.isArray(stationOrGroup) ? stationOrGroup : [stationOrGroup];
  const stationCount = count || 1;
  const isHighlighted = stationsToCheck.some(s => highlightedStationIds.includes(s.id));
  const hasMainStation = stationsToCheck.some(s => s.type === 'สถานีหลัก' || s.genre === 'สถานีหลัก');
  return createStationIcon(station, isHighlighted, stationCount, hasMainStation);
}
