# Default Crew Modal — Design

**Date:** 2026-05-17
**Status:** Approved
**Surface:** field-ops (desktop + mobile)
**Related:** [2026-05-13-inspector-tagging-design](2026-05-13-inspector-tagging-design.md), [2026-05-16-tag-teammates-on-toggle-design](2026-05-16-tag-teammates-on-toggle-design.md), [2026-05-16-inspector-performance-dashboard-design](2026-05-16-inspector-performance-dashboard-design.md)

## Goal

Let each inspector pick a **default crew** (the teammates they usually work with) once, and have those helpers pre-fill on every station INSPECT. The picker appears as a modal on first field-ops mount per user, never auto-opens again after a deliberate decision, and is always re-openable from a header indicator.

This is purely a UX improvement on top of the existing inspector-tagging data model — helpers still flow into `station_inspection_member` and surface in the existing analytics dashboard with **zero changes** to those paths.

## User-facing behavior

| State | Trigger | Modal | Pre-fill |
|---|---|---|---|
| Undecided | First mount of `/field-ops` (no prior decision) | Auto-opens | n/a |
| Solo | User tapped `I WORK SOLO`, `×`, or pressed ESC, OR saved with no chips selected | Never auto-opens | `[]` |
| Crew | User picked ≥1 chip and saved | Never auto-opens | Selected ids |

Once decided, the modal only opens by clicking the header **"My crew"** indicator. Re-saving overwrites the previous decision.

When a station is selected, the per-station `TeammatePicker` chips start filled with the current default crew. The user can add/remove helpers per station before tapping INSPECT — the existing PATCH payload (`helperUserIds`) carries whatever's in the picker at submit time.

## Data model

One nullable column on `user`:

```prisma
model user {
  // ...existing fields...
  default_helper_user_ids  Int[]?   // NULL=undecided, []=solo, [3,6]=crew
}
```

Semantic states encoded in a single column:
- `NULL` → undecided (modal auto-opens)
- `[]` → decided solo (modal silent)
- `[1,2,…]` → decided crew (modal silent + pre-fill)

**Migration:** `prisma/migrations/2026-05-17-add-default-helper-user-ids/migration.sql`, hand-written, applied via `npx prisma db push`. Force-add because `*.sql` is in `.gitignore` (consistent with prior migrations).

```sql
ALTER TABLE "user" ADD COLUMN "default_helper_user_ids" INTEGER[];
```

**Validation on write** (server-side, in `setDefaultCrew`):
- Each id exists in `user`.
- Each user is `active=true` and `role IN ('admin','inspector')`.
- No id equals the caller's `userId` (no self-tagging).
- Length ≤ 5 (matches existing helper cap in `createInspection`).
- De-duplicates silently.

## API surface

Two endpoints in `src/app/api/users/me/crew/route.ts`, both session-gated to `userId`:

### `GET /api/users/me/crew`

```ts
// 200
{ defaultHelperUserIds: number[] | null }   // null = undecided
// 401
{ error: 'not_authenticated' }
```

### `PUT /api/users/me/crew`

```ts
// body
{ defaultHelperUserIds: number[] }   // [] = solo, [3,6] = crew

// 200
{ defaultHelperUserIds: number[] }

// 400
{ error: 'invalid_helper' | 'self_in_list' | 'too_many' | 'invalid_body' }

// 401
{ error: 'not_authenticated' }
```

Route logic delegates to `getDefaultCrew(userId)` / `setDefaultCrew(userId, ids)` in `src/services/userPreferencesService.ts` — keeps the route thin and lets tests target the service directly (same shape as `inspectionService.ts`).

## Self-healing on stale references

When `getDefaultCrew(userId)` loads, it inner-joins against `user WHERE active=true AND role IN ('admin','inspector')`. If the persisted array contains ids that no longer satisfy those predicates (e.g., the `aom` deactivation case), the service:

1. Returns only the still-valid ids to the caller.
2. If the filtered set differs from what's in the DB, fires `UPDATE user SET default_helper_user_ids = <filtered>` in the background.

This keeps the modal honest without requiring an admin migration whenever someone is deactivated.

## UI components

### `CrewModal.tsx` (new, `src/components/field-ops/CrewModal.tsx`)

Props:

```ts
interface Props {
  open: boolean;
  inspectors: { id: number; username: string; displayName: string }[];
  currentUserId: number;
  initialSelected: number[];
  onSave: (ids: number[]) => Promise<void> | void;
  onSolo: () => Promise<void> | void;
  onClose: () => void;   // re-open path uses this for the × when already decided
}
```

Layout (Mockup B, chip grid):
- Fixed-position overlay, dark `rgba(0,0,0,0.55)` backdrop.
- Centered card, dark field-ops palette (`--fo-rail-bg`, `--fo-accent`).
- Header: `FIRST LOGIN` mono label + `Tag your default crew` serif title + subtitle "Pre-filled on every inspection — override per station."
- Body: chip grid of all active inspectors except self. Selected chips use `--fo-accent` background; unselected use `--fo-rail-border` outline.
- Footer: `SAVE CREW (n)` primary (live count, **disabled when n = 0** — the SOLO button is the only way to save an empty pick), `I WORK SOLO` secondary.
- `×` top-right ≡ `I WORK SOLO` (same dismiss intent).

Keyboard:
- ESC ≡ `I WORK SOLO`.
- Focus trap inside the card while open.
- Initial focus on the first chip (or on `SAVE CREW` if pre-populated).

Backdrop click does NOT dismiss. The decision must be explicit.

