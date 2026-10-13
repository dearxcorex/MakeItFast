// `ranking` is stored in English ('Critical' / 'Major' / 'Minor') and compared
// as-is by the severity filter; this is display only.
const RANKING_LABEL: Record<string, string> = {
  critical: "วิกฤต",
  major: "รุนแรง",
  minor: "เล็กน้อย",
};

export function rankingLabel(ranking: string): string {
  return RANKING_LABEL[ranking.toLowerCase()] ?? ranking;
}
