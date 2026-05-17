export interface InspectionMember {
  userId: number;
  username: string;
  displayName: string;
}

export interface StationInspection {
  id: number;
  stationId: number;
  inspectedOn: string;
  lead: InspectionMember;
  helpers: InspectionMember[];
  notes?: string;
  source: string;
  createdAt: string;
}

export interface CreateInspectionInput {
  stationId: number;
  inspectedOn: string;
  leadUserId: number;
  helperUserIds: number[];
  notes?: string;
}
