import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";
import type { CameraSource } from "@/types/camera";
import type { TypeFilter } from "@/components/field-ops/FieldOpsFilters";
import { isCameraInspected } from "@/utils/cameraSources";

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
  type: TypeFilter,
  cameras: CameraSource[] = []
): FieldOpsKpis {
  // Cameras get their own tally under the กล้อง chip and stay out of the
  // FM + interference progress everywhere else.
  if (type === "CAMERA") {
    const total = cameras.length;
    const inspected = cameras.filter(isCameraInspected).length;
    const pct = total > 0 ? Math.round((inspected / total) * 100) : 0;
    return { total, inspected, pending: total - inspected, critical: null, target: total, pct };
  }

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
