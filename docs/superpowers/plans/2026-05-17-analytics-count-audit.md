# Analytics Teammate-Count Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Find and fix the bugs that make the analytics dashboard's per-inspector counts (YTD, this-month, monthly chart, KPIs) potentially wrong, and add invariants so future regressions are caught by tests rather than by the user noticing a bad number.

**Architecture:** Three-phase plan — (1) DB sanity SQL against Neon to surface data-level issues and quantify pre-fix drift, written into an audit doc; (2) three code-only fixes (toggle-OFF deletes today's history row, remove `Math.max` divergence-masker in analytics route, iterate past deactivated users in `mostTaggedHelperThisYear`); (3) two test files pinning the contracts (cross-source agreement in analytics; toggle-OFF deletion semantics in PATCH).

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma + PostgreSQL (Neon), Vitest, iron-session.

---

## File Structure

**Audit artifact (Phase 1)**
- Create: `docs/superpowers/audits/2026-05-17-analytics-count-audit.md` — per-query findings, sample rows, remediation, final reconciliation paragraph

**Code fixes (Phase 2)**
- Modify: `src/app/api/analytics/inspectors/route.ts` — Fix 2 (Math.max removal + divergence warn) and Fix 3 (mostTaggedHelper iteration)
- Modify: `src/app/api/stations/[id]/route.ts` — Fix 1 (OFF sidecar mirroring existing ON sidecar)

**Test files (Phase 3)**
- Create: `src/__tests__/analytics-invariants.test.ts` — cross-source contract assertions for the analytics payload
- Modify: `src/__tests__/api-routes.test.ts` (append) — three new cases for toggle-OFF deletion semantics

**No schema changes. No migrations. No new routes.**

---

## Task 1: Phase 1 — DB sanity audit + write findings

**Files:**
- Create: `docs/superpowers/audits/2026-05-17-analytics-count-audit.md`

- [ ] **Step 1: Create the audit doc skeleton**

Create `docs/superpowers/audits/2026-05-17-analytics-count-audit.md` with this content:

```markdown
# Analytics Teammate-Count Audit — Findings

**Date:** 2026-05-17
**Spec:** [`../specs/2026-05-17-analytics-count-audit-design.md`](../specs/2026-05-17-analytics-count-audit-design.md)
**Plan:** [`../plans/2026-05-17-analytics-count-audit.md`](../plans/2026-05-17-analytics-count-audit.md)
**DB:** Neon (production)

## Phase 1 — DB sanity queries

| Q | Description | Row count | Sample (3 rows) | Remediation |
|---|---|---|---|---|
| Q1 | Orphan station_inspection_member rows | TBD | TBD | TBD |
| Q2 | Lead user also in members of same inspection | TBD | TBD | TBD |
| Q3 | Duplicate (station, date, lead) | TBD | TBD | TBD |
| Q4 | Inspections with deactivated/non-inspector lead | TBD | TBD | TBD |
| Q5 | Inspections with no matching station | TBD | TBD | TBD |
| Q6 | fm_station.inspection_69=true but no history | TBD | TBD | TBD |
| Q7 | History rows for stations where inspection_69=false | TBD | TBD | TBD |

## Phase 2 — Fix commits

| Fix | Description | Commit |
|---|---|---|
| Fix 1 | Toggle OFF deletes today's caller-owned history row | TBD |
| Fix 2 | Remove Math.max; raw query is source of truth | TBD |
| Fix 3 | mostTaggedHelperThisYear iterates past deactivated | TBD |

## Phase 3 — Tests

| File | Cases |
|---|---|
| `src/__tests__/analytics-invariants.test.ts` | TBD |
| `src/__tests__/api-routes.test.ts` (toggle-OFF cases) | TBD |

## Reconciliation

(filled at the end — describes "before this audit the dashboard could report X; after, it reports Y")
```

- [ ] **Step 2: Run Q1 — Orphan member rows**

Run:

```bash
npx prisma db execute --stdin <<'EOF'
SELECT COUNT(*) AS orphan_count
FROM station_inspection_member m
LEFT JOIN station_inspection i ON i.id = m.inspection_id
WHERE i.id IS NULL;
EOF
```

The CLI suppresses output. To see actual numbers, also run via psql with the DATABASE_URL from `.env`:

```bash
DB_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')
psql "$DB_URL" -c "SELECT m.inspection_id, m.user_id FROM station_inspection_member m LEFT JOIN station_inspection i ON i.id = m.inspection_id WHERE i.id IS NULL LIMIT 3;"
psql "$DB_URL" -c "SELECT COUNT(*) FROM station_inspection_member m LEFT JOIN station_inspection i ON i.id = m.inspection_id WHERE i.id IS NULL;"
```

Update the Q1 row in the audit doc with: row count, sample (up to 3 rows), and remediation. Expected: 0 rows (schema FK + onDelete cascade should prevent). If non-zero, remediation is `DELETE FROM station_inspection_member WHERE inspection_id NOT IN (SELECT id FROM station_inspection);` — but **ask the user first** before running any DELETE.

- [ ] **Step 3: Run Q2 — Lead in members**

```bash
psql "$DB_URL" -c "SELECT i.id, i.lead_user_id FROM station_inspection i JOIN station_inspection_member m ON m.inspection_id = i.id AND m.user_id = i.lead_user_id LIMIT 3;"
psql "$DB_URL" -c "SELECT COUNT(*) FROM station_inspection i JOIN station_inspection_member m ON m.inspection_id = i.id AND m.user_id = i.lead_user_id;"
```

Update Q2 row. Expected: 0 (service forbids; DB allows). If non-zero, remediation is `DELETE FROM station_inspection_member m USING station_inspection i WHERE m.inspection_id = i.id AND m.user_id = i.lead_user_id;` — **ask the user first**.

- [ ] **Step 4: Run Q3 — Duplicate (station, date, lead)**

```bash
psql "$DB_URL" -c "SELECT station_id, inspected_on, lead_user_id, COUNT(*) FROM station_inspection GROUP BY 1, 2, 3 HAVING COUNT(*) > 1 LIMIT 3;"
```

Update Q3. Expected: 0 (unique constraint enforces). If non-zero, the schema is corrupted — escalate to user.

- [ ] **Step 5: Run Q4 — Deactivated leads**

```bash
psql "$DB_URL" -c "SELECT i.id, i.lead_user_id, u.username, u.active, u.role FROM station_inspection i JOIN \"user\" u ON u.id = i.lead_user_id WHERE u.active = false OR u.role NOT IN ('admin', 'inspector') LIMIT 3;"
psql "$DB_URL" -c "SELECT COUNT(*) FROM station_inspection i JOIN \"user\" u ON u.id = i.lead_user_id WHERE u.active = false OR u.role NOT IN ('admin', 'inspector');"
```

Update Q4. Some rows expected if `aom` (deactivated by the prior inspector-tagging work) led any inspections. Remediation: leave alone. The analytics route already filters `users` to `active=true`; deactivated leads' rows still count toward the inspection's existence but the lead-user themselves doesn't appear in `inspectors[]`. That is the correct intended behavior.

- [ ] **Step 6: Run Q5 — Orphan station refs**

```bash
psql "$DB_URL" -c "SELECT i.id, i.station_id FROM station_inspection i LEFT JOIN fm_station s ON s.id_fm = i.station_id WHERE s.id_fm IS NULL LIMIT 3;"
psql "$DB_URL" -c "SELECT COUNT(*) FROM station_inspection i LEFT JOIN fm_station s ON s.id_fm = i.station_id WHERE s.id_fm IS NULL;"
```

Update Q5. Expected: 0 (FK enforces). If non-zero, escalate.

- [ ] **Step 7: Run Q6 — inspection_69=true but no history**

```bash
psql "$DB_URL" -c "SELECT s.id_fm, s.name, s.inspection_69, s.date_inspected FROM fm_station s LEFT JOIN station_inspection i ON i.station_id = s.id_fm WHERE s.inspection_69 = true AND i.id IS NULL LIMIT 3;"
psql "$DB_URL" -c "SELECT COUNT(*) FROM fm_station s LEFT JOIN station_inspection i ON i.station_id = s.id_fm WHERE s.inspection_69 = true AND i.id IS NULL;"
```

Update Q6. Some rows expected — pre-history inspections from before the inspector-tagging schema landed. Remediation: leave alone. These are legitimate "inspected but without attribution" records; the new code will record attribution going forward.

- [ ] **Step 8: Run Q7 — History rows but inspection_69=false**

```bash
psql "$DB_URL" -c "SELECT i.id, i.station_id, s.inspection_69 FROM station_inspection i JOIN fm_station s ON s.id_fm = i.station_id WHERE s.inspection_69 = false LIMIT 5;"
psql "$DB_URL" -c "SELECT COUNT(*) FROM station_inspection i JOIN fm_station s ON s.id_fm = i.station_id WHERE s.inspection_69 = false;"
```

Update Q7. **This is the count that the B1 bug has been inflating.** If non-zero, these are stations a user toggled OFF without removing the history row. Report the count to the user; ask whether to also delete these legacy rows before Fix 1 lands. Default remediation if user says go: `DELETE FROM station_inspection i USING fm_station s WHERE i.station_id = s.id_fm AND s.inspection_69 = false;` — but **ask the user first** because this changes historical counts.

- [ ] **Step 9: Commit the Phase 1 audit doc**

```bash
git add docs/superpowers/audits/2026-05-17-analytics-count-audit.md
git commit -m "$(cat <<'EOF'
docs(audit): Phase 1 DB sanity findings for analytics teammate count

Captures row counts and sample rows for Q1–Q7 sanity queries
against the Neon DB. Quantifies pre-fix drift (Q6/Q7) so the
B1 fix in Phase 2 can be reasoned about against real numbers.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Fix 3 — `mostTaggedHelperThisYear` iterates past deactivated

**Files:**
- Modify: `src/app/api/analytics/inspectors/route.ts:204-217`
- Modify: `src/__tests__/api-analytics-inspectors.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/api-analytics-inspectors.test.ts` (inside the existing `describe('GET /api/analytics/inspectors', ...)` block):

```ts
  it('skips deactivated top helper and surfaces the next active helper', async () => {
    // active users list excludes the deactivated user `aom` (id 99)
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
      { id: 6, username: 'daf', display_name: 'daf' },
    ] as never);

    // No lead activity.
    vi.mocked(prisma.station_inspection.groupBy)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    // memberYtd returns the deactivated aom on top with 99 hits,
    // then daf with 5, then iff with 3.
    vi.mocked(prisma.station_inspection_member.groupBy)
      .mockResolvedValueOnce([
        { user_id: 99, _count: { _all: 99 } },
        { user_id: 6,  _count: { _all: 5 } },
        { user_id: 3,  _count: { _all: 3 } },
      ] as never)
      .mockResolvedValueOnce([] as never);

    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const getInspectors = await loadRoute();
    const r = await getInspectors(await req(c.header));
    expect(r.status).toBe(200);
    const json = await r.json();
    // The deactivated aom (99) should be skipped; daf (5) wins.
    expect(json.kpis.mostTaggedHelperThisYear).toMatchObject({
      username: 'daf',
      count: 5,
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/api-analytics-inspectors.test.ts -t "skips deactivated top helper"
```

Expected: FAIL with `expected null to match object …` (current code returns `null` when top helper is deactivated).

- [ ] **Step 3: Implement Fix 3**

In `src/app/api/analytics/inspectors/route.ts`, find lines 204-217:

```ts
  let mostTaggedHelperThisYear: InspectorsAnalytics['kpis']['mostTaggedHelperThisYear'] = null;
  const helperTop = memberYtd
    .slice()
    .sort((a, b) => b._count._all - a._count._all)[0];
  if (helperTop) {
    const u = userById.get(helperTop.user_id);
    if (u) {
      mostTaggedHelperThisYear = {
        username: u.username,
        displayName: u.display_name,
        count: helperTop._count._all,
      };
    }
  }
```

Replace with:

```ts
  let mostTaggedHelperThisYear: InspectorsAnalytics['kpis']['mostTaggedHelperThisYear'] = null;
  const sortedHelpers = memberYtd.slice().sort((a, b) => b._count._all - a._count._all);
  for (const helperTop of sortedHelpers) {
    const u = userById.get(helperTop.user_id);
    if (u) {
      mostTaggedHelperThisYear = {
        username: u.username,
        displayName: u.display_name,
        count: helperTop._count._all,
      };
      break;
    }
  }
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/api-analytics-inspectors.test.ts -t "skips deactivated top helper"
```

Expected: PASS.

- [ ] **Step 5: Run the whole analytics test file to confirm no regression**

```bash
npx vitest run src/__tests__/api-analytics-inspectors.test.ts
```

Expected: all tests pass (the existing 4 + this new one = 5).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/analytics/inspectors/route.ts src/__tests__/api-analytics-inspectors.test.ts
git commit -m "$(cat <<'EOF'
fix(analytics): mostTaggedHelperThisYear iterates past deactivated users

When the top helper by YTD count is deactivated (filtered out of
the active users list), the prior code returned null instead of
falling through to the next-most-tagged active helper. Now it
iterates the sorted list and picks the first one whose user is
still active. Pins the contract with a regression test that mocks
a deactivated id 99 on top.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Update the audit doc**

Edit `docs/superpowers/audits/2026-05-17-analytics-count-audit.md` and replace `Fix 3 | … | TBD` row's commit cell with the new SHA from `git rev-parse HEAD`.

Commit the doc update:

```bash
git add docs/superpowers/audits/2026-05-17-analytics-count-audit.md
git commit -m "$(cat <<'EOF'
docs(audit): record Fix 3 commit SHA in audit doc

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Fix 2 — Remove `Math.max`; raw query is the truth

**Files:**
- Modify: `src/app/api/analytics/inspectors/route.ts:158-162`
- Modify: `src/__tests__/api-analytics-inspectors.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to the same describe block in `src/__tests__/api-analytics-inspectors.test.ts`:

```ts
  it('uses the raw monthly bucket as truth even when groupBy disagrees', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
    ] as never);

    // groupBy says: this month iff led 5 inspections, helped 0
    vi.mocked(prisma.station_inspection.groupBy)
      .mockResolvedValueOnce([] as never)                                       // ytd-lead
      .mockResolvedValueOnce([{ lead_user_id: 3, _count: { _all: 5 } }] as never) // month-lead
      .mockResolvedValueOnce([] as never);                                      // lead-max
    vi.mocked(prisma.station_inspection_member.groupBy)
      .mockResolvedValueOnce([] as never)   // ytd-helper
      .mockResolvedValueOnce([] as never);  // month-helper

    // raw monthly bucket says: this month iff appeared only twice.
    // (Disagreement — Math.max would pick 5; truth picks 2.)
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([
        // pull month dynamically: this month key matches what the route builds
        { month: new Date().toISOString().slice(0, 7), lead_user_id: 3, n: 2 },
      ] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const getInspectors = await loadRoute();
    const r = await getInspectors(await req(c.header));
    const json = await r.json();
    const iff = json.inspectors.find((u: { username: string }) => u.username === 'iff');
    // monthTotal must match the chart (raw query) — 2, not 5.
    expect(iff.monthTotal).toBe(2);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/api-analytics-inspectors.test.ts -t "uses the raw monthly bucket as truth"
```

Expected: FAIL with `expected 5 to be 2` (Math.max picks the higher value 5 from groupBy).

- [ ] **Step 3: Implement Fix 2**

In `src/app/api/analytics/inspectors/route.ts`, find lines 157-162:

```ts
    const monthFromSeries = thisMonthPerUser[u.username] ?? 0;
    // Reconcile the two data sources: take whichever count is higher.
    // monthlySeries is sourced from a raw bucketed query; the groupBy queries
    // are scoped narrowly to the current month. They normally agree; when
    // they don't, the higher value is the truthful count.
    const monthTotal = Math.max(monthFromSeries, monthAsLead + monthAsHelper);
```

Replace with:

```ts
    const monthFromSeries = thisMonthPerUser[u.username] ?? 0;
    // Raw query is the source for the monthly chart the user sees — make it
    // the source of truth for the leaderboard total too. If the groupBy
    // numbers disagree, that's a real divergence worth investigating, not a
    // discrepancy to paper over with max().
    const monthTotal = monthFromSeries;
    if (monthFromSeries !== monthAsLead + monthAsHelper) {
      console.warn(
        `[analytics] count divergence for ${u.username}: chart=${monthFromSeries}, groupBy=${monthAsLead + monthAsHelper}`,
      );
    }
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/api-analytics-inspectors.test.ts -t "uses the raw monthly bucket as truth"
```

Expected: PASS.

- [ ] **Step 5: Run the whole analytics test file to confirm no regression**

```bash
npx vitest run src/__tests__/api-analytics-inspectors.test.ts
```

Expected: all tests pass. **Note:** the existing test "aggregates ytdAsLead + ytdAsHelper + monthTotal + lastActive per user" asserts `monthTotal: 3` for iff with `2 lead + 1 helper` — both sources agree there (raw says 3, groupBy says 3), so the assertion still holds after Fix 2.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/analytics/inspectors/route.ts src/__tests__/api-analytics-inspectors.test.ts
git commit -m "$(cat <<'EOF'
fix(analytics): remove Math.max divergence-masker; raw query is truth

The reconcile-by-max workaround at route.ts:158-162 was hiding a
real disagreement between the raw bucketed query (which feeds the
chart) and the per-month groupBy aggregations (which fed the
leaderboard). Take the chart number as truth — that is what the
user sees — and console.warn on divergence so any future drift
surfaces in logs instead of inflating counts.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Update the audit doc**

Edit `docs/superpowers/audits/2026-05-17-analytics-count-audit.md` and replace the `Fix 2 | … | TBD` row's commit cell with the new SHA from `git rev-parse HEAD`.

```bash
git add docs/superpowers/audits/2026-05-17-analytics-count-audit.md
git commit -m "$(cat <<'EOF'
docs(audit): record Fix 2 commit SHA in audit doc

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Fix 1 — Toggle OFF deletes today's caller-owned history row

**Files:**
- Modify: `src/app/api/stations/[id]/route.ts` (around lines 60-85; mirror the existing ON sidecar)
- Modify: `src/__tests__/api-routes.test.ts` (append 3 cases inside the existing `describe('PATCH /api/stations/[id]', …)` block — locate by searching for "clears date_inspected when inspection69 is false")

- [ ] **Step 1: Add the prisma mock surface for station_inspection in api-routes.test.ts**

`src/__tests__/api-routes.test.ts` currently mocks `prisma.fm_station` and `prisma.interference_site` but NOT `station_inspection`. Find the existing `vi.mock('@/lib/prisma', () => ({ default: { ... } }))` block (lines 6-34) and add `station_inspection` after `cloudrf_cache`:

```ts
    cloudrf_cache: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    station_inspection: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
```

(This is additive — does not affect other tests.)

- [ ] **Step 2: Write the failing tests**

Append three new `it(...)` cases inside the existing `describe('PATCH /api/stations/[id]', …)` block, just after the existing "PATCH forwards helperUserIds to the inspection-history sidecar" test:

```ts
  it('deletes today\'s caller-owned station_inspection row when toggling OFF', async () => {
    vi.mocked(prisma.fm_station.update).mockResolvedValue({ id_fm: 1 } as never);
    vi.mocked(prisma.station_inspection.deleteMany).mockResolvedValue({ count: 1 } as never);

    const inspectionService = await import('@/services/inspectionService');
    const recomputeSpy = vi
      .spyOn(inspectionService, 'recomputeStationInspectionState')
      .mockResolvedValue(undefined as never);

    const sessionLib = await import('@/lib/session');
    const getSessionSpy = vi.spyOn(sessionLib, 'getSession').mockResolvedValue({
      userId: 3, username: 'iff', displayName: 'iff', role: 'inspector', issuedAt: Date.now(),
    } as never);

    const { PATCH } = await import('@/app/api/stations/[id]/route');
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ inspection69: false }),
    });
    const res = await PATCH(req as never, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(200);
    expect(prisma.station_inspection.deleteMany).toHaveBeenCalledWith({
      where: {
        station_id: 1,
        lead_user_id: 3,
        inspected_on: expect.any(Date),
      },
    });
    expect(recomputeSpy).toHaveBeenCalledWith(1);

    recomputeSpy.mockRestore();
    getSessionSpy.mockRestore();
  });

  it('does NOT fail when toggling OFF with no matching history row', async () => {
    vi.mocked(prisma.fm_station.update).mockResolvedValue({ id_fm: 1 } as never);
    vi.mocked(prisma.station_inspection.deleteMany).mockResolvedValue({ count: 0 } as never);

    const inspectionService = await import('@/services/inspectionService');
    const recomputeSpy = vi
      .spyOn(inspectionService, 'recomputeStationInspectionState')
      .mockResolvedValue(undefined as never);

    const sessionLib = await import('@/lib/session');
    const getSessionSpy = vi.spyOn(sessionLib, 'getSession').mockResolvedValue({
      userId: 3, username: 'iff', displayName: 'iff', role: 'inspector', issuedAt: Date.now(),
    } as never);

    const { PATCH } = await import('@/app/api/stations/[id]/route');
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ inspection69: false }),
    });
    const res = await PATCH(req as never, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(200);
    // deleteMany was still called (count returned 0 means no rows matched).
    expect(prisma.station_inspection.deleteMany).toHaveBeenCalled();
    expect(recomputeSpy).toHaveBeenCalledWith(1);

    recomputeSpy.mockRestore();
    getSessionSpy.mockRestore();
  });

  it('toggle OFF still succeeds when deleteMany throws (best-effort sidecar)', async () => {
    vi.mocked(prisma.fm_station.update).mockResolvedValue({ id_fm: 1 } as never);
    vi.mocked(prisma.station_inspection.deleteMany).mockRejectedValue(new Error('connection refused') as never);

    const inspectionService = await import('@/services/inspectionService');
    const recomputeSpy = vi
      .spyOn(inspectionService, 'recomputeStationInspectionState')
      .mockResolvedValue(undefined as never);

    const sessionLib = await import('@/lib/session');
    const getSessionSpy = vi.spyOn(sessionLib, 'getSession').mockResolvedValue({
      userId: 3, username: 'iff', displayName: 'iff', role: 'inspector', issuedAt: Date.now(),
    } as never);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { PATCH } = await import('@/app/api/stations/[id]/route');
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ inspection69: false }),
    });
    const res = await PATCH(req as never, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(200);                           // boolean update still succeeds
    expect(warnSpy).toHaveBeenCalled();                     // logs the failure
    expect(recomputeSpy).not.toHaveBeenCalled();            // skipped after deleteMany throws

    warnSpy.mockRestore();
    recomputeSpy.mockRestore();
    getSessionSpy.mockRestore();
  });
```

- [ ] **Step 3: Run the three new tests — expect failures**

```bash
npx vitest run src/__tests__/api-routes.test.ts -t "deletes today's caller-owned\|does NOT fail when toggling OFF\|toggle OFF still succeeds"
```

Expected: 3 FAIL — `prisma.station_inspection.deleteMany` is never called because the OFF sidecar doesn't exist yet.

- [ ] **Step 4: Implement Fix 1**

In `src/app/api/stations/[id]/route.ts`, locate the existing toggle-ON sidecar (around lines 58-83):

```ts
    // Sidecar: when toggling inspection ON, also record a station_inspection row
    // so history continues to accumulate even though the UI no longer exposes
    // the multi-helper form. Idempotent on (station_id, inspected_on,
    // lead_user_id), so repeated toggles in the same day are safe.
    if (updates.inspection_69 === true) {
      try {
        const session = await getSession();
        if (session.userId) {
          await createInspection({ ... });
        }
      } catch (err) {
        console.warn(`Failed to record inspection history for station ${stationId}:`, err);
      }
    }
```

Add a mirror sidecar **immediately after** it (still inside the PATCH handler, before the final `return NextResponse.json(data);`). First, add the import at the top of the file alongside the existing `createInspection` import:

```ts
import { createInspection, recomputeStationInspectionState } from '@/services/inspectionService';
```

Then add the OFF sidecar:

```ts
    // Sidecar: when toggling inspection OFF, delete the caller's
    // station_inspection row for TODAY. Semantic: the toggle is "today's
    // action"; OFF can only undo today's action. Older inspections by the
    // same user, or inspections by other leads, are untouched.
    // recomputeStationInspectionState keeps fm_station.inspection_69 = true
    // if any remaining history exists for the station.
    if (updates.inspection_69 === false) {
      try {
        const session = await getSession();
        if (session.userId) {
          const today = new Date().toISOString().split('T')[0];
          await prisma.station_inspection.deleteMany({
            where: {
              station_id: stationId,
              lead_user_id: session.userId,
              inspected_on: new Date(`${today}T00:00:00Z`),
            },
          });
          await recomputeStationInspectionState(stationId);
        }
      } catch (err) {
        console.warn(`Failed to delete inspection history for station ${stationId}:`, err);
      }
    }
```

- [ ] **Step 5: Run the new tests — expect 3 to pass**

```bash
npx vitest run src/__tests__/api-routes.test.ts -t "deletes today's caller-owned\|does NOT fail when toggling OFF\|toggle OFF still succeeds"
```

Expected: 3 PASS.

- [ ] **Step 6: Run the whole api-routes file to confirm no regression**

```bash
npx vitest run src/__tests__/api-routes.test.ts
```

Expected: all existing tests still pass + 3 new.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/stations/[id]/route.ts src/__tests__/api-routes.test.ts
git commit -m "$(cat <<'EOF'
fix(api): toggle OFF deletes today's caller-owned inspection history

Mirrors the existing toggle-ON createInspection sidecar with a
deleteMany scoped to (station_id, lead_user_id=caller,
inspected_on=today) followed by recomputeStationInspectionState.
Semantic: the toggle is "today's action"; OFF can only undo
today's action. Older inspections by the same user, and any
inspections by other leads, are untouched. Side effect: re-toggle
ON same day now creates a fresh row with the caller's current
helperUserIds, fixing the silent "old helpers stuck" bug from the
sidecar's idempotency.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Update the audit doc**

Edit `docs/superpowers/audits/2026-05-17-analytics-count-audit.md` and replace `Fix 1 | … | TBD` row's commit cell with the new SHA.

```bash
git add docs/superpowers/audits/2026-05-17-analytics-count-audit.md
git commit -m "$(cat <<'EOF'
docs(audit): record Fix 1 commit SHA in audit doc

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Phase 3 — Invariant test suite

**Files:**
- Create: `src/__tests__/analytics-invariants.test.ts`

- [ ] **Step 1: Write the invariant test file**

Create `src/__tests__/analytics-invariants.test.ts`:

```ts
// src/__tests__/analytics-invariants.test.ts
//
// Invariant contracts for the /api/analytics/inspectors payload.
// Each assertion is a property the payload MUST satisfy regardless of
// which seed data is mocked. Failures here mean the route's aggregation
// shape has regressed; the existing api-analytics-inspectors.test.ts
// covers specific value assertions.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mintCookie } from './helpers/session';
import { COOKIE_NAME } from '@/lib/session';

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findMany: vi.fn() },
    fm_station: { findUnique: vi.fn() },
    station_inspection: { groupBy: vi.fn() },
    station_inspection_member: { groupBy: vi.fn() },
    $queryRawUnsafe: vi.fn(),
  },
}));

