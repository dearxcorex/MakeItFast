import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";
import type { TypeFilter } from "@/components/field-ops/FieldOpsFilters";

export interface FieldOpsKpis {
  total: number;
  inspected: number;
  pending: number;
  /** null when type=FM (FM has no Critical concept) */
  critical: number | null;
  pct: number;
}

export function computeKpis(
  stations: FMStation[],
  interference: InterferenceSite[],
  type: TypeFilter
): FieldOpsKpis {
  const showFM = type === "ALL" || type === "FM";
  const showINT = type === "ALL" || type === "INT";

  const fmTotal = showFM ? stations.length : 0;
  const intTotal = showINT ? interference.length : 0;
  const total = fmTotal + intTotal;

  const fmInspected = showFM
    ? stations.filter((s) => s.inspection69 === "ตรวจแล้ว").length
    : 0;
  const intInspected = showINT
    ? interference.filter((s) => s.status === "ตรวจแล้ว").length
    : 0;
  const inspected = fmInspected + intInspected;

  const pending = total - inspected;
  const critical = showINT
    ? interference.filter((s) => s.ranking === "Critical").length
    : null;
  const pct = total > 0 ? Math.round((inspected / total) * 100) : 0;

  return { total, inspected, pending, critical, pct };
}
