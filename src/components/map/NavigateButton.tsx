export default function NavigateButton({ lat, lng, stationName }: { lat: number; lng: number; stationName?: string }) {
  return (
    <div className="mt-2 pt-2 border-t border-border/30 flex justify-center">
      <button
        onClick={() => {
          const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
          window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
        }}
        className="inline-flex items-center justify-center gap-1 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 rounded-full text-xs font-medium transition-all duration-200 hover:shadow-sm"
        aria-label={stationName ? `Navigate to ${stationName} with Google Maps` : 'Navigate with Google Maps'}
      >
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <span>Navigate</span>
      </button>
    </div>
  );
}
