// scripts/inspector-map.ts
// xlsx ชื่อผู้ตรวจ string (raw, as it appears in cells) → DB username.
// Names with internal whitespace are normalized (\s+ → single space) before lookup.
export const INSPECTOR_MAP: Record<string, string> = {
  'นางสาว ปิยาพัชร เกิดไพบูลย์(เจ้าหน้าที่ตรวจสอบและปฏิบัติการ)': 'iff',
  'พรคุณพระ กิตติวราพล': 'dao',
  'นายภูวกฤต พลชิงชัย (นตป. ก2)': 'admin',
  'นายภควัต ทะสังขา(วก. ก1)': 'ice',
  'นาย ธีราทร ภิรมย์ไกรภักดิ์(ลูกจ้างประจำ)': 'daf',
};

export function normalizeName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export function mapInspectorName(raw: string): string | null {
  const key = normalizeName(raw);
  return INSPECTOR_MAP[key] ?? null;
}
