import type { CameraSource } from "@/types/camera";

export interface CameraSourceRow {
  id: number;
  code: string;
  lat: number;
  long: number;
  found_on: Date;
  district: string;
  province: string;
  landmark: string | null;
  cell_site_code: string | null;
  cell_site_name: string | null;
  cell_site_lat: number | null;
  cell_site_long: number | null;
  cell_site_operators: string | null;
  status: string;
  inspected_at: Date | null;
  inspector?: { display_name: string } | null;
}

/** Prisma `include` that brings the inspector's name along with a row. */
export const CAMERA_INCLUDE = { inspector: { select: { display_name: true } } } as const;

export function convertToCameraSource(r: CameraSourceRow): CameraSource {
  const hasCellSite =
    r.cell_site_code !== null && r.cell_site_lat !== null && r.cell_site_long !== null;
  return {
    id: r.id,
    code: r.code,
    lat: r.lat,
    lng: r.long,
    foundOn: r.found_on.toISOString().slice(0, 10),
    district: r.district,
    province: r.province,
    landmark: r.landmark,
    cellSite: hasCellSite
      ? {
          code: r.cell_site_code as string,
          name: r.cell_site_name ?? (r.cell_site_code as string),
          lat: r.cell_site_lat as number,
          lng: r.cell_site_long as number,
          operators: r.cell_site_operators ? r.cell_site_operators.split("|") : [],
        }
      : null,
    status: r.status,
    inspectedAt: r.inspected_at ? r.inspected_at.toISOString() : null,
    inspectedByName: r.inspector?.display_name ?? null,
  };
}
