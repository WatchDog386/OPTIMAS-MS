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
  node dist/scripts/create-admin.js --staff FBI-ADM-001 --name "Full Name" --email it@optimas.co.ke --password 'a-long-unique-password'
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


## Off-site backups

The nightly database dump and photo archive are kept in `deploy/backups` on the server. To also copy them somewhere else after every run:

1. Make a free bucket at any S3-compatible provider (Backblaze B2, Wasabi, AWS S3, …) and an access key for it.
2. `cp deploy/backup.env.example deploy/backup.env`, fill in the bucket and keys, and set `BACKUP_PASSPHRASE` (make one with `openssl rand -base64 32`). Backups are then encrypted on the server before upload, so the storage company only holds scrambled files. **Write the passphrase down somewhere safe**: without it the off-site copies can never be restored. To bring one back: `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env exec backup sh /backup.sh fetch db_2026-10-25_0100.dump`.
3. `bash deploy/deploy.sh` (needs Docker Compose 2.24 or newer).
4. Next morning check the log: `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env logs --tail=20 backup` should say "off-site copy done".
5. Once a month, restore a backup on a spare machine (`deploy/restore.sh`) to prove it works.

## Monitoring and alerts

1. Install the free **ntfy** app on your phone and subscribe to a private topic name only you know.
2. `cp deploy/monitor.env.example deploy/monitor.env` and put `https://ntfy.sh/<your-topic>` as `ALERT_URL`.
3. `bash deploy/monitor.sh` once to see it work, then `bash deploy/monitor.sh --install` to run it every 5 minutes.

It alerts when the site or database stops answering, the disk is nearly full, or a backup is late or missing, and again when the problem clears. For a view from outside your network, also add the site address to a free uptime service (e.g. UptimeRobot).

## Working offline

Check-in, check-out, starting a job and completing a job keep working with no signal: the camera takes the photo, the phone saves it with the action, and it is sent automatically when the signal returns (a "waiting to send" pill shows at the top meanwhile). The server records the time the photo was really taken and flags it **Taken offline** so supervisors can see which records were sent late. Offline photos are accepted up to 48 hours after they were taken.

A technician's phone also keeps today's jobs (with details), stock and attendance and refreshes them every 5 minutes while online, so those screens open even in a dead zone. A "No signal · showing saved data" pill shows when the server can't be reached.


## Push notifications on the web app

Alerts that arrive even when the app is closed (job assigned, approvals, stock alerts):

1. `bash deploy/deploy.sh` (installs the new version).
2. `bash deploy/vapid.sh` once: creates the server's key pair in `deploy/.env`. Then `bash deploy/deploy.sh` again.
3. On each phone, open **Notifications** in the app and tap **Turn on alerts**. iPhones (iOS 16.4+) must first add the app to the Home Screen.

Changing a password, or **Sign out other devices** on the Change password screen, signs the person out everywhere else straight away.

## Maps, live tracking and chat

Nothing to install: they come with `bash deploy/deploy.sh`.

- **Location must be allowed.** After signing in, technicians and customers are asked whether the app may use their location. "Not now" asks again at the next sign-in. They can change their answer later under Profile (technicians) or Account (customers). Location only works over **https**, so use the domain, not the bare IP.
- **What the app sees.** A technician's phone reports its position while the Optimas app is open, about every 20 seconds or after moving 40 m. A web app cannot track a phone that has closed it, so managers then see "last seen" with a time.
- **Map service.** Street maps come from OpenStreetMap, which is free and needs no key. For heavy use you may want your own tile provider later: set `EXPO_PUBLIC_MAP_TILE_URL` (and `EXPO_PUBLIC_MAP_TILE_ATTRIBUTION`) when building the web app.
- **Road directions and arrival times** come from the free public OSRM server (`ROUTING_URL`). Typed addresses are looked up with OpenStreetMap Nominatim (`GEOCODING_URL`). Both are fair-use services. If either cannot be reached, the app still works and shows straight-line estimates, labelled as estimates. To turn them off, set `ROUTING_URL=` or `GEOCODING_URL=` (empty) in `deploy/.env`. If the business grows, run your own OSRM server and point `ROUTING_URL` at it.
- **Chat** goes through the Optimas server. Messages arrive within a few seconds while a conversation is open, and as a push notification otherwise, if alerts are turned on.

## Privacy, legal pages and contacts

The app has a **Privacy Policy** (`/privacy`), **Terms of Service** (`/terms`) and a **Help** page (`/help`), all readable without signing in and linked from the sign-in page and every profile page.

- **Fill in the company details** in `deploy/.env`, then `bash deploy/deploy.sh`. They appear on the help, privacy and terms pages and on customers' support buttons; an empty setting is simply hidden (no made-up numbers are ever shown):
  ```
  COMPANY_NAME=Optimas Networks
  COMPANY_ADDRESS=<street, town>
  SUPPORT_PHONE=+2547XXXXXXXX
  SUPPORT_WHATSAPP=2547XXXXXXXX
  SUPPORT_EMAIL=support@...
  PRIVACY_EMAIL=privacy@...        # defaults to SUPPORT_EMAIL
  ```
- **Have a lawyer read the two pages** before you rely on them; they describe exactly what the app does, but only a lawyer can confirm they fit your contracts. The Kenya Data Protection Act also expects businesses that process staff and customer data to **register with the ODPC** (www.odpc.go.ke) as a data controller.
- **People's data rights are built in:** Profile/Account → *Download my data*; customers can *Delete my account*; staff deletions go through an administrator.
- **Old data is deleted automatically:** location trail after 3 days, notifications after 180 days, unused photos after a day (see `backend/src/lib/retention.ts`; the Privacy Policy reads the same numbers).

## Staff and customer numbers (FBI-)

New numbers are `FBI-ADM-001`, `FBI-SUP-001`, `FBI-STR-001`, `FBI-TEC-001` and customers `FBI-CUS-10000` upwards. The update renames existing `OPT-…` logins (and app-made `OPT-CUS-…` account numbers on jobs, requests and devices) automatically. Anyone who still types their old `OPT-…` number is signed in to the same account, so tell people their new number at your own pace.

## Fingerprint lock

Anyone can turn on **Fingerprint lock** in Profile / Account (shown only on phones with a fingerprint or face sensor). The app then opens on a lock screen and locks again after a minute in the background; "Use password instead" always works.

- It needs the real `https://` address (it does not work over plain `http://`).
- The phone's sensor signs a one-time challenge and the server checks it, so nothing about the fingerprint is ever stored on the server.
- It is turned on per phone. Signing in on a new phone needs it turned on again there.
- If it will not turn on, the pop-up now says why. Usually the phone has no screen lock or fingerprint set up (Settings → Security), or the app was opened in a browser that cannot use the sensor (use Chrome on Android, Safari on iPhone).
- If the app is served under a second address (another domain pointing at the same server), list it in `backend/.env` as `WEBAUTHN_ORIGINS=https://other.example.com`. The normal address needs nothing.

## Team jobs and group chats

- **New job → Assign to → Team**: pick a saved team or make a new one (name or number, at least two technicians, and the leader).
- Everyone in the team sees the job and its alerts. The leader starts it and files the report for everyone; the others cannot submit it.
- Every team gets a group chat. Supervisors and admins can read and reply in all team groups.
- Editing a job can move it to another team or back to one technician. Forwarding to the nearest technician makes it a one-person job.
- The Jobs report has a **Team (members)** column.

