import type { StationInspection } from '@/types/inspection';
import { formatInspectionDate } from '@/utils/mapHelpers';
import InspectorChips from './InspectorChips';

export default function InspectionLatest({ latest }: { latest: StationInspection | null }) {
  if (!latest) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium badge-warning">
        ⏳ <span>ยังไม่ตรวจ</span>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium badge-success">
        ✅ <span>ตรวจแล้ว · {formatInspectionDate(latest.inspectedOn)}</span>
      </div>
      <InspectorChips lead={latest.lead} helpers={latest.helpers} />
    </div>
  );
}