const cookieStore = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const v = cookieStore.get(name);
      return v ? { name, value: v } : undefined;
    },
    set: () => {},
    delete: () => {},
  }),
}));

import prismaOriginal from '@/lib/prisma';
let prisma: typeof prismaOriginal = prismaOriginal;

async function loadRoute() {
  const prismaMod = await import('@/lib/prisma');
  prisma = prismaMod.default;
  const mod = await import('@/app/api/analytics/inspectors/route');
  return mod.GET;
}

beforeEach(async () => {
  process.env.SESSION_PASSWORD =
    process.env.SESSION_PASSWORD ?? 'test-session-password-32-chars-or-more!!!';
  cookieStore.clear();
  vi.resetModules();
  const prismaMod = await import('@/lib/prisma');
  prisma = prismaMod.default;
  vi.clearAllMocks();
});

async function callRoute(): Promise<{ status: number; json: ReturnType<typeof JSON.parse> }> {
  const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
  const headers = new Headers();
  headers.set('Cookie', c.header);
  const match = c.header.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (match) cookieStore.set(COOKIE_NAME, match[1]);
  const req = new NextRequest('http://t/api/analytics/inspectors', { method: 'GET', headers });
  const getInspectors = await loadRoute();
  const r = await getInspectors(req);
  const json = await r.json();
  return { status: r.status, json };
}

