import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";

export type PinBucket = "critical" | "pending" | "inspected";

/**
 * Classify an FM station for cluster visualization.
 *
 * Precedence: revoked → critical (overrides inspection — revoked stations are
 * a legal-risk signal regardless of inspection state). Otherwise inspected
 * wins over pending. Mirrors the per-pin colour priority in `fmIcon`.
 */
export function bucketForStation(s: FMStation): PinBucket {
  if (s.revoked === true) return "critical";
  if (s.inspection69 === "ตรวจแล้ว") return "inspected";
  return "pending";
}

/**
 * Classify an interference site for cluster visualization.
 *
 * Precedence: inspected wins over critical (a finished critical is no longer
 * urgent work). For pending sites, ranking === "Critical" promotes to the
 * critical bucket. Ranking comparison is case-insensitive because upstream
 * data has mixed casing.
 */
export function bucketForSite(s: InterferenceSite): PinBucket {
  if (s.status === "ตรวจแล้ว") return "inspected";
  if ((s.ranking ?? "").toLowerCase() === "critical") return "critical";
  return "pending";
}
