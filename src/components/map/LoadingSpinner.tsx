export default function LoadingSpinner({ size = 'md', text }: { size?: 'sm' | 'md'; text?: string }) {
  const iconClass = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  if (text) {
    return (
      <div className="flex items-center gap-1">
        <svg className={`${iconClass} animate-spin`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>{text}</span>
      </div>
    );
  }

  return (
    <svg className={`${iconClass} animate-spin`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
