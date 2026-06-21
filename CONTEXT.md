# Context: FM Station Tracker

A glossary of the domain language used in this project. Implementation details belong in code and the wiki, not here.

## Glossary

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