### `CrewIndicator.tsx` (new, `src/components/field-ops/CrewIndicator.tsx`)

Small button rendered in `FieldOpsHeader`, between the connection status cluster and the theme toggle:

- `defaultHelperUserIds === null` → not rendered (modal handles the first prompt).
- `defaultHelperUserIds === []` → `🧑 My crew · solo` (mono small caps, muted).
- `defaultHelperUserIds.length ≥ 1` → `🧑 My crew · iff · dao` (up to 2 names, then `+N`).

Click → opens `CrewModal` with current value as `initialSelected`. On mobile (`isMobile === true`), the indicator collapses to the icon + count badge (e.g., `🧑 2`) and lives in the existing drawer button row, not inline in the header.

### Bootstrap in `FieldOpsClient`

Add a single effect on mount:

```ts
const [defaultCrew, setDefaultCrew] = useState<number[] | null>(null);
const [crewModalOpen, setCrewModalOpen] = useState(false);

useEffect(() => {
  fetch('/api/users/me/crew')
    .then((r) => (r.ok ? r.json() : { defaultHelperUserIds: null }))
    .then((j) => {
      setDefaultCrew(j.defaultHelperUserIds);
      if (j.defaultHelperUserIds === null) setCrewModalOpen(true);
    })
    .catch(() => {
      setDefaultCrew(null);
      setCrewModalOpen(true);   // fail-open: ask once
    });
}, []);
```

Change the existing station-select reset:

```diff
- useEffect(() => { setHelperUserIds([]); }, [fmStationId]);
+ useEffect(() => { setHelperUserIds(defaultCrew ?? []); }, [fmStationId, defaultCrew]);
```

After successful PUT in modal:

```ts
async function persistCrew(ids: number[]) {
  const res = await fetch('/api/users/me/crew', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ defaultHelperUserIds: ids }),
  });
  if (!res.ok) throw new Error('crew_save_failed');
  setDefaultCrew(ids);
  setCrewModalOpen(false);
}
```

`onSave` calls `persistCrew(selectedIds)`. `onSolo` calls `persistCrew([])`.

The existing per-station `TeammatePicker` is unchanged — pre-filled value flows in via the existing `helperUserIds` prop.

## Header layout adjustment

`FieldOpsHeader` currently has two clusters: user display name (left) and connection/location/theme controls (right). Add `<CrewIndicator />` to the right cluster, immediately before the theme toggle.

Mobile: indicator moves into the `FieldOpsDrawer` rows so the header bar stays narrow.

## Error handling

| Scenario | Behavior |
|---|---|
| `GET /me/crew` network failure on mount | Log to console, treat as `null`, open modal. Better to ask once than silently skip. |
| `PUT /me/crew` failure (network or 5xx) | Keep modal open, render inline error line above buttons: "Couldn't save — try again." No optimistic update. |
| `PUT /me/crew` 400 (validation) | Same inline line with server's error code mapped to a friendly message ("That teammate is no longer active."). |
| Server returns 401 (session expired) | Modal redirects to `/login` (same pattern as other 401s in field-ops). |
| Persisted array references a deactivated user | Service layer filters + background-PUTs the cleaned set. UI shows only valid chips. |

## Testing

| File | Scope |
|---|---|
| `src/__tests__/api-users-me-crew.test.ts` | GET returns null vs array. PUT validates: auth, schema, unknown id, inactive user, self-in-list, length>5. 200 round-trip. |
| `src/__tests__/services-user-preferences.test.ts` | `getDefaultCrew` / `setDefaultCrew` unit tests against mocked prisma. Self-healing on stale ids. |
| `src/__tests__/crew-modal.test.tsx` | Renders chip per active inspector except self. Toggles selection. `SAVE`/`SOLO`/`×` call the right handler. ESC ≡ SOLO. Backdrop click does NOT close. |
| `src/__tests__/field-ops-crew-bootstrap.test.tsx` | Mount with `defaultHelperUserIds: null` → modal opens. With `[]` → indicator shows "solo", picker pre-fill is `[]`. With `[3,6]` → station-select pre-fills picker with `[3,6]`. |
| `src/__tests__/field-ops-current.test.tsx` (existing) | Regression: per-station picker still renders; pre-fill flowing through `helperUserIds` doesn't break existing assertions. |

## Analytics sync

This feature does **not** introduce a parallel attribution path. The default crew is only smarter pre-fill on `helperUserIds`, which the existing `PATCH /api/stations/[id]` route already forwards to `createInspection` → `station_inspection_member`. The existing `/api/analytics/inspectors` dashboard reads from that same join table, so:

- New helpers attributed via default crew show up immediately in the dashboard's lead/helper donuts.
- 12-month chart picks them up via the existing `to_char(date_trunc('month', inspected_on), 'YYYY-MM')` bucketing.
- "Most tagged helper this year" KPI accurately counts pre-filled helpers.

No new analytics queries, no schema changes to `station_inspection_member`.

## Out of scope (YAGNI)

- **Per-day crew** ("who am I with today?"). Crew is "who I usually work with" — daily variation is handled by per-station picker tweaks.
- **Crew history / audit log** of changes to `default_helper_user_ids`.
- **Admin UI to inspect / reset other users' crews.** SQL is sufficient; the column is opaque to non-owners.
- **Backfill for existing users.** Column starts `NULL` for everyone; existing inspectors will see the modal on their next field-ops visit.
- **Re-prompt cadence.** Once decided, decided forever (until they re-open via the indicator).

## Open questions

None. All UX, persistence, and integration decisions captured above.
