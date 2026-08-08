# Server Requirements — FM Station Tracker

**Project:** FM Station Tracker (NBTC Thailand)
**Prepared for:** Procurement / management — server purchase request
**Date:** 2026-06-21
**Status:** Draft for approval

---

## Executive Summary (One Page)

**What we need:** one Linux server to run the FM Station Tracker web app for NBTC
inspection teams. The app is built and ready; it needs a production server to go live.

**Recommended purchase:**

| | |
|---|---|
| **Server** | 1 × Linux VM — **4 vCPU, 8 GB RAM, 80 GB SSD**, static IP, 2 TB/mo bandwidth |
| **OS** | Ubuntu 24.04 LTS (or 22.04 LTS) |
| **Runs on it** | App + PostgreSQL database + Redis cache (all one box) |
| **Also needed** | Internal subdomain (e.g. `fmtracker.nbtc.go.th`) + TLS certificate (free) |

**Estimated cost:**

| Item | Cost | Type |
|------|------|------|
| Cloud VPS (recommended tier, Singapore) | **~$48/mo (~1,680 THB/mo)** | Recurring |
| — or on-prem VM in NBTC data center | Internal allocation (no cloud bill) | One-time/internal |
| Domain + TLS certificate | Free (under `nbtc.go.th` + Let's Encrypt) | — |

**Two hosting paths:**
1. **Cloud VPS** — fastest to launch, ~$48/mo, predictable. *Recommended if no data-center capacity.*
2. **On-prem NBTC VM** — no recurring compute bill, data stays in-house. *Recommended if capacity exists.*

**Decision needed:** approve cloud VPS vs on-prem hosting.

> *Full specs, storage breakdown, security requirements, and per-provider cost tables follow.*

---

## 1. Purpose

This document specifies the server resources required to host the **FM Station Tracker** —
an internal web application used by NBTC inspection teams to track FM radio stations,
run intermodulation calculations, and analyze radio interference. The application is
currently in development and needs a production server for deployment.

This is an **internal tool** (used by inspection staff, not the public). Sizing below
assumes on the order of **5–30 concurrent users** with a database in the low tens of
thousands of records. The recommended tier leaves comfortable headroom for growth.

---

## 2. What the Application Is (Technical Summary)

| Item | Detail |
|------|--------|
| Application type | Server-rendered web app (Next.js 15 / React 19) |
| Runtime | Node.js (v20 LTS or later) |
| Database | PostgreSQL (v14 or later) |
| Cache / rate-limit store | Redis (Upstash-compatible) |
| ORM | Prisma 5 |
| Auth | Cookie-based sessions (iron-session), bcrypt password hashing |
| External services (outbound) | OpenStreetMap / CARTO map tiles |
| Build tool | Turbopack |

The app has three main features: **station tracking/inspection**, an **intermodulation
calculator**, and **interference analysis**.

---

## 3. Required Software Stack

The server must be able to run the following. All are free / open-source.

- **OS:** Linux — **Ubuntu 24.04 LTS recommended** (22.04 LTS also fine; Debian/RHEL acceptable).
  Use an **LTS** release only — supported to Apr 2029 (24.04) / Apr 2027 (22.04). Avoid
  interim releases (24.10, 25.04) which get only 9 months of support.
- **Node.js:** v20 LTS or newer
- **PostgreSQL:** v14 or newer
- **Redis:** v6 or newer (or a managed Upstash Redis account)
- **Reverse proxy:** Nginx or Caddy (for TLS termination + serving the app)
- **Process manager:** systemd, PM2, or Docker
- **TLS certificate:** Let's Encrypt (free) or an NBTC-provided certificate

---

## 4. Hardware Sizing

Three tiers below. **Recommended** is the sensible default for this project.

### 4.1 Minimum (proof-of-concept / small team)

| Resource | Spec |
|----------|------|
| vCPU | 2 cores |
| RAM | 4 GB |
| Storage | 40 GB SSD |
| Bandwidth | 1 TB / month |
| Notes | App + PostgreSQL + Redis all on one box. Tight but workable for a handful of users. |

### 4.2 Recommended ✅ (production, single server)

| Resource | Spec |
|----------|------|
| vCPU | **4 cores** |
| RAM | **8 GB** |
| Storage | **80–100 GB SSD** (NVMe preferred) |
| Bandwidth | **2–3 TB / month** |
| Notes | Comfortable headroom for build process, Node app, PostgreSQL, Redis, and growth. |

### 4.3 Scalable (future growth / separate DB)

| Resource | Spec |
|----------|------|
| App server | 4 vCPU / 8 GB RAM |
| Database server | Separate 4 vCPU / 8–16 GB RAM PostgreSQL instance (or managed DB) |
| Redis | Managed Upstash or separate small instance |
| Notes | Split DB off the app server when concurrent users grow or data volume increases. |

> **Why 8 GB RAM is recommended, not 4 GB:** Next.js production builds (`next build`)
> and the Turbopack compiler are memory-hungry. Running the build on the same box as a
> live PostgreSQL + Redis on 4 GB risks out-of-memory failures during deployment.

---

## 5. Storage Breakdown

Storage is modest because the data is mostly text/numeric records, not media.

| Component | Estimated size |
|-----------|----------------|
| OS + system packages | ~10 GB |
| Application code + `node_modules` + build output | ~3–5 GB |
| PostgreSQL data (stations, interference sites, inspections, users) | ~1–5 GB, grows slowly |
| Logs + backups (local) | ~5–10 GB |
| **Total recommended** | **80–100 GB** gives years of headroom |

---

## 6. Network Requirements

- **Inbound:** HTTPS (443) and HTTP (80, redirect to HTTPS). SSH (22) restricted to admin IPs.
- **Outbound (must NOT be firewall-blocked):**
  - **Map tiles** — OpenStreetMap, CARTO, cartocdn (HTTPS), loaded by the browser but
    must be reachable from the user network.
  - **Let's Encrypt** — for automatic TLS certificate renewal (if used).
- **Static IP** recommended so DNS and any API allow-lists stay stable.
- **Domain name** — an internal NBTC subdomain (e.g. `fmtracker.nbtc.go.th`) for the app.

---

## 7. Security & Operational Requirements

- **TLS/HTTPS mandatory** — the app sets session cookies and handles login credentials.
- **Environment secrets** must be provided and stored securely (not in code):
  - `DATABASE_URL` — PostgreSQL connection string
  - `SESSION_PASSWORD` — 32-char secret for session encryption (`openssl rand -base64 32`)
  - `ADMIN_USERNAME` / `ADMIN_PASSWORD` — initial admin (changed after first login)
  - Redis/Upstash credentials
- **Backups:** automated daily PostgreSQL backup (`pg_dump`), retained ≥ 7 days, stored
  off-server (e.g. NBTC backup storage or object storage).
- **Firewall:** only 80/443 public; SSH restricted to admin IP range.
- **Monitoring:** basic uptime + disk/CPU/RAM alerts (e.g. systemd, Netdata, or NBTC's
  existing monitoring).
- **OS updates:** automatic security patches enabled.

---

## 8. Hosting Options (for the buyer to choose)

| Option | Pros | Cons | Indicative cost |
|--------|------|------|-----------------|
| **A. Cloud VPS** (DigitalOcean, Linode, AWS Lightsail, Vultr) | Fast to provision, predictable, easy to resize | Monthly OpEx, data offshore unless TH region | ~$24–48 / mo for recommended tier |
| **B. On-premise / NBTC data center** | Data stays in-house, no recurring cloud bill | Need NBTC IT to provision + maintain hardware | Internal cost |
| **C. Managed PaaS** (Vercel + managed Postgres + Upstash) | Near-zero ops, auto-scaling, native Next.js host | Less control, usage-based billing, data location | Variable |

> **Recommendation:** Option **A** (single cloud VPS, 4 vCPU / 8 GB / 80 GB) or Option
> **B** (equivalent on-prem VM) for the best balance of cost, control, and simplicity.
> Choose a **Singapore/Thailand region** if using cloud, to keep latency low and data
> closer to NBTC.

---

## 9. Recommended Purchase (One-Line Summary)

> **One Linux server (Ubuntu 24.04 LTS): 4 vCPU, 8 GB RAM, 80 GB SSD, static IP,
> 2 TB/month bandwidth — plus a domain/subdomain and TLS certificate.** PostgreSQL and
> Redis run on the same server. A separate managed database can be added later if usage
> grows.

---

## 10. Dependencies the Buyer Must Provide

- [ ] Server / VM matching the **Recommended** tier (Section 4.2)
- [ ] Internal domain or subdomain + DNS record
- [ ] TLS certificate (or allow Let's Encrypt)
- [ ] Outbound internet access to map tile providers
- [ ] Backup storage location
- [ ] Admin SSH access for deployment

---

*Questions on this document can go to the project developer. Specs assume current scope
(internal inspection tool, low tens of concurrent users) and can be revised if expected
usage changes.*

---

## Appendix A — Indicative Monthly Cost Estimates

Prices are approximate (as of 2026, USD) for the **Recommended** tier
(4 vCPU / 8 GB RAM / 80 GB SSD). Always confirm current pricing with the provider.
THB figures use ~35 THB/USD for reference only.

### A.1 Cloud VPS (single server, Postgres + Redis on the box)

| Provider | Plan | Region | ~USD/mo | ~THB/mo |
|----------|------|--------|---------|---------|
| DigitalOcean | Basic Droplet 8 GB / 4 vCPU | Singapore | $48 | ~1,680 |
| Linode / Akamai | Dedicated 8 GB / 4 vCPU | Singapore | $48 | ~1,680 |
| Vultr | Cloud Compute 8 GB / 4 vCPU | Singapore | $48 | ~1,680 |
| AWS Lightsail | 8 GB / 2 vCPU | Singapore | $44 | ~1,540 |
| AWS EC2 | t3.large (8 GB / 2 vCPU) on-demand | Singapore | ~$60 + storage | ~2,100+ |

> Add ~$1–10/mo for backups/snapshots and bandwidth overage. Reserved/annual plans
> typically cut 20–40%.

### A.2 Managed PaaS (least ops, usage-based)

| Service | Role | ~USD/mo |
|---------|------|---------|
| Vercel (Pro) | Next.js hosting | $20 + usage |
| Managed Postgres (Neon / Supabase / RDS) | Database | $0–25 (free tiers exist; ~$25 for small paid) |
| Upstash Redis | Cache / rate-limit | $0–10 (free tier covers light use) |
| **Subtotal** | | **~$20–55/mo**, scales with traffic |

### A.3 On-Premise / NBTC Data Center

| Item | Cost |
|------|------|
| VM on existing NBTC hardware | Internal allocation (no cloud bill) |
| Power / cooling / rack | Internal |
| One-time hardware (if new) | ~30,000–60,000 THB for an equivalent small server |
| Ongoing | NBTC IT staff maintenance time |

> **Lowest recurring cost** if NBTC already has data-center capacity. Best for keeping
> data fully in-house.

### A.4 Recurring Costs Regardless of Hosting

| Item | Cost | Notes |
|------|------|-------|
| Domain / subdomain | Often free if under `nbtc.go.th` | Internal DNS |
| TLS certificate | Free (Let's Encrypt) | Or NBTC-issued |
| Map tiles (OSM/CARTO) | Free at current usage | Heavy use may need a paid tile plan later |

### A.5 Bottom Line

- **Cheapest predictable:** single cloud VPS ≈ **$48/mo (~1,680 THB)** all-in for compute.
- **Cheapest overall:** on-prem VM if NBTC has spare capacity (no recurring compute bill).
