// src/types/interferenceInspection.ts
//
// Mirrors src/types/inspection.ts (FM equivalent) — keeps the shapes
// parallel so service/test/route code reads identically across the two
// domains.

export interface InterferenceInspectionMember {
  userId: number;
  username: string;
  displayName: string;
}

export interface InterferenceInspection {
  id: number;
  interferenceId: number;
  inspectedOn: string;        // YYYY-MM-DD
  lead: InterferenceInspectionMember;
  helpers: InterferenceInspectionMember[];
  notes?: string;
  source: string;
  createdAt: string;
}

export interface CreateInterferenceInspectionInput {
  interferenceId: number;
  inspectedOn: string;        // YYYY-MM-DD
  leadUserId: number;
  helperUserIds: number[];
  notes?: string;
}
