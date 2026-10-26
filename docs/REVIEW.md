# Senior review — Optimas MS

An honest audit of the system as it stands: what was wrong, what has been fixed (with the test that proves it), and what is still open, in the order it should be done.

## Fixed in this pass

| # | Problem | Why it mattered | Fix | Proof |
|---|---|---|---|---|
| 1 | A signed token carried the person's **role and "active" flag for 12 hours**. | A sacked technician could keep using the app, and a demoted supervisor kept supervisor powers, until the token expired. | Every request now checks the person's current role and active flag (cached 10 s; cleared the moment an admin changes the account). | `test/security.test.ts` — deactivated user gets 401 on the next request; demoted supervisor gets 403. |
| 2 | **Login lockout counted successful sign-ins**, 10 per 15 min per address. | An office signing in from one Wi-Fi at 8 am would lock out the 11th person. | Only failed sign-ins count. | Existing auth tests + config. |
| 3 | No ceiling on API requests. | One script or runaway client could exhaust the server. | 600 requests/min/address (`API_RATE_LIMIT`). | Config; tests run with a high limit. |
| 4 | `/health` always said "ok". | The proxy and Docker would report healthy while the database was down. | `/health` queries the database and answers 503 when it can't. | `test/security.test.ts`. |
| 5 | A placeholder `JWT_SECRET` (e.g. `change-me…`) was accepted in production. | Anyone who knows it can forge a login for any user. | Production refuses to start with a placeholder; warns on short secrets and `CORS_ORIGIN=*`. | Config. |
| 6 | Browser photo uploads sent text instead of the picture, and web photos were PNG, which the server rejects (JPEG only). | Camera proof didn't work in the web app. | Real file upload + JPEG output (`mobile/src/utils/upload.ts`). | Browser test with a fake camera. |
| 7 | Barcode scanning only knew 5 formats and fetched its decoder from a public CDN. | Product barcodes (EAN/UPC) weren't read; scanning failed offline. | 13 formats; decoder served from our own server. | Browser test: EAN-13 read in ~0.2 s. |

| 8 | **No offline work.** With no signal a technician could not check in, start or finish a job. | Field staff lose coverage in basements and estates; work stalled or was written on paper. | The camera still works offline: the photo is kept on the phone and sent automatically when the signal returns, stamped with the time it was really taken and marked "Taken offline" for the supervisor. Covers check-in, check-out, job start and job completion. | `test/offline.test.ts` (server) and a browser run: photo taken offline → stored → sent in order on reconnect → queue empty. |
| 9 | **Backups lived on the same server.** | A dead disk or VM would lose the data and the backups together. | Optional off-site copy after every nightly backup (`deploy/backup.env.example`). | Run against stand-in tools; **not yet run against a real cloud bucket.** |
| 10 | **Nobody was told when the site went down.** | An outage at night would be found by customers first. | `deploy/monitor.sh` checks the site and database, disk space and backup age every 5 minutes and sends a phone alert only when something changes. | Run against a stand-in site and alert receiver. |

Backend suite: 42 tests pass (34 before this pass).

## Still open — highest value first

1. **Switch on the new safety nets.** Off-site backups and monitoring ship switched off: they need your storage account and your phone's alert topic (see `docs/DEPLOYMENT.md`). Until then problem 2 below is unsolved. After the first night, restore a backup on a spare machine to prove it works.
2. **Offline gaps.** Offline covers the four photo steps. Not yet offline: scanning stock in/out, recording a service request, and *opening* a job screen that was never loaded (the phone only remembers what it saw while online). A "download today's jobs" step at check-in would close this.
3. **Session hygiene.** A password change doesn't sign out other devices, and the web app keeps its token in the browser's local storage (normal for a PWA, but a stolen phone stays signed in until the token expires). Add a "sign out everywhere" and shorter tokens with refresh.
4. **Push notifications on the web app.** Alerts only arrive while the app is open (polling). Web push would make "job assigned" instant.
5. **End-to-end tests of the screens.** The API is well tested; the app has typechecking only. Turn the browser checks used in this review (sign-in, camera, offline sync, demo walkthrough) into a CI job.
6. **Reporting depth.** Next: payroll export from attendance, SLA tracking (time from request to visit), and technician utilisation.
7. **Dependency advisories.** Backend: one moderate (`uuid` via `exceljs`, not reachable in the way we use it). Mobile: advisories are in build tooling only, nothing shipped to phones. Re-check monthly.
8. **Photos on local disk.** Fine for one server; move to object storage before running more than one API instance.
9. **Multi-company.** The system is single-company. If you will sell it to other ISPs, tenant isolation is the next architectural step.
