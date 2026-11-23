import type { CameraCellSite, CameraSource } from "@/types/camera";
import type { CellSite } from "@/utils/cellSites";

export const CAMERA_INSPECTED = "ตรวจแล้ว";
export const CAMERA_PENDING = "ยังไม่ตรวจ";

/** Kept here rather than imported so the browser bundle stays free of audit code. */
const COVERED_PROVINCES = ["นครราชสีมา", "ชัยภูมิ"];
const PROVINCE_ALIASES: Record<string, string> = { โคราช: "นครราชสีมา" };

/** One sheet row, header → cell, as SheetJS returns it. */
export interface RawCameraRow {
  Latitude?: unknown;
  Longitude?: unknown;
  Code?: unknown;
  Date?: unknown;
  "อำเภอ"?: unknown;
  "จุดเด่น"?: unknown;
  "จังหวัด"?: unknown;
}

export interface ParsedCamera {
  code: string;
  lat: number;
  lng: number;
  foundOn: string;
  district: string;
  province: string;
  landmark: string | null;
}

export interface SkippedCamera {
  code: string;
  reason: string;
}

const text = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

export function normaliseCameraProvince(name: string): string {
  const trimmed = name.trim();
  return PROVINCE_ALIASES[trimmed] ?? trimmed;
}

/** Excel serial, Date or YYYY-MM-DD → YYYY-MM-DD, without any timezone shift. */
export function cameraDate(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    const ms = Date.UTC(1899, 11, 30) + Math.floor(v) * 86_400_000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = text(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/**
 * Validate sheet rows. Anything unusable or outside this office's coverage is
 * returned in `skipped` with a reason, so a re-import cannot add it by accident.
 */
export function parseCameraRows(raw: RawCameraRow[]): {
  cameras: ParsedCamera[];
  skipped: SkippedCamera[];
} {
  const cameras: ParsedCamera[] = [];
  const skipped: SkippedCamera[] = [];
  const seen = new Set<string>();

  for (const r of raw) {
    const code = text(r.Code);
    const skip = (reason: string) => skipped.push({ code: code || "(ไม่มีรหัส)", reason });
    if (!code) { skip("missing code"); continue; }
    if (seen.has(code)) { skip("duplicate code"); continue; }

    const lat = typeof r.Latitude === "number" ? r.Latitude : Number(text(r.Latitude) || NaN);
    const lng = typeof r.Longitude === "number" ? r.Longitude : Number(text(r.Longitude) || NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      skip("invalid coordinates");
      continue;
    }
    const foundOn = cameraDate(r.Date);
    if (!foundOn) { skip("invalid date"); continue; }

    const province = normaliseCameraProvince(text(r["จังหวัด"]));
    if (!COVERED_PROVINCES.includes(province)) {
      skip(`outside coverage (${province || "no province"})`);
      continue;
    }

    seen.add(code);
    cameras.push({
      code,
      lat,
      lng,
      foundOn,
      district: text(r["อำเภอ"]),
      province,
      landmark: text(r["จุดเด่น"]) || null,
    });
  }
  return { cameras, skipped };
}

/** `KGDGM_3` → `KGDGM`. A code without a sector suffix is returned as is. */
export const cameraSiteCode = (code: string): string => code.replace(/_[^_]+$/, "");

function matchesSiteCode(stationCode: string | null, siteCode: string): boolean {
  if (!stationCode) return false;
  return stationCode
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .includes(siteCode.toUpperCase());
}

/** Find the licensed cell site a camera code points at, by its station code. */
export function findCameraCellSite(code: string, sites: CellSite[]): CameraCellSite | null {
  const siteCode = cameraSiteCode(code);
  for (const site of sites) {
    const licences = [...site.licences.AWN, ...site.licences.NT, ...site.licences.TUC];
    const matched = licences.find((l) => matchesSiteCode(l.stationCode, siteCode));
    if (!matched) continue;
    // Other licences at the tower carry the readable name: "878041 กลางดง".
    const named = licences
      .map((l) => l.stationCode ?? "")
      .find((c) => /[฀-๿]/.test(c));
    return {
      code: matched.stationCode as string,
      name: named ? named.replace(/^\d+\s*/, "").trim() : (matched.stationCode as string),
      lat: site.lat,
      lng: site.lng,
      operators: site.operators,
    };
  }
  return null;
}

/** Split a sheet into rows to add and update, and report rows it no longer lists. */
export function planCameraImport(cameras: ParsedCamera[], existingCodes: string[]) {
  const existing = new Set(existingCodes);
  const incoming = new Set(cameras.map((c) => c.code));
  return {
    toAdd: cameras.filter((c) => !existing.has(c.code)),
    toUpdate: cameras.filter((c) => existing.has(c.code)),
    missingFromFile: existingCodes.filter((c) => !incoming.has(c)),
  };
}

/** Fields for updating a row: a blank จุดเด่น in the sheet keeps the saved one. */
export function cameraUpdateData<T extends { landmark: string | null }>(
  data: T
): T | Omit<T, "landmark"> {
  if (data.landmark !== null) return data;
  const rest: Partial<T> = { ...data };
  delete rest.landmark;
  return rest as Omit<T, "landmark">;
}

export const isCameraInspected = (c: Pick<CameraSource, "status">): boolean =>
  c.status === CAMERA_INSPECTED;

/** The filters a camera has data for; FM- and INT-only toggles do not apply. */
export function cameraMatchesFilter(
  c: CameraSource,
  filters: { type: string; province: string; status: string; search: string }
): boolean {
  if (filters.type !== "ALL" && filters.type !== "CAMERA") return false;
  if (filters.province !== "All" && c.province !== filters.province) return false;
  if (filters.status === "PENDING" && isCameraInspected(c)) return false;
  if (filters.status === "INSPECTED" && !isCameraInspected(c)) return false;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const hay = `${c.code} ${c.district} ${c.province} ${c.landmark ?? ""} ${c.cellSite?.name ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}
