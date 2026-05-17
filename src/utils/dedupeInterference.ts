import type { InterferenceSite } from "@/types/interference";

/**
 * The interference DB has duplicate rows for the same physical cellsite/sector
 * (e.g. one row carries an old "High interference" measurement string in `status`
 * while a newer row carries the actual inspection state "ตรวจแล้ว"). The map
 * renders one marker per row, so duplicates show up as overlapping pins with
 * conflicting INSPECTED/PENDING badges.
 *
 * Dedupe at the UI layer:
 *  - Group by (siteCode, cellName, sectorName, direction). Rows missing all
 *    four identifiers fall back to their own `id` so they're never merged.
 *  - Within a group, if ANY sibling has status === "ตรวจแล้ว", the merged
 *    representative is that inspected row. Otherwise pick the most recently
 *    updated row.
 *  - `lawPaperSent` is OR'ed across siblings (any one signals the group).
 */
export function dedupeInterferenceSites(
  sites: InterferenceSite[]
): InterferenceSite[] {
  const groups = new Map<string, InterferenceSite[]>();

  for (const s of sites) {
    const haveAnyKey =
      s.siteCode || s.cellName || s.sectorName || s.direction !== null;
    const key = haveAnyKey
      ? `${s.siteCode ?? ""}::${s.cellName ?? ""}::${s.sectorName ?? ""}::${s.direction ?? ""}`
      : `__id::${s.id}`;
    const arr = groups.get(key);
    if (arr) arr.push(s);
    else groups.set(key, [s]);
  }

  const out: InterferenceSite[] = [];
  for (const arr of groups.values()) {
    if (arr.length === 1) {
      out.push(arr[0]);
      continue;
    }
    const inspected = arr.find((s) => s.status === "ตรวจแล้ว");
    const anyLawSent = arr.some((s) => s.lawPaperSent === true);
    const newest = [...arr].sort((a, b) => {
      const at = new Date(a.updatedAt as unknown as string).getTime() || 0;
      const bt = new Date(b.updatedAt as unknown as string).getTime() || 0;
      return bt - at;
    })[0];
    const head = inspected ?? newest;
    out.push({
      ...head,
      status: inspected ? "ตรวจแล้ว" : head.status,
      lawPaperSent: anyLawSent ? true : head.lawPaperSent,
    });
  }
  return out;
}
