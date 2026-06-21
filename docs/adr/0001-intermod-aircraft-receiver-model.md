# 1. Intermod risk modeled as aircraft-receiver mixing

Date: 2026-06-21

## Status

Accepted

## Context

The intermod calculator finds FM station pairs whose third-order products
(`2·f1 − f2`, `2·f2 − f1`) fall in the aviation band (108–137 MHz) and ranks
them by risk. The original implementation had three problems that made its
risk ranking physically wrong and, in the line-of-sight (LOS) case, dead:

1. **LOS was never evaluated.** The UI had no aircraft-altitude input, so
   `aircraftData.altitude` was always `undefined`, the LOS guard never ran, and
   every result was implicitly "in line of sight." The tower height fed to the
   horizon formula was also hardcoded to 100 m.
2. **The mixing site was modeled as the geographic midpoint** between the two
   towers — a single LOS/distance check from a point that may sit over terrain
   neither real tower is blocked by.
3. **Risk was scored on tower-to-tower distance** (closer pair = higher risk),
   which is not the driver of intermod that forms in an aircraft receiver.

We needed to improve accuracy for real NBTC field use: a fixed 60 m FM tower
height, aircraft altitudes supplied in feet, and a ranking that reflects the
actual physics.

## Decision

Model the intermod product as forming **in the aircraft receiver**. Both FM
signals travel to the aircraft and mix in its front-end. Consequences:

- **Per-station line-of-sight.** Each tower is independently checked against the
  aircraft using the 4/3-Earth radio horizon `d = 4.12·(√h_tower + √h_aircraft)`
  (metres). The product is reachable only if **both** towers are within horizon.
- **Tower height** is a single named constant `DEFAULT_TOWER_HEIGHT_M = 60`,
  applied to both stations, structured so a future per-station height column can
  replace it cleanly. (No height data exists in the DB today.)
- **Aircraft altitude** is entered in **feet** and converted to metres.
- **Out-of-LOS is demoted, not deleted.** If either tower is beyond horizon the
  pair is penalized and badged "NO LINE OF SIGHT" but stays in the results — the
  horizon model ignores terrain/ducting/Fresnel, so silently dropping pairs
  could hide a real threat from an inspector.
- **Signal-strength scoring when an aircraft position is known.** Score by each
  tower's received power at the aircraft (free-space path loss via the now-used
  `calculatePathLoss`), with the correct third-order **2:1 weighting**: in
  `2·f1 − f2` the f1 station contributes twice. Missing/zero transmit power is
  assumed to be **500 W**. With no aircraft position, fall back to the original
  tower-to-tower proximity heuristic.
- **Affected service stays the primary risk driver.** Emergency / VOR-ILS / ATC
  criticality sets the floor; LOS and signal strength modulate *within* a tier.
  An Emergency-frequency (121.5) hit is never buried to LOW by the propagation
  model alone.

## Consequences

- The ranking changes meaningfully when an aircraft position + altitude are
  supplied; existing score-based test expectations were updated.
- `calculatePathLoss` is now exercised; `calculateLineOfSight` keeps its
  signature but is finally called with the real 60 m height.
- The model is still an idealization: no terrain, no antenna gain (isotropic
  EIRP assumed), no Fresnel margin. The demote-not-delete rule is the deliberate
  hedge against that idealization.
- A per-station tower-height column in the DB would be the natural next accuracy
  step and is now a one-place change.
