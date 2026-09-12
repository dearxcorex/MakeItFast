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
export function bucketForStation(s: FMStation): PinBucket {
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
