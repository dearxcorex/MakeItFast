import type { InspectionMember } from '@/types/inspection';

interface Props {
  lead: InspectionMember;
  helpers: InspectionMember[];
}

export default function InspectorChips({ lead, helpers }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary"
        title={`Lead inspector: ${lead.displayName}`}
      >
        <span aria-hidden>★</span>{lead.displayName}
      </span>
      {helpers.map((h) => (
        <span
          key={h.userId}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground"
          title={`Helper: ${h.displayName}`}
        >
          {h.displayName}
        </span>
      ))}
    </div>
  );
}
