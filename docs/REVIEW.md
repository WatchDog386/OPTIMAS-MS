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

Backend suite: 39 tests pass (34 before this pass).

## Still open — highest value first

1. **Offline-first field work.** A technician in a basement with no signal can't start or finish a job: the photo challenge and upload need the network. Queue the actions on the phone and sync when the signal returns. This is the single biggest gap for a field-operations product.
2. **Off-site backups.** The nightly database dump and photo archive stay on the same server. Add a copy to another place (cloud bucket or second machine) and test a restore monthly.
3. **Monitoring and alerts.** Nothing tells you at 2 am that the site is down or the disk is full. Add an uptime check on `/health` and a disk/backup-age alert; add error reporting for the app.
4. **Session hygiene.** A password change doesn't sign out other devices, and the web app keeps its token in the browser's local storage (normal for a PWA, but a stolen phone stays signed in until the token expires). Add a "sign out everywhere" and shorter tokens with refresh.
5. **Push notifications on the web app.** Alerts only arrive while the app is open (polling). Web push would make "job assigned" instant.
6. **End-to-end tests of the screens.** The API is well tested; the app has typechecking only. A handful of browser tests for sign-in, check-in, job completion and the demo walkthrough would catch regressions.
7. **Reporting depth.** Insights now cover jobs, cash, attendance, stock and ratings. Next: payroll export from attendance, SLA tracking (time from request to visit), and technician utilisation.
8. **Dependency advisories.** Backend: one moderate (`uuid` via `exceljs`, not reachable in the way we use it). Mobile: advisories are in build tooling only, nothing shipped to phones. Re-check monthly.
9. **Photos on local disk.** Fine for one server; move to object storage before running more than one API instance.
10. **Multi-company.** The system is single-company. If you will sell it to other ISPs, tenant isolation is the next architectural step.
