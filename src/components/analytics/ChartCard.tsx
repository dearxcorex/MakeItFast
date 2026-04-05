'use client';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function ChartCard({ title, subtitle, action, children, className = '' }: ChartCardProps) {
  return (
    <div className={`tt-card ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="tt-heading text-base">{title}</h3>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--tt-brown)' }}>
              {subtitle}
            </p>
          )}
          <span className="tt-scallop" aria-hidden="true" />
        </div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}
