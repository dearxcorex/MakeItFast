# Analytics Teammate-Count Audit — Findings

**Date:** 2026-05-17
**Spec:** [`../specs/2026-05-17-analytics-count-audit-design.md`](../specs/2026-05-17-analytics-count-audit-design.md)
**Plan:** [`../plans/2026-05-17-analytics-count-audit.md`](../plans/2026-05-17-analytics-count-audit.md)
**DB:** Neon (production)
**Query method:** Prisma `$queryRawUnsafe` via `node -e` (psql binary not installed in this environment)

## Phase 1 — DB sanity queries

| Q | Description | Row count | Sample (up to 3 rows) | Remediation |
|---|---|---|---|---|
| Q1 | Orphan station_inspection_member rows | **0** | none | No action needed. FK + onDelete cascade is intact. |
| Q2 | Lead user also in members of same inspection | **0** | none | No action needed. |
| Q3 | Duplicate (station, date, lead) | **0** | none | No action needed. Unique constraint is holding. |
| Q4 | Inspections with deactivated/non-inspector lead | **0** | none | No action needed. All historic leads are still active inspectors. |
| Q5 | Inspections with no matching station | **0** | none | No action needed. FK to fm_station is intact. |
| Q6 | fm_station.inspection_69=true but no history | **10** | `id_fm=2 "สวท. จังหวัดชัยภูมิ" date_inspected=2026-02-20`; `id_fm=5520287 "HOT RADIO" date_inspected=2026-04-21`; `id_fm=5520203 "Youth Crazy" date_inspected=2026-02-19` (+ 7 more) | Leave alone. These are pre-history toggles — legitimate inspections recorded before the station_inspection table existed. Count (10) is well under the 50-row escalation threshold. |
| Q7 | History rows for stations where inspection_69=false (B1 drift) | **1 → 0** (remediated) | `inspection.id=27, station_id=5520076, name="คนหมื่นไวย", inspection_69=false` | **B1 drift confirmed and remediated.** User authorized `DELETE FROM station_inspection WHERE id = 27;` after the audit surfaced it. Verified post-delete: Q7 re-run returns 0 rows. |

### Q6 detail (all 5 rows returned by sample query)

| id_fm | name | date_inspected |
|---|---|---|
| 2 | สวท. จังหวัดชัยภูมิ | 2026-02-20 |
| 5520287 | HOT RADIO | 2026-04-21 |
| 5520203 | Youth Crazy | 2026-02-19 |
| 5520101 | จอมสุรางค์ | 2026-02-19 |
| 5520274 | DFM | 2026-04-21 |

(5 shown; 10 total — all under the 50-row escalation threshold)

### Q7 detail (the 1 B1 drift row — now deleted)

| inspection.id | station_id | station name | inspection_69 | status |
|---|---|---|---|---|
| 27 | 5520076 | คนหมื่นไวย | false | deleted 2026-05-17 (user-authorized) |

## Phase 2 — Fix commits

| Fix | Description | Commit |
|---|---|---|
| Fix 1 | Toggle OFF deletes today's caller-owned history row | a8ec31f |
| Fix 2 | Remove Math.max; raw query is source of truth | ba5810c |
| Fix 3 | mostTaggedHelperThisYear iterates past deactivated | df40683 |

## Phase 3 — Tests

| File | Cases |
|---|---|
| `src/__tests__/analytics-invariants.test.ts` | 5 |
| `src/__tests__/api-routes.test.ts` (toggle-OFF cases) | 3 |

## Reconciliation

(filled at the end — describes "before this audit the dashboard could report X; after, it reports Y")
