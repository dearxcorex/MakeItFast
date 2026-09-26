import { TARGET_PROVINCES } from "./offairAudit";

/** The four values fm_station.type holds. A form offering anything else would mint a fifth. */
export const STATION_TYPES = ["บริการธุรกิจ", "บริการชุมชน", "บริการสาธารณะ", "สถานีหลัก"] as const;

export const FM_BAND_MHZ = { min: 87.5, max: 108 } as const;

// A loose box around นครราชสีมา + ชัยภูมิ. It exists to catch swapped lat/long
// and stray pastes, not to police the province border — the dropdown does that.
export const COVERAGE_BOX = { minLat: 14.0, maxLat: 17.0, minLong: 100.9, maxLong: 103.3 } as const;

/** The fm_station columns the admin Data tab may write. */
export interface StationWrite {
  name: string;
  freq: number;
  lat: number;
  long: number;
  district: string;
  province: string;
  type: string;
  id_fm: string | null;
  permit: string | null;
  submit_a_request: boolean;
  revoked: boolean;
  revoked_note: string | null;
}

export type StationInputField =
  | "name" | "freq" | "lat" | "long" | "district" | "province" | "type" | "idFm";

export type ParseStationResult =
  | { ok: true; data: StationWrite }
  | { ok: false; errors: Partial<Record<StationInputField, string>> };

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number {
  return typeof v === "number" ? v : NaN;
}

/**
 * Validate a camelCase station body from the Data tab form into fm_station
 * columns. Shared by the form (to show errors before a round trip) and the
 * admin routes (which trust nothing). Always a full record: the form sends
 * every field on edit too, so there is no partial-update path to get wrong.
 */
export function parseStationInput(body: unknown): ParseStationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, errors: { name: "ข้อมูลไม่ถูกต้อง" } };
  }
  const b = body as Record<string, unknown>;
  const errors: Partial<Record<StationInputField, string>> = {};

  const name = text(b.name);
  if (!name) errors.name = "กรุณาระบุชื่อสถานี";

  const freq = num(b.freq);
  if (!Number.isFinite(freq) || freq < FM_BAND_MHZ.min || freq > FM_BAND_MHZ.max) {
    errors.freq = `ความถี่ต้องอยู่ระหว่าง ${FM_BAND_MHZ.min}–${FM_BAND_MHZ.max} MHz`;
  }

  const lat = num(b.lat);
  const long = num(b.long);
  if (!Number.isFinite(lat) || lat < COVERAGE_BOX.minLat || lat > COVERAGE_BOX.maxLat) {
    errors.lat = "ละติจูดอยู่นอกพื้นที่ นครราชสีมา/ชัยภูมิ (สลับ lat/long หรือไม่?)";
  }
  if (!Number.isFinite(long) || long < COVERAGE_BOX.minLong || long > COVERAGE_BOX.maxLong) {
    errors.long = "ลองจิจูดอยู่นอกพื้นที่ นครราชสีมา/ชัยภูมิ";
  }

  const district = text(b.district);
  if (!district) errors.district = "กรุณาระบุอำเภอ";

  const province = text(b.province);
  if (!(TARGET_PROVINCES as readonly string[]).includes(province)) {
    errors.province = "จังหวัดต้องเป็น นครราชสีมา หรือ ชัยภูมิ";
  }

  const type = text(b.type);
  if (!(STATION_TYPES as readonly string[]).includes(type)) {
    errors.type = "กรุณาเลือกประเภทสถานี";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const revoked = b.revoked === true;
  return {
    ok: true,
    data: {
      name,
      freq,
      lat,
      long,
      district,
      province,
      type,
      id_fm: text(b.idFm) || null,
      permit: text(b.permit) || null,
      submit_a_request: b.submitRequest === true,
      revoked,
      revoked_note: revoked ? text(b.revokedNote) || null : null,
    },
  };
}