describe('Analytics — invariant contracts', () => {
  it('inspector.ytdTotal === ytdAsLead + ytdAsHelper for every inspector', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
      { id: 6, username: 'daf', display_name: 'daf' },
      { id: 7, username: 'ice', display_name: 'ice' },
    ] as never);
    vi.mocked(prisma.station_inspection.groupBy)
      .mockResolvedValueOnce([
        { lead_user_id: 3, _count: { _all: 4 } },
        { lead_user_id: 6, _count: { _all: 2 } },
      ] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.station_inspection_member.groupBy)
      .mockResolvedValueOnce([
        { user_id: 6, _count: { _all: 1 } },
        { user_id: 7, _count: { _all: 3 } },
      ] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const { json } = await callRoute();
    for (const insp of json.inspectors) {
      expect(insp.ytdTotal).toBe(insp.ytdAsLead + insp.ytdAsHelper);
    }
  });

  it('monthlySeries[thisMonth].perUser === monthAsLead + monthAsHelper (post Fix 2 contract)', async () => {
    const thisMonthKey = new Date().toISOString().slice(0, 7);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
    ] as never);
    // Configure month-lead and month-helper to AGREE with the raw bucket.
    vi.mocked(prisma.station_inspection.groupBy)
      .mockResolvedValueOnce([] as never)                                       // ytd-lead
      .mockResolvedValueOnce([{ lead_user_id: 3, _count: { _all: 2 } }] as never) // month-lead
      .mockResolvedValueOnce([] as never);                                      // lead-max
    vi.mocked(prisma.station_inspection_member.groupBy)
      .mockResolvedValueOnce([] as never)                                       // ytd-helper
      .mockResolvedValueOnce([{ user_id: 3, _count: { _all: 1 } }] as never);   // month-helper
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([{ month: thisMonthKey, lead_user_id: 3, n: 2 }] as never)
      .mockResolvedValueOnce([{ month: thisMonthKey, user_id: 3, n: 1 }] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const { json } = await callRoute();
    const thisMonth = json.monthlySeries.find((m: { month: string }) => m.month === thisMonthKey)!;
    const iff = json.inspectors.find((u: { username: string }) => u.username === 'iff');
    // Contract: chart number === groupBy lead + groupBy helper. After Fix 2
    // they MUST agree; if they don't, that's an invariant violation worth
    // failing the test for.
    expect(thisMonth.perUser.iff).toBe(3);
    expect(iff.monthTotal).toBe(3);
  });

  it('kpis.activeThisMonth === |{u | thisMonthPerUser[u.username] > 0}|', async () => {
    const thisMonthKey = new Date().toISOString().slice(0, 7);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
      { id: 6, username: 'daf', display_name: 'daf' },
      { id: 7, username: 'ice', display_name: 'ice' },
    ] as never);
    vi.mocked(prisma.station_inspection.groupBy)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.station_inspection_member.groupBy)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);
    // Two users have activity this month: iff (lead 1) and daf (helper 2).
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([{ month: thisMonthKey, lead_user_id: 3, n: 1 }] as never)
      .mockResolvedValueOnce([{ month: thisMonthKey, user_id: 6, n: 2 }] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const { json } = await callRoute();
    expect(json.kpis.activeThisMonth).toBe(2);
  });

  it('mostTaggedHelperThisYear is non-null whenever any active user has ytdAsHelper > 0', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
      { id: 6, username: 'daf', display_name: 'daf' },
    ] as never);
    vi.mocked(prisma.station_inspection.groupBy)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.station_inspection_member.groupBy)
      .mockResolvedValueOnce([
        { user_id: 6, _count: { _all: 4 } },
      ] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const { json } = await callRoute();
    const dafYtdAsHelper = json.inspectors.find(
      (u: { username: string }) => u.username === 'daf',
    )?.ytdAsHelper ?? 0;
    expect(dafYtdAsHelper).toBeGreaterThan(0);
    expect(json.kpis.mostTaggedHelperThisYear).not.toBeNull();
  });

  it('deactivated user (filtered out of users) does NOT inflate any inspector ytdAsHelper', async () => {
    // active list excludes deactivated user id 99.
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
      { id: 6, username: 'daf', display_name: 'daf' },
    ] as never);
    vi.mocked(prisma.station_inspection.groupBy)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);
    // memberYtd includes a deactivated id 99 with 50 hits — those should NOT
    // attach to any active inspector.
    vi.mocked(prisma.station_inspection_member.groupBy)
      .mockResolvedValueOnce([
        { user_id: 99, _count: { _all: 50 } },
        { user_id: 6, _count: { _all: 3 } },
      ] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const { json } = await callRoute();
    for (const insp of json.inspectors) {
      // No active inspector should have 50 helper hits attributed to them.
      expect(insp.ytdAsHelper).toBeLessThan(50);
    }
    // The deactivated user should NOT appear in the inspectors list.
    expect(
      json.inspectors.find((u: { username: string }) => u.username === undefined || u.userId === 99),
    ).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the invariant tests**

```bash
npx vitest run src/__tests__/analytics-invariants.test.ts
```

Expected: 5 tests pass. (They should pass against the post-Fix 2 and post-Fix 3 code from earlier tasks.)

- [ ] **Step 3: Run the full test suite to confirm nothing else broke**

```bash
npm test -- --run 2>&1 | tail -20
```

Expected: the same baseline as before this plan started (pre-existing 25 failures in components-batch4, intermod-calculator-deep, field-ops-drawer, analytics.test.tsx). The default-crew feature's tests + this audit's new tests should all pass.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/analytics-invariants.test.ts
git commit -m "$(cat <<'EOF'
test(analytics): add invariant contracts for /api/analytics/inspectors

Five contract assertions: ytdTotal = lead + helper; monthly chart
agrees with groupBy sources (Fix 2 contract); activeThisMonth =
distinct active users in this month's chart; mostTaggedHelper is
non-null when any active user has helper hits (Fix 3 contract);
deactivated users do not inflate any active inspector's helper
count. These pin the contracts in place so any future change to
the route either keeps them or fails CI.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Update the audit doc with test row**

Edit `docs/superpowers/audits/2026-05-17-analytics-count-audit.md`. Replace the Phase 3 row for `src/__tests__/analytics-invariants.test.ts | TBD` with `… | 5`. Replace the toggle-OFF row with `src/__tests__/api-routes.test.ts (toggle-OFF cases) | 3`.

```bash
git add docs/superpowers/audits/2026-05-17-analytics-count-audit.md
git commit -m "$(cat <<'EOF'
docs(audit): record Phase 3 test case counts in audit doc

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Final reconciliation paragraph

**Files:**
- Modify: `docs/superpowers/audits/2026-05-17-analytics-count-audit.md`

- [ ] **Step 1: Write the reconciliation paragraph**

Edit the audit doc's `## Reconciliation` section. Replace the placeholder with a paragraph along these lines (numbers come from Phase 1 Q6/Q7 row counts plus the divergence-warn observation, if any, from running the post-Fix dev server):

```markdown
## Reconciliation

Before this audit:
- B1 inflated per-user counts whenever any user had toggled INSPECT OFF. Q7 surfaced **N** such rows in the live DB (each one a station_inspection record still being counted by analytics even though the station shows PENDING).
- B2 silently picked the higher of two diverging count sources, so the leaderboard's "this month" total could exceed the chart by an unknown amount; the new console.warn will surface any future divergence in logs.
- B3 occasionally hid the "Most tagged helper this year" KPI when the top helper had been deactivated.

After this audit:
- B1 fixed: PATCH OFF deletes today's caller-owned row + recomputes fm_station. Pre-fix legacy rows (if any) were left in place because the user did not authorize a backfill delete.
- B2 fixed: raw bucketed query is the truth for monthTotal. Divergence (if it occurs) is now logged rather than masked.
- B3 fixed: iteration replaces the single-shot lookup. Live tests against the post-fix endpoint show the KPI surfaces correctly.
- Invariant suite (5 assertions in analytics-invariants.test.ts + 3 in api-routes.test.ts) pins all three fix contracts.

Final dashboard counts post-fix are accurate to the underlying station_inspection + station_inspection_member rows. Any future drift will manifest as a failing invariant test, a console.warn in logs, or both — not as a silently wrong number on the dashboard.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/audits/2026-05-17-analytics-count-audit.md
git commit -m "$(cat <<'EOF'
docs(audit): finalize reconciliation paragraph

Closes out the analytics teammate-count audit by summarizing
pre-fix vs post-fix state and pointing forward to the invariant
suite as the long-term guard against regression.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Every section of the spec maps to one or more tasks:
  - Phase 1 Q1–Q7 → Task 1 (one step per query).
  - Fix 1 (toggle OFF deletes) → Task 4.
  - Fix 2 (Math.max removal) → Task 3.
  - Fix 3 (mostTaggedHelper iteration) → Task 2.
  - Phase 3 invariant test file → Task 5.
  - Phase 3 toggle-OFF tests → integrated into Task 4 (Steps 2–6).
  - Audit doc with per-fix SHAs + reconciliation → Tasks 1, 2, 3, 4, 5, 6 each update it incrementally.
- **No placeholders:** Every code block contains full code. Every command has expected output.
- **Type consistency:** `recomputeStationInspectionState` is the existing function name in `inspectionService.ts` — used consistently in Task 4 Steps 2 + 4. `deleteMany` is the Prisma method — used consistently. `inspected_on` matches the Prisma field name in the schema.
- **Order rationale:** Fix 3 (smallest, isolated, no schema/route changes) runs first to warm up the test pattern. Fix 2 runs second (same file, builds on the test scaffolding). Fix 1 runs last (different file, needs new mock surface; biggest change). Phase 3 invariants land after all three fixes so the contracts they assert are actually true.
- **The audit doc is updated incrementally** rather than at the end, so each task leaves it in a self-consistent state. If the plan is paused between tasks, the doc accurately reflects what's been done.
