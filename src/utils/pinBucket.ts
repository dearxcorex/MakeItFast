import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";

/**
 * The four states a map marker can be in. Colour, inner glyph, cluster-ring
 * arc and legend row are all keyed off this — see `pinTokens.ts`.
 */
export type PinBucket = "critical" | "pending" | "offair" | "inspected";

/**
 * Classify an FM station.
 *
 * Precedence: revoked → offAir → inspected → pending. This is the *only*
 * precedence in the app: `fmIcon` colours and glyphs the pin from the bucket
 * this returns, so a pin and the cluster arc summarising it can no longer
 * disagree. Revoked outranks everything because a revoked station is a legal
 * -risk signal regardless of inspection or on-air metadata; off-air outranks
 * inspected so a silent transmitter stays visible as an anomaly.
 */
export function bucketForStation(
  s: Pick<FMStation, "revoked" | "onAir" | "inspection69">
): PinBucket {
  if (s.revoked === true) return "critical";
  if (!s.onAir) return "offair";
  if (s.inspection69 === "ตรวจแล้ว") return "inspected";
  return "pending";
}

/**
 * Classify an interference site.
 *
 * Precedence: inspected wins over critical (a finished critical is no longer
 * open work). For pending sites, ranking === "Critical" promotes to the
 * critical bucket; every other ranking — Major, Minor, missing — is pending.
 * Ranking comparison is case-insensitive because upstream data has mixed
 * casing. INT sites have no on-air concept, so they never bucket to `offair`.
 */
export function bucketForSite(s: InterferenceSite): PinBucket {
  if (s.status === "ตรวจแล้ว") return "inspected";
  if ((s.ranking ?? "").toLowerCase() === "critical") return "critical";
  return "pending";
}

/**
 * Which buckets currently show the "already inspected" badge.
 *
 * Deliberately one flag per bucket rather than a single boolean: the badge is
 * gated by the filter chip that surfaced the pin, so REVOKED on must not put
 * ticks on off-air pins and vice versa. `FieldOpsClient` derives this straight
 * from `FieldFilters`; the map never sees the filter model itself.
 */
export interface InspectedBadgeGates {
  /** FM "revoked" chip — gates the badge on `critical` FM pins. */
  revoked: boolean;
  /** FM "off air" chip — gates the badge on `offair` FM pins. */
  offAir: boolean;
}

export const NO_INSPECTED_BADGES: InspectedBadgeGates = {
  revoked: false,
  offAir: false,
};

/**
 * Should this FM pin wear the inspected badge?
 *
 * Revoked and off-air both outrank `inspected` in `bucketForStation`, so a
 * station that has actually been visited still draws a red ! or a grey x. The
 * badge is the third channel that puts the missing fact back without touching
 * the bucket — colour still means "legal / on-air state", the badge means "we
 * have been here". Precedence stays as it is: a revoked station is a legal-risk
 * signal whether or not anyone inspected it.
 *
 * Two conditions:
 *  - the group's bucket must be `critical` or `offair` AND its gate must be on
 *  - *every* station stacked at those coordinates must be inspected, because
 *    the pin (and its "+N" badge) stands for all of them. Badging a stack on
 *    the head alone would report unfinished work as done.
 */
export function showsInspectedBadge(
  group: FMStation[],
  gates: InspectedBadgeGates
): boolean {
  if (group.length === 0) return false;

  const bucket = bucketForStation(group[0]);
  if (bucket === "critical" && !gates.revoked) return false;
  if (bucket === "offair" && !gates.offAir) return false;
  if (bucket !== "critical" && bucket !== "offair") return false;

  return group.every((s) => s.inspection69 === "ตรวจแล้ว");
}
