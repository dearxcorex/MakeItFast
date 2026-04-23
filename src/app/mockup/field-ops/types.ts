export type FieldTaskType = "fm" | "interference";
export type FieldTaskStatus = "pending" | "in_progress" | "inspected" | "law_sent";
export type FieldTaskRanking = "critical" | "major" | "minor" | null;

export interface FieldTask {
  id: string;
  type: FieldTaskType;
  title: string;
  province: string;
  district: string;
  status: FieldTaskStatus;
  ranking: FieldTaskRanking;
  lat: number;
  long: number;
  etaMinutes: number;
  distanceKm: number;
  freq?: number;
  direction?: number;
  note?: string;
}

export const googleMapsUrl = (lat: number, long: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${long}&travelmode=driving`;
