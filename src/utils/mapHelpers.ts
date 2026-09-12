import L from 'leaflet';

export interface LocationIconOptions {
  heading?: number | null;
  stale?: boolean;
}

export function createLocationIcon(opts: LocationIconOptions = {}): L.DivIcon {
  const { heading = null, stale = false } = opts;
  const hasHeading = typeof heading === 'number' && Number.isFinite(heading);

  const cone = hasHeading
    ? `<svg
         class="heading-cone${stale ? ' heading-cone--stale' : ''}"
         viewBox="-40 -40 80 80"
         width="80"
         height="80"
         style="position:absolute;top:0;left:0;transform:rotate(${(heading as number).toFixed(1)}deg);transform-origin:50% 50%;"
         aria-hidden="true"
       >
         <defs>
           <radialGradient id="heading-cone-grad" cx="50%" cy="100%" r="100%">
             <stop offset="0%" stop-color="rgba(34,211,238,0.55)" />
             <stop offset="100%" stop-color="rgba(34,211,238,0)" />
           </radialGradient>
         </defs>
         <path d="M 0 0 L -18 -36 A 40 40 0 0 1 18 -36 Z" fill="url(#heading-cone-grad)" />
       </svg>`
    : '';

  const pulseClass = stale ? 'location-pulse location-pulse--paused' : 'location-pulse';

  return L.divIcon({
    className: 'custom-location-icon',
    html: `
      <div class="location-marker-host">
        ${cone}
        <div class="location-dot">
          <div class="${pulseClass}"></div>
        </div>
      </div>
    `,
    iconSize: [80, 80],
    iconAnchor: [40, 40],
    popupAnchor: [0, -40],
  });
}
