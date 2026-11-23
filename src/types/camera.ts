/** The cell site a camera interferes with, resolved at import time. */
export interface CameraCellSite {
  code: string;
  name: string;
  lat: number;
  lng: number;
  operators: string[];
}

/** A camera that is a source of interference on a cell site. */
export interface CameraSource {
  id: number;
  /** `<cell site>_<sector>` as written in the source sheet, e.g. `KGDGM_3`. */
  code: string;
  lat: number;
  lng: number;
  /** วันที่พบ, YYYY-MM-DD. */
  foundOn: string;
  district: string;
  province: string;
  landmark: string | null;
  /** null when the code matches no known cell site. */
  cellSite: CameraCellSite | null;
  /** Comparison value, like the other inspection statuses: 'ตรวจแล้ว' / 'ยังไม่ตรวจ'. */
  status: string;
  inspectedAt: string | null;
  inspectedByName: string | null;
}
