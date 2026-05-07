import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";
import type { TypeFilter } from "@/components/field-ops/FieldOpsFilters";

export interface FieldOpsKpis {
  total: number;
  inspected: number;
  pending: number;
  /** null when type=FM (FM has no Critical concept) */
  critical: number | null;
  /** Denominator for the inspected progress %: always the visible total. */
  target: number;
  pct: number;
}

/**
 * Pure tally over already-filtered arrays. Caller is responsible for filtering
 * by province/status/severity/offAir/lawSent/search before passing in.
 */
export function computeKpis(
  stations: FMStation[],
  interference: InterferenceSite[],
  type: TypeFilter
): FieldOpsKpis {
  const total = stations.length + interference.length;

  const fmInspected = stations.filter(
    (s) => s.inspection69 === "ตรวจแล้ว"
  ).length;
  const intInspected = interference.filter(
    (s) => s.status === "ตรวจแล้ว"
  ).length;
  const inspected = fmInspected + intInspected;

  const pending = total - inspected;
  const critical =
    type === "FM"
      ? null
      : interference.filter((s) => s.ranking === "Critical").length;

  const target = total;
  const pct =
    target > 0 ? Math.min(100, Math.round((inspected / target) * 100)) : 0;

  return { total, inspected, pending, critical, target, pct };
}
