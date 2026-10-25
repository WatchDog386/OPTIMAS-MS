# Deploying Optimas MS on Proxmox

This guide puts the whole system — API, database, photo storage, backups and the manager web console —
on **one Ubuntu VM** on the Optimas Proxmox server (`102.202.151.254`).

```
 Phones (Optimas MS app) ─┐                 ┌──────────── Proxmox host 102.202.151.254 ────────────┐
                          │  HTTPS :443     │  VM 100 · Ubuntu 24.04 · Docker                       │
 Managers' browsers ──────┴───────────────▶ │  ┌────────┐   ┌──────┐   ┌──────────┐   ┌──────────┐  │
                                            │  │ Caddy  │──▶│ API  │──▶│ Postgres │   │ backups  │  │
                                            │  │ :80/443│   │ :4000│   └──────────┘   └──────────┘  │
                                            │  │ + web  │   └──┬───┘   photos volume ◀──────┘       │
                                            │  └────────┘      └──────▶                             │
                                            └───────────────────────────────────────────────────────┘
```

## 0. Before you start — secure the Proxmox console ⚠️

The Proxmox web UI (`https://102.202.151.254:8006`) is reachable from the internet. That page controls
every VM on the server, so it is the most valuable target you have. Strongly recommended:

- **Restrict port 8006** to the office IP or a VPN (Datacenter → Firewall, or the host's firewall), e.g.
  allow `8006/tcp` and `22/tcp` only from your office public IP, drop everything else.
- **Enable two-factor authentication** for every Proxmox user (Datacenter → Permissions → Two Factor).
- Do not reuse the root password anywhere else; keep Proxmox updated (`apt update && apt full-upgrade`).

## 1. Create the VM (Proxmox UI)

| Setting | Recommended |
|---|---|
| OS | Ubuntu Server 24.04 LTS ISO (or the Ubuntu cloud image) |
| CPU | 2 vCPU (type `host`) |
| Memory | 4 GB |
| Disk | 60 GB (photos grow ≈ 150 KB each; 50 staff × 6 photos/day ≈ 1.4 GB/month) |
| Network | `vmbr0` (bridged) or `vmbr1` (NAT) — see step 2 |
| Options | Enable **QEMU Guest Agent**, start at boot |

During Ubuntu installation, create an admin user and enable OpenSSH.

## 2. Make the VM reachable on ports 80 and 443

Pick the option that matches your network:

**A. The VM has its own public IP / sits on the office LAN (bridged `vmbr0`)**
Point the router/firewall's ports **80** and **443** at the VM's IP. Done.

**B. Only the Proxmox host has the public IP (NAT on `vmbr1`)** — forward the ports on the host
(replace `10.10.10.100` with the VM's private IP), in `/etc/network/interfaces` under `vmbr1`:

```
post-up   iptables -t nat -A PREROUTING -i vmbr0 -p tcp -m multiport --dports 80,443 -j DNAT --to 10.10.10.100
post-up   iptables -t nat -A PREROUTING -i vmbr0 -p udp --dport 443 -j DNAT --to 10.10.10.100
post-down iptables -t nat -D PREROUTING -i vmbr0 -p tcp -m multiport --dports 80,443 -j DNAT --to 10.10.10.100
post-down iptables -t nat -D PREROUTING -i vmbr0 -p udp --dport 443 -j DNAT --to 10.10.10.100
```

then `ifreload -a`.

## 3. Point a domain at the server (needed for HTTPS)

Create a DNS **A record**, e.g. `ms.optimas.co.ke → 102.202.151.254`.
HTTPS certificates are then issued and renewed automatically by Caddy (Let's Encrypt).

> Without a domain the system still runs on `http://102.202.151.254`, but **only use that for testing**:
> logins and photos would travel unencrypted, and Android release builds block plain-HTTP traffic.

## 4. Install

SSH into the VM, then:

```bash
git clone https://github.com/WatchDog386/OPTIMAS-MS.git
cd OPTIMAS-MS
sudo bash deploy/install.sh          # Docker, firewall (22/80/443 only), fail2ban, auto security updates

cp deploy/.env.example deploy/.env
nano deploy/.env                     # set SITE_ADDRESS, POSTGRES_PASSWORD, JWT_SECRET, office coordinates…
#   generate secrets with:  openssl rand -hex 24   and   openssl rand -hex 48

sudo bash deploy/deploy.sh           # builds and starts everything, runs DB migrations, waits for health
```

Create the first administrator (no demo data is loaded in production):

```bash
sudo docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env exec api \
  node dist/scripts/create-admin.js --staff OPT-ADM-001 --name "Full Name" --email it@optimas.co.ke --password 'a-long-unique-password'
```

Check it: open `https://ms.optimas.co.ke` (manager web console) and `https://ms.optimas.co.ke/health`.
Then sign in and add staff, the inventory catalogue and stock from the app.

## 5. Build the mobile app against your server

```bash
cd mobile
npm install -g eas-cli
eas login
eas init                                   # links the project; also required for push notifications
# set EXPO_PUBLIC_API_URL in eas.json → "https://ms.optimas.co.ke/api/v1"
eas build -p android --profile preview     # installable APK for staff phones
```

Distribute the APK to staff (or publish via Google Play with `--profile production`).

## 6. Day-2 operations

| Task | Command (from the repo folder on the VM) |
|---|---|
| Update to latest version | `sudo bash deploy/deploy.sh` |
| View logs | `sudo docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env logs -f api` |
| Status | `sudo docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env ps` |
| Take a backup now | `sudo docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env exec backup sh /backup.sh once` |
| Restore a backup | `sudo bash deploy/restore.sh deploy/backups/db_<date>.dump deploy/backups/photos_<date>.tar.gz` |
| Reset a user's password | run `create-admin.js` (admins) or edit the user in the app (Admin) |

**Backups** run daily at `BACKUP_HOUR` and are kept for `BACKUP_KEEP_DAYS` days in `deploy/backups/`
(database dump + photo archive). Copy them **off the server** too — e.g. a Proxmox Backup Server job for
VM 100, or a nightly `rsync` of `deploy/backups/` to another machine. Also schedule Proxmox **VM snapshots/backups**
(Datacenter → Backup) as a second layer.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Certificate not issued | DNS A record must point to the public IP, and ports 80+443 must reach the VM (step 2). Check `logs web`. |
| App says "Cannot reach the Optimas server" | Wrong `EXPO_PUBLIC_API_URL` in the build, or the domain does not resolve on mobile data. |
| Everyone flagged `OUTSIDE_GEOFENCE` | Set `OFFICE_LAT` / `OFFICE_LNG` / `OFFICE_RADIUS_M` in `deploy/.env`, then redeploy. |
| Times are off by hours | `TZ_OFFSET_MINUTES` (Nairobi = 180). |
| Push notifications not arriving | Run `eas init` before building, keep `PUSH_ENABLED=true`, make sure the VM can reach `exp.host` over HTTPS. |
