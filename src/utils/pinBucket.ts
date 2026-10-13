import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";

/**
 * The states a map marker can be in. Colour, inner glyph and cluster-ring arc
 * are all keyed off this — see `pinTokens.ts`.
 *
 * `critical` is shared: an uninspected revoked FM station with no new licence
 * holder, or an open INT site ranked Critical. The three buckets after it are
 * FM-only and split revoked stations by licence outcome and by visit.
 */
export type PinBucket =
  | "critical"
  | "revokedInspected"
  | "relicensed"
  | "relicensedInspected"
  | "pending"
  | "offair"
  | "inspected";

/** A revoked station whose frequency has been licensed to a new holder. */
export function isRelicensed(s: Pick<FMStation, "revoked" | "permit">): boolean {
  return s.revoked === true && !!s.permit?.trim();
}

/**
 * Classify an FM station.
 *
 * Precedence: revoked → offAir → inspected → pending. This is the *only*
 * precedence in the app: `fmIcon` colours and glyphs the pin from the bucket
 * this returns, so a pin and the cluster arc summarising it can no longer
 * disagree. Revoked outranks on-air metadata because a revoked station is a
 * legal-risk signal either way; off-air outranks inspected so a silent
 * transmitter stays visible as an anomaly.
 *
 * Revoked is the one state that splits further: hue says whether the frequency
 * has a new licence holder (relicensed) and shade says whether it was visited.
 */
export function bucketForStation(
  s: Pick<FMStation, "revoked" | "onAir" | "inspection69" | "permit">
): PinBucket {
  if (s.revoked === true) {
    const inspected = s.inspection69 === "ตรวจแล้ว";
    if (isRelicensed(s)) return inspected ? "relicensedInspected" : "relicensed";
    return inspected ? "revokedInspected" : "critical";
  }
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
 * Whether off-air pins currently show the "already inspected" badge.
 *
 * Gated by the OFF AIR filter chip so the unfiltered map stays quiet.
 * `FieldOpsClient` derives this straight from `FieldFilters`; the map never
 * sees the filter model itself. Revoked pins need no gate: their bucket already
 * says whether they were inspected.
 */
export interface InspectedBadgeGates {
  /** FM "off air" chip — gates the badge on `offair` FM pins. */
  offAir: boolean;
}

export const NO_INSPECTED_BADGES: InspectedBadgeGates = {
  offAir: false,
};

/**
 * Should this FM pin wear the inspected badge?
 *
 * Off-air outranks `inspected` in `bucketForStation`, so a silent station that
 * has actually been visited still draws a grey x. The badge puts the missing
 * fact back without touching the bucket.
 *
 * *Every* station stacked at those coordinates must be inspected, because the
 * pin (and its "+N" badge) stands for all of them. Badging a stack on the head
 * alone would report unfinished work as done.
 */
export function showsInspectedBadge(
  group: FMStation[],
  gates: InspectedBadgeGates
): boolean {
  if (group.length === 0) return false;
  if (bucketForStation(group[0]) !== "offair" || !gates.offAir) return false;
  return group.every((s) => s.inspection69 === "ตรวจแล้ว");
}
