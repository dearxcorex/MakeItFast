import type { AdminStation } from "@/types/station";

export type AdminSortKey = "idFm" | "name" | "freq" | "district" | "province" | "type" | "inspectionCount";
export type SortDir = "asc" | "desc";

export function filterAdminStations(
  rows: AdminStation[],
  { search, province }: { search: string; province: string }
): AdminStation[] {
  const q = search.trim().toLowerCase();
  return rows.filter((r) => {
    if (province !== "All" && r.province !== province) return false;
    if (!q) return true;
    const hay = `${r.name} ${r.idFm ?? ""} ${r.freq ?? ""} ${r.district}`.toLowerCase();
    return hay.includes(q);
  });
}

/** Stable sort; null and empty values sink to the bottom in either direction. */
export function sortAdminStations(rows: AdminStation[], key: AdminSortKey, dir: SortDir): AdminStation[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    const aMissing = av === null || av === "";
    const bMissing = bv === null || bv === "";
    if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
    return String(av).localeCompare(String(bv), "th") * sign;
  });
}
