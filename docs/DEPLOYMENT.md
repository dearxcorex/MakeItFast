# Deployment Plan — FM Station Tracker on NBTRCOMApp

**Target server:** `172.17.200.109` (hostname `NBTRCOMApp`)
**Audited:** 2026-08-13
**Status:** Server is bare. Nothing is installed yet. This document is the plan, not a record of work done.

Companion document: [`SERVER_REQUIREMENTS.md`](./SERVER_REQUIREMENTS.md) (the spec we asked for).
This document is what we *actually got*, and what to do with it.

---

## 1. Verdict

**The server is usable.** It is a clean Ubuntu 24.04 LTS VM with plenty of RAM and disk.
We deploy directly on it with **Node.js + PostgreSQL + Nginx + systemd**. No Docker, no Redis.

But **three things are blocked on NBTC IT** and the app cannot go live without them:

1. **Firewall blocks inbound 80/443.** Only SSH is open. Nobody can reach the site.
2. **No TLS certificate path.** The server is on a private IP, so Let's Encrypt cannot verify it.
3. **DNS name.** No hostname points at this box yet.

Details in [Section 5](#5-blockers--needs-nbtc-it).

---

## 2. What Is Actually On The Server

### 2.1 Hardware

| Resource | Actual | Spec asked for | Verdict |
|---|---|---|---|
| CPU | **2 vCPU** — Intel Xeon Gold 6240 @ 2.60GHz | 4 vCPU | ⚠️ Under spec |
| RAM | **15 GiB** (679 MiB used, 14 GiB available) | 8 GB | ✅ Nearly double |
| Swap | 3.8 GiB | — | ✅ |
| Disk (root) | **194 GB**, 8.2 GB used — **176 GB free** | 80 GB | ✅ Well over |
| Disk (extra) | **500 GB** on `/dev/sdb1` — formatted ext4, **not mounted** | — | 🎁 Bonus, unused |
| Platform | VMware VM (open-vm-tools running) | — | — |
| Uptime | 2 days, load average 0.00 | — | Idle |

**On the 2 vCPU shortfall:** this is fine for *serving* 5–30 internal users. It only hurts
during `next build`, which is CPU-bound — expect a build to take a few minutes instead of
under one. The 15 GiB of RAM removes the out-of-memory risk that was the real reason we
asked for 8 GB. **Recommendation: accept 2 vCPU, do not block the project on it.**

**On the unused 500 GB disk:** `/dev/sdb1` is formatted but absent from `/etc/fstab`, so it
does not mount at boot. It is a good home for the PostgreSQL data directory and local
backups. Optional — 176 GB free on root is already enough. Ask NBTC IT what this disk was
provisioned for before claiming it.

### 2.2 Operating System

- **Ubuntu 24.04.4 LTS** (noble), kernel 6.8.0-137-generic, x86_64
- Timezone **Asia/Bangkok (+07)** — already correct, no change needed
- APT mirrors: `th.archive.ubuntu.com` + `security.ubuntu.com` — reachable
- `unattended-upgrades` is running — automatic security patching is already on ✅

This matches the requirements document exactly (Ubuntu 24.04 LTS, supported to Apr 2029).

### 2.3 Running Services

Nothing application-related. The full running set is stock Ubuntu:

```
auditd          cron            dbus            getty@tty1
ModemManager    multipathd      open-vm-tools   polkit
snapd           ssh             systemd-*       udisks2
unattended-upgrades             upower          vgauth
```

**Listening ports:** only `22` (SSH) and `53` (systemd-resolved, bound to loopback).
No web server, no database, no application. The box has never hosted anything.

### 2.4 Software — What Is Missing

| Needed | Installed? |
|---|---|
| `node` / `npm` | ❌ **MISSING** |
| `psql` / `postgres` | ❌ **MISSING** |
| `nginx` | ❌ **MISSING** |
| `docker` | ❌ MISSING (not needed — see §4) |
| `certbot` | ❌ MISSING (won't work here — see §5.2) |
| `git` | ✅ `/usr/bin/git` |
| `curl` / `wget` | ✅ |
| `ufw` | ✅ present and **active** |

### 2.5 Network

- IP `172.17.200.109/24` on `ens32`, gateway `172.17.200.1` — **private/internal only**
- DNS `172.17.1.99`, search domain `nbtc.domain`
- **Outbound works** — verified live: `google.com` 200, `registry.npmjs.org` 200,
  `deb.nodesource.com` 200, `archive.ubuntu.com` 200. So `apt install` and `npm install`
  will work. This was the big unknown and it passed.

### 2.6 Firewall (ufw) — Read This Carefully

ufw is **active** with `deny incoming` **and `deny outgoing` by default**:

| Direction | Allowed |
|---|---|
| **IN** | `22/tcp` only (plus loopback) |
| **OUT** | `53` (DNS), `80/tcp`, `123/udp` (NTP), `443/tcp` — **and nothing else** |

Two consequences that matter:

- **Inbound 80 and 443 are closed.** The app will be unreachable until they are opened.
- **Outbound 5432 is closed.** The app currently points at a **Neon PostgreSQL database in
  `ap-southeast-1`** (see `.env`). *This server cannot reach it.* Either open outbound 5432,
  or — better — run PostgreSQL locally. See [§4.2](#42-database).

### 2.7 User Accounts

| User | UID | Home | Shell | Note |
|---|---|---|---|---|
| `admin-it` | 1000 | `/home/admin-it` | `/bin/bash` | NBTC IT's account |
| `admin` | 1001 | `/home/admin` | `/bin/bash` | Shared fallback account |
| `deardevx` | 1002 | `/home/deardevx` | `/bin/bash` | **Developer account — use this** |

✅ **Fixed on 2026-08-13.** As found, `admin` had **no home directory** (every login printed
`Could not chdir to home directory /home/admin`, breaking `~/.ssh`, shell history, and npm's
cache) and used `/bin/sh`. Both corrected, and a per-person `deardevx` account was created
with key-based login and sudo.

`sudo` requires a password for both accounts — it is not passwordless. That is correct and
should stay that way.

Note `/etc/ssh/sshd_config` carries an **`AllowUsers` allow-list**; a new account cannot log
in until it is added there. Full details, plus how to onboard the next person, are in
[`SERVER_ACCESS.md`](./SERVER_ACCESS.md).

---

## 3. Where The App Runs Today

Currently on **Vercel + Neon Postgres** (`.vercel/` directory, `vercel.json` pinning region
`sin1`, `DATABASE_URL` pointing at `ep-morning-morning-a1eajjx3-pooler.ap-southeast-1.aws.neon.tech`).

Moving to NBTRCOMApp means replacing **both** halves — the host *and* the database. Plan for
a data migration from Neon, not just a code deploy. See [§7](#7-data-migration-from-neon).

---

## 4. Environment Choices — What To Install

This is the answer to "what environments do I install".

| Component | Choice | Version | Why |
|---|---|---|---|
| **Runtime** | Node.js via NodeSource | **22.x LTS** | App is Next.js 15.5 / React 19. Requires Node ≥ 18.18; 22 LTS is supported to Apr 2027. Ubuntu's own `nodejs` package is too old — use NodeSource. |
| **Database** | PostgreSQL from the **PGDG** repo | **17** | ⚠️ Not Ubuntu's 16 — **Neon runs PostgreSQL 17.10**, and a v17 dump does not reliably restore into v16. Match the source version. See §4.2. |
| **Reverse proxy** | Nginx from Ubuntu `main` | **1.24** | TLS termination + proxy to Node on `127.0.0.1:3000`. |
| **Process manager** | **systemd** | built-in | Already on the box. PM2 adds a dependency and a second supervisor for no gain on a single-app server. |
| **Cache / throttle** | **NOTHING — skip it** | — | See §4.3. This is important. |
| **Containers** | **No Docker** | — | See §4.4. |

### 4.1 Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # expect v22.x
```

### 4.2 Database

**Run PostgreSQL locally on this box.** Do not keep pointing at Neon.

Reasons, in order of weight:
1. **ufw blocks outbound 5432** — Neon is literally unreachable from this server today.
2. Keeping NBTC inspection data in-house is the stated point of moving off Vercel.
3. Local socket beats a cross-region round trip to Singapore on every query.

**Install version 17, not Ubuntu's default 16.** The live Neon database reports
`PostgreSQL 17.10`. `pg_dump` must be at least the source server's version, and a v17 dump
is not guaranteed to restore into a v16 server. Matching versions removes the whole class of
problem. Ubuntu 24.04 `main` only carries 16, so add the PGDG repository (reachable — it is
served over 443, which ufw allows outbound):

```bash
sudo apt-get install -y curl ca-certificates
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
https://apt.postgresql.org/pub/repos/apt noble-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt-get update
sudo apt-get install -y postgresql-17 postgresql-contrib-17

sudo -u postgres createuser --pwprompt fmtracker
sudo -u postgres createdb -O fmtracker fm_station_tracker
```

Then `DATABASE_URL="postgresql://fmtracker:<password>@localhost:5432/fm_station_tracker"`.

*If management insists on keeping Neon*, ask NBTC IT to allow outbound `5432/tcp` instead —
but push back, it is the worse option.

### 4.3 Redis — Do NOT Install It

The requirements document lists Redis. **Skip it.** Two independent reasons:

**It is not needed here.** Redis was only used to make the login throttle survive Vercel's
serverless cold starts. `src/lib/loginThrottle.ts` falls back to an in-memory `Map` when
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are unset. On a long-running systemd
service the process persists, so the in-memory throttle works correctly. The problem Redis
solved does not exist on this deployment.

**Installing `redis-server` would not work anyway.** The app uses the `@upstash/redis`
client, which speaks Upstash's **HTTP REST API** — *not* the standard Redis wire protocol.
A stock `apt install redis-server` cannot talk to it. Wiring it up would mean either adding
a REST shim (`serverless-redis-http`) or rewriting `loginThrottle.ts` to use `ioredis`.

**Decision: launch without Redis.** Revisit only if we later run multiple app instances
behind a load balancer, at which point rewriting the throttle to `ioredis` + local Redis is
the right move. Note the tradeoff: a service restart clears the login-attempt counters.

### 4.4 Docker — Not Needed

One app, one database, one server, one team. systemd + Nginx is fewer moving parts, uses
less of our 2 vCPU, and NBTC IT already knows how to operate it. Docker would add an image
registry, a build pipeline, and a layer of indirection for no benefit at this size.

### 4.5 Summary — One Command Block

```bash
# Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 17 — via PGDG, see §4.2 for the repo setup first
sudo apt-get install -y postgresql-17 postgresql-contrib-17

# Nginx
sudo apt-get install -y nginx

# NOT installing: redis, docker, pm2, certbot
```

---

## 5. Blockers — Needs NBTC IT

**The app cannot serve a single user until items 1–3 are resolved.** Raise these now; they
have lead time.

### 5.1 Open Inbound 80 and 443

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

Also confirm no **upstream** network firewall between the user VLAN and `172.17.200.0/24`
blocks these — ufw is only the host-level firewall.

Consider restricting SSH (22) to the admin IP range at the same time, per the requirements
document. It is currently open to `Anywhere`.

### 5.2 TLS Certificate — Let's Encrypt Will Not Work

`172.17.200.109` is a **private address with no public inbound path**, so Let's Encrypt's
HTTP-01 challenge cannot reach it. `certbot` is not a viable option as-is.

Three ways forward, best first:

1. **Ask NBTC IT for an internally-issued certificate** for the chosen hostname. Cleanest —
   NBTC clients already trust the internal CA. **Recommended.**
2. **Let's Encrypt via DNS-01**, if we control DNS for `nbtc.go.th` and can automate TXT
   records. Works for a private host, but needs DNS API access.
3. **Self-signed certificate.** Works technically, but every user gets a browser warning.
   Acceptable for a pilot only.

TLS is **not optional** — the app sets session cookies and handles login credentials over
`iron-session`. Serving it over plain HTTP would expose sessions on the internal network.

### 5.3 DNS Hostname

Request an A record, e.g. `fmtracker.nbtc.go.th` → `172.17.200.109`, on the internal DNS
server (`172.17.1.99`). The certificate in §5.2 must match this name, so decide the name
**before** requesting the cert.

### 5.4 Decisions We Need From The Team

- [ ] Accept **2 vCPU**, or request an increase to 4? *(Recommendation: accept.)*
- [ ] Mount the spare **500 GB `/dev/sdb1`** for Postgres data + backups, or leave it? *(Ask IT what it is for first.)*
- [ ] Confirm move **off Neon** to local PostgreSQL. *(Recommendation: yes.)*
- [ ] Confirm the **hostname** for DNS + certificate.
- [ ] Where do **off-server backups** go? The requirements document asks for daily `pg_dump`, 7-day retention, stored off-box. No destination has been chosen.

---

## 6. Deployment Runbook

Run in order. Steps 0–2 can be done now; step 5 onward needs §5 resolved.

### Step 0 — Accounts — ✅ already done (2026-08-13)

`admin`'s home directory and shell are fixed, and the `deardevx` developer account exists
with key login and sudo. See [§2.7](#27-user-accounts) and
[`SERVER_ACCESS.md`](./SERVER_ACCESS.md). **Run the remaining steps as `deardevx`.**

### Step 1 — Install the stack

Per [§4.5](#45-summary--one-command-block).

### Step 2 — Create the database

Per [§4.2](#42-database). Save the password into the secrets store, not into a chat message.

### Step 3 — Deploy the code

```bash
sudo mkdir -p /srv/fm-station-tracker
sudo chown admin:admin /srv/fm-station-tracker
git clone <repo-url> /srv/fm-station-tracker
cd /srv/fm-station-tracker
npm ci
```

### Step 4 — Configure environment

Create `/srv/fm-station-tracker/.env` (mode `600`, owned by the service user):

```bash
DATABASE_URL="postgresql://fmtracker:<password>@localhost:5432/fm_station_tracker"
SESSION_PASSWORD="<openssl rand -base64 32>"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="<strong initial password>"
ADMIN_DISPLAY_NAME="Admin"
NODE_ENV="production"
```

Leave `UPSTASH_REDIS_REST_URL` / `_TOKEN` **unset** — that is what activates the in-memory
throttle fallback (§4.3).

`SESSION_PASSWORD` must be ≥ 32 characters. **Rotating it logs every user out**, so set it
once and store it properly.

```bash
chmod 600 .env
```

### Step 5 — Schema — ⚠️ Read This Before Running Anything

**`prisma migrate deploy` will not work on this project.** The `prisma/migrations/`
directory contains `migration.sql` files, but:

- the folder names are `2026-06-21-drop-cloudrf-cache` style, **not** Prisma's required
  `<14-digit-timestamp>_name` format, and
- there is **no `migration_lock.toml`**.

Prisma will not recognise these as a migration history. Also note `npm run build` runs
`prisma generate` only — it does **not** run migrations, so nothing will silently fix this
at deploy time.

**The live database confirms the history has drifted.** Querying Neon directly shows:

- `_prisma_migrations` exists but holds only **4 rows**, while `prisma/migrations/` has
  **9 folders** — so most were applied outside Prisma's tracking, if at all.
- The table `cloudrf_cache` is **still present with 18 rows**, even though
  `prisma/migrations/2026-06-21-drop-cloudrf-cache/migration.sql` exists to drop it. **That
  migration was never applied to production.**

So the migration folders are not a reliable description of the live schema. Do not assume
replaying them reproduces production.

**Because we are migrating real data from Neon (§7), skip this step entirely.** The
`pg_restore` in §7 brings the schema *and* the data across in one operation, and it
reproduces production exactly — including the drift above — with no guesswork.

`prisma db push` + `prisma db seed` is the right path **only** for a throwaway dev or
staging database with no data to preserve:

```bash
npx prisma db push      # creates the schema from prisma/schema.prisma
npx prisma db seed      # creates the initial admin user from ADMIN_* vars
```

Longer term, either regularise the migration folders into Prisma's format or drop them and
treat `schema.prisma` as the single source of truth. **Owner: whoever knows the migration
history.** This is technical debt to settle after launch, not a blocker for it.

### Step 6 — Build

```bash
npm run build   # prisma generate && next build --turbopack
```

Expect a few minutes on 2 vCPU. If it is ever OOM-killed, `export NODE_OPTIONS=--max-old-space-size=4096` — unlikely with 15 GiB.

### Step 7 — systemd service

`/etc/systemd/system/fm-station-tracker.service`:

```ini
[Unit]
Description=FM Station Tracker
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=admin
WorkingDirectory=/srv/fm-station-tracker
EnvironmentFile=/srv/fm-station-tracker/.env
Environment=PORT=3000
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fm-station-tracker
sudo systemctl status fm-station-tracker
```

The app binds `127.0.0.1:3000` behind Nginx — it is never exposed directly.

### Step 8 — Nginx

Reverse-proxy 443 → `127.0.0.1:3000`, redirect 80 → 443, using the certificate from §5.2.
`next.config.ts` already sets `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, and `Permissions-Policy`, so **do not duplicate those headers in Nginx**
— duplicated headers are a common cause of odd browser behaviour. Add HSTS at the Nginx
layer only.

Note: there is deliberately **no CSP** (see the comment in `next.config.ts` — Leaflet pulls
map tiles from OSM/CARTO/cartocdn). Do not add a strict CSP in Nginx without auditing those
origins first, or the map breaks.

### Step 9 — Verify

- [ ] `curl -I https://<hostname>` returns 200
- [ ] Login works, session cookie is set with `Secure`
- [ ] **Map tiles render** — browsers on the user VLAN must reach OSM/CARTO over 443
- [ ] Intermod calculator returns results
- [ ] `sudo systemctl restart fm-station-tracker` recovers cleanly
- [ ] Reboot the VM and confirm the app comes back on its own

### Step 10 — Backups

Not yet designed. Daily `pg_dump`, 7-day retention, copied off-box. Blocked on §5.4 —
we have no destination.

---

## 7. Data Migration From Neon

**This is easy.** The database is small — measured live on 2026-08-13:

| | |
|---|---|
| Source version | **PostgreSQL 17.10** (Neon, `ap-southeast-1`) |
| Total size | **9.1 MB** |
| Extensions | `plpgsql` only — nothing exotic to reinstall |

| Table | Rows |
|---|---|
| `fm_station` | 255 |
| `station_inspection` | 54 |
| `interference_site` | 41 |
| `station_inspection_member` | 31 |
| `cloudrf_cache` | 18 ← *should have been dropped; see §6 Step 5* |
| `interference_inspection` | 10 |
| `user` | 6 |
| `_prisma_migrations` | 4 |
| `interference_inspection_member` | 3 |

At 9 MB the transfer takes **seconds**. There is no need for a maintenance window beyond
the cutover itself.

### 7.1 Two constraints to respect

1. **The dump must be taken from a machine that can reach Neon** — a laptop, *not* the
   server, because ufw blocks outbound 5432 (§2.6).
2. **`pg_dump` must be version 17 or newer.** A v16 client refuses to dump a v17 server.
   On macOS: `brew install libpq` (ships v17), then add its `bin` to `PATH`.

### 7.2 Procedure

```bash
# 1. On the laptop — dump Neon (read-only; does not affect production)
pg_dump "$DATABASE_URL" -Fc --no-owner --no-privileges -f fmtracker.dump

# 2. Copy to the server
scp fmtracker.dump admin@172.17.200.109:/tmp/

# 3. On the server — restore into the local database
pg_restore -d "postgresql://fmtracker:<password>@localhost:5432/fm_station_tracker" \
  --no-owner --no-privileges /tmp/fmtracker.dump

# 4. Verify row counts match the table above
psql "postgresql://fmtracker:<password>@localhost:5432/fm_station_tracker" \
  -c "select relname, n_live_tup from pg_stat_user_tables order by n_live_tup desc;"

# 5. Remove the dump — it contains password hashes and live inspection data
shred -u /tmp/fmtracker.dump
```

Confirm the counts match on both sides before cutover. **Keep Neon running (read-only)
until the new deployment is signed off — it is the rollback path.** Only delete the Neon
project once the server has been live and backed up for a sensible period.

---

## 8. Quick Reference

```
Host        NBTRCOMApp / 172.17.200.109 (private, VMware VM)
OS          Ubuntu 24.04.4 LTS — kernel 6.8.0-137
CPU/RAM     2 vCPU Xeon Gold 6240 / 15 GiB
Disk        194 GB root (176 GB free) + 500 GB unmounted on /dev/sdb1
Open now    inbound 22 only; outbound 53/80/123/443 only
Need open   inbound 80, 443
Stack       Node 22 LTS + PostgreSQL 17 (PGDG) + Nginx + systemd
Not using   Redis, Docker, PM2, certbot
Source DB   Neon PostgreSQL 17.10 (ap-southeast-1) — 9.1 MB, ~420 rows
App path    /srv/fm-station-tracker  (proposed)
App port    127.0.0.1:3000 behind Nginx
```

---

## 9. Status

| Step | State |
|---|---|
| Server audit | ✅ Done — this document |
| Fix `admin` home directory + shell | ✅ Done 2026-08-13 |
| Create `deardevx` account (key + sudo) | ✅ Done 2026-08-13 — see `SERVER_ACCESS.md` |
| Install Node / PostgreSQL / Nginx | ⬜ Not started |
| Open firewall 80/443 | 🔴 **Blocked — NBTC IT** |
| TLS certificate | 🔴 **Blocked — NBTC IT** |
| DNS hostname | 🔴 **Blocked — NBTC IT** |
| Schema strategy | ✅ Resolved — restore from Neon (§7), not `prisma migrate` |
| Migration-history cleanup | 🟡 **Needs owner** — post-launch debt, see §6 Step 5 |
| Data migration from Neon | ⬜ Not started — sized and scripted (§7), 9.1 MB, low risk |
| Backup destination | 🟡 **Needs decision** |

**No packages have been installed.** The only changes made to the server so far are the
account fixes listed above (users, SSH keys, and one `AllowUsers` line in `sshd_config`) —
all recorded in [`SERVER_ACCESS.md` §9](./SERVER_ACCESS.md#9-changes-made-on-2026-08-13).
The Neon database was read from, never written to.
