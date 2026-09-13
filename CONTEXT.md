# Context: FM Station Tracker

A glossary of the domain language used in this project. Implementation details belong in code and the wiki, not here.

## Glossary

### Coverage area
The set of provinces this NBTC office is responsible for tracking. Currently **นครราชสีมา**
(Nakhon Ratchasima) and **ชัยภูมิ** (Chaiyaphum). A station or interference site outside the
coverage area is not tracked at all — it is absent, not hidden: there is no notion of an
out-of-area record in this system. **บุรีรัมย์** (Buriram) was in the coverage area until
2026-09-12 and is no longer.

### NBTC OPER register
The authoritative national record of licensed stations, held by NBTC and consulted through
an officer's own portal account. This project's station list is a **working copy** of the
register for the coverage area; the two drift apart as licences are issued, reassigned and
revoked, and a **harvest** is the act of reading the register to measure that drift.

### Harvest
Reading register data through the portal as the officer who holds the account, at human
pace. The register exposes no API and grants no bulk export of station data, so a harvest
is always a reading of pages a person is entitled to open.

### Inspection record
One inspection event recorded against a station **in the register**. A station may have
many, or none at all. Distinct from **inspection status**, which is this project's own
per-year flag. The consequence matters: anything derived from inspection records silently
omits stations that have never been inspected.

### Station identity
A station carries two codes that look interchangeable and are not. The **register station
code** (`RFXL…` style) is shown in search results and belongs to its own code system. The
**NBTC station ID** is the same number as this project's `id_fm`. Only the station ID
identifies a station across both systems; matching on anything else is inference.

### Inspector attribution
Who performed an inspection: one **lead** inspector plus zero or more **helpers** who went
with them, recorded per inspection with the date. Distinct from **inspection status**, which
is merely whether a station has been inspected in a given year and carries no person and no
date. Deleting attribution would not change any station's inspection status.

### Intermod product
A spurious frequency created when two FM broadcast signals mix in a nonlinear element. This project tracks **third-order** products only (`2·f1 − f2` and `2·f2 − f1`). A product matters when it lands in the **aviation band** (108–137 MHz).

### Aviation band
108–137 MHz. Subdivided into VOR/ILS (108.0–117.95), ATC Voice (118.0–137.0), and the Emergency frequency (121.5).

### Mixing site
The location where two FM signals combine to produce an intermod product. This project's model places the mixing site **in the aircraft receiver** — both FM signals travel to the aircraft and mix in its front-end. Consequence: an intermod product only "exists" at the aircraft when **both** source stations have radio line-of-sight to it.

### Line-of-sight (LOS)
Whether a radio path is unobstructed by the Earth's curvature, judged by the radio horizon. Measured **per station**: each of the two source FM towers is independently checked against the aircraft. The product is reachable only if both towers are within radio horizon of the aircraft.

### Radio horizon
Maximum LOS distance accounting for atmospheric refraction (4/3-Earth model): `d_km = 4.12·(√h_tx_m + √h_rx_m)`. Tower and aircraft heights are in metres inside the formula.

### Tower height
Height of an FM transmitting antenna above ground. Not stored in the database.

### Aircraft altitude
Height of the aircraft. Supplied in **feet** (aviation convention) and converted to metres for the horizon formula.

### Signal strength at the aircraft
How strong an FM signal is when it reaches the aircraft receiver, driven by the tower's transmit power and its distance to the aircraft (free-space path loss). This — not tower-to-tower distance — is the true driver of intermod risk under the aircraft-receiver mixing model. Only computable when an aircraft position is supplied; otherwise the model falls back to tower-to-tower proximity as a rough heuristic.

### Free-space path loss (FSPL)
Signal attenuation over an unobstructed path: `20·log10(d_km) + 20·log10(f_MHz) + 32.45` dB. Used to estimate signal strength at the aircraft.

### Default transmit power
When a station's `transmitterPower` is missing or zero, the model assumes **500 W** rather than treating it as silent.
