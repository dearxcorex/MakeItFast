# How to Connect to the Server

**Server:** `172.17.200.109` (hostname `NBTRCOMApp`)
**Last verified:** 2026-08-13

> ⚠️ **No passwords in this file.** It lives in the git repository. Passwords are held in
> the team password manager. See [§6](#6-where-the-secrets-live).

---

## 1. Quick Start

```bash
ssh -i ~/.ssh/nbtc_ed25519 deardevx@172.17.200.109
```

That is the whole thing, provided you have the key. If you do not, see [§4](#4-getting-access-new-team-member).

---

## 2. Make It One Word

Add this to `~/.ssh/config` on your laptop:

```sshconfig
Host nbtc
    HostName 172.17.200.109
    User deardevx
    IdentityFile ~/.ssh/nbtc_ed25519
    IdentitiesOnly yes
    ServerAliveInterval 60
```

Then:

```bash
ssh nbtc                      # log in
scp file.txt nbtc:/tmp/       # copy a file up
ssh nbtc 'df -h'              # run one command
```

`ServerAliveInterval 60` stops the session dropping when idle.
`IdentitiesOnly yes` stops SSH offering every key you own and tripping auth limits.

---

## 3. Accounts on the Server

| User | Purpose | Login | sudo |
|---|---|---|---|
| **`deardevx`** | **Developer account — use this one** | SSH key (`nbtc_ed25519`) | ✅ yes, password required |
| `admin` | Original shared account | SSH key or password | ✅ yes, password required |
| `admin-it` | NBTC IT's account — **do not use** | IT-managed | — |
| `root` | Direct root login is enabled in `sshd_config` | — | — |

**Use `deardevx`.** The `admin` account is shared, so its actions are not attributable to a
person. Keep it as a fallback only.

### sudo

Both `deardevx` and `admin` are in the `sudo` group and **sudo asks for a password** — it is
not passwordless. That is deliberate; keep it that way.

```bash
sudo systemctl status ssh
# [sudo] password for deardevx:
```

---

## 4. Getting Access (New Team Member)

Access is key-based. Two things must happen, both requiring someone who is already in.

**Step 1 — the new person generates a key on their own laptop:**

```bash
ssh-keygen -t ed25519 -f ~/.ssh/nbtc_ed25519 -C "nbtc-<yourname>"
cat ~/.ssh/nbtc_ed25519.pub    # send THIS to the admin
```

Send the `.pub` file only. **The private key never leaves the laptop** — not over chat, not
over email.

**Step 2 — an existing admin installs it and allows the user:**

```bash
# create the account
sudo useradd -m -s /bin/bash -G sudo <username>
sudo passwd <username>

# install their public key
sudo install -d -m 700 -o <username> -g <username> /home/<username>/.ssh
echo '<their-public-key>' | sudo tee -a /home/<username>/.ssh/authorized_keys
sudo chown <username>: /home/<username>/.ssh/authorized_keys
sudo chmod 600 /home/<username>/.ssh/authorized_keys
```

**Step 3 — allow them through sshd.** This is the step people forget:

```bash
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
sudo sed -i 's/^\(AllowUsers .*\)$/\1 <username>/' /etc/ssh/sshd_config
sudo sshd -t && sudo systemctl reload ssh      # validate BEFORE reloading
```

> **Always run `sshd -t` before reloading.** A malformed `sshd_config` can lock everyone out
> of a server you can only reach over SSH. Validate first, and keep your current session
> open until you have confirmed a *new* session works.

---

## 5. Line 140 of `sshd_config` — Read This Before Debugging

`sshd_config` contains an **`AllowUsers` allow-list**:

```
AllowUsers admin-it root admin deardevx
```

**A user not on this line cannot log in — even with a perfect key and a correct password.**
The failure looks exactly like a bad key:

```
Permission denied (publickey,password).
```

This is the single most likely reason a new account "doesn't work". Check this line first.

---

## 6. Where the Secrets Live

| Secret | Where |
|---|---|
| `deardevx` sudo password | Team password manager |
| `admin` password | Team password manager |
| SSH private key | Each person's own laptop, `~/.ssh/nbtc_ed25519` — never shared |
| App `.env` (DB password, `SESSION_PASSWORD`) | On the server at `/srv/fm-station-tracker/.env`, mode `600` |

**Never** commit any of these to git or paste them into chat.

---

## 7. Everyday Commands

```bash
# system state
df -h                 # disk
free -h               # memory
uptime                # load
systemctl list-units --type=service --state=running

# the app (once deployed)
sudo systemctl status fm-station-tracker
sudo systemctl restart fm-station-tracker
sudo journalctl -u fm-station-tracker -f      # live logs

# database (once installed)
sudo -u postgres psql

# firewall
sudo ufw status verbose
```

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Permission denied (publickey,password)` | User missing from `AllowUsers` | See [§5](#5-line-140-of-sshd_config--read-this-before-debugging) |
| Same, but user *is* in `AllowUsers` | Wrong key, or bad permissions | Key must be `600`, `~/.ssh` `700`, home not group-writable |
| `Could not chdir to home directory` | Account has no home directory | `sudo mkdir -p /home/<u> && sudo chown <u>: /home/<u>` |
| `Connection timed out` | Not on the NBTC network | This is a **private IP** — you must be on the internal network or VPN |
| `Host key verification failed` | Server rebuilt or key changed | `ssh-keygen -R 172.17.200.109` — but confirm *why* before accepting |
| Session drops when idle | No keepalive | Add `ServerAliveInterval 60` ([§2](#2-make-it-one-word)) |

### The server is on a private network

`172.17.200.109` is **not reachable from the internet**. You must be on the NBTC internal
network (or its VPN). If you are working from outside and the connection times out, the
server is fine — your network path is the problem.

---

## 9. Changes Made on 2026-08-13

Recorded so the next person is not confused by them.

| Change | Detail |
|---|---|
| Created user `deardevx` | uid 1002, home `/home/deardevx`, shell `/bin/bash`, in `sudo` group |
| Installed SSH key for `deardevx` | `nbtc_ed25519` public key → `authorized_keys` |
| **Fixed `admin`'s missing home directory** | `/home/admin` did not exist; created it, seeded `/etc/skel` dotfiles, `chown admin:`, mode `750` |
| **Changed `admin`'s shell** | `/bin/sh` → `/bin/bash` (it lacked `<<<`, arrays, and history) |
| Installed SSH key for `admin` | Same key, so `admin` no longer needs the password for login |
| **Edited `/etc/ssh/sshd_config`** | Appended `deardevx` to `AllowUsers`. Backup at `/etc/ssh/sshd_config.bak.before-deardevx`. Validated with `sshd -t`, then `systemctl reload ssh` |

All verified: both `deardevx` and `admin` log in by key, and `sudo` works for both.

**No packages were installed.** No Node.js, PostgreSQL, or Nginx yet — see
[`DEPLOYMENT.md`](./DEPLOYMENT.md).

### Still recommended

- **Disable password authentication** once everyone is on keys
  (`PasswordAuthentication no`) — it removes brute-force risk entirely.
- **Disable direct root login** (`PermitRootLogin no`) — currently `yes`.
- **Restrict SSH to the admin IP range** in ufw; port 22 is currently open to `Anywhere`.

Each needs NBTC IT's agreement, since `admin-it` uses this server too.

---

## 10. Related Documents

- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — server audit, what to install, deployment runbook
- [`SERVER_REQUIREMENTS.md`](./SERVER_REQUIREMENTS.md) — original hardware specification
