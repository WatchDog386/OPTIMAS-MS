# Optimas MS — Architecture & Design

Optimas MS (Management System) is the field-workforce platform for **Optimas**, an
internet service provider. It replaces paper sign-in sheets, WhatsApp job updates and
spreadsheet stock books with one auditable system.

## 1. Problems we are solving

| # | Management problem | How Optimas MS solves it |
|---|---|---|
| 1 | No reliable record of who reported to work, and when | Daily **check-in / check-out** with a live selfie, GPS and server timestamp |
| 2 | Staff reporting in improper attire | Check-in selfie + dress-code checklist, reviewed in the **Dress Compliance queue** by supervisors |
| 3 | Gallery / old / forwarded photos used as "proof" | **Camera-only capture** with a server-issued, single-use, 90-second **capture challenge**; duplicate-image hash detection |
| 4 | No proof that a job was really done, nor how long it took | Mandatory **start-of-task** and **end-of-task** photos; start/stop timestamps produce the job duration |
| 5 | Materials consumed on jobs not reported | Task completion requires a **materials report** (item, quantity, amount) |
| 6 | **Routers issued but not accounted for** | Serial-level **chain of custody** (see §4) |

## 2. System overview

```
┌────────────────────────┐        HTTPS / JSON + multipart        ┌──────────────────────────┐
│  Optimas MS Mobile     │ ─────────────────────────────────────▶ │  Optimas MS API          │
│  (Expo / React Native) │                                        │  (Node + Express + TS)   │
│                        │ ◀───────────────────────────────────── │                          │
│  • Technician app      │                                        │  • Auth (JWT, roles)     │
│  • Supervisor console  │                                        │  • Capture verification  │
│  • Camera-only capture │                                        │  • Attendance            │
│  • Barcode scanning    │                                        │  • Tasks & materials     │
└────────────────────────┘                                        │  • Inventory ledger      │
                                                                  │  • Reports               │
                                                                  └───────┬──────────┬───────┘
                                                                          │          │
                                                               PostgreSQL (Prisma)  Photo storage
                                                                                    (disk → S3-ready)
```

### Tech stack

| Layer | Choice | Why |
|---|---|---|
| Mobile | Expo SDK 52, React Native, TypeScript, expo-router | One codebase for Android & iOS, OTA updates, first-class camera/location APIs |
| UI | Custom design system (Plus Jakarta Sans, dark navy + electric-green palette) | Inspired by the Spiro Swap app: bold numbers, rounded cards, high-contrast CTAs |
| State | Zustand + AsyncStorage/SecureStore | Small, predictable, no boilerplate |
| API | Node.js 20+, Express, Zod validation | Simple, well-understood, easy to hire for |
| ORM / DB | Prisma + PostgreSQL 16 | Strong typing, migrations, transactional stock ledger |
| Auth | JWT (Bearer) + bcrypt | Stateless, mobile-friendly |
| Files | Local disk via a storage adapter (swap to S3/R2 in production) | Zero-cost to start |

## 3. Roles

| Role | Can do |
|---|---|
| `TECHNICIAN` | Check in/out, view & execute assigned tasks, accept issued stock, report materials, run stock counts |
| `STOREKEEPER` | Manage catalogue, receive stock, issue/receive returns, see reconciliation |
| `SUPERVISOR` | Everything a storekeeper can + create/assign/verify tasks, review dress compliance, see team |
| `ADMIN` | Everything + manage users |

## 4. Router accountability — the chain of custody

Routers and ONTs are **serialised** items: every physical unit is a row (`SerialUnit`) with
a unique serial number, and every change of hands is an **immutable ledger entry**
(`StockMovement`). Bulk items (cable in metres, connectors, clips) are tracked by quantity
per holder.

```
 RECEIVE            ISSUE                 ACCEPT                  INSTALL (on a task)
Supplier ──▶ [IN_STORE] ──▶ [IN_TRANSIT] ──▶ [WITH_TECHNICIAN] ──▶ [INSTALLED @ customer acct]
                 ▲                                 │
                 │           RETURN                │  REPORT LOST / FAULTY
                 └──────── [IN_STORE] ◀────────────┴──▶ [LOST] / [FAULTY]
```

Controls that close the loophole:

1. **Two-party handover** — an issued router sits `IN_TRANSIT` until the technician
   accepts it in-app. Nobody can later claim "I never received it".
2. **Install by scan** — a router can only leave a technician's custody by scanning its
   serial on a task. The serial must be in *that* technician's custody. The unit is bound
   to the customer account, task and completion photo.
3. **Custody cap** — a technician cannot hold more than `MAX_ROUTERS_IN_CUSTODY`
   un-installed routers; the store cannot issue more until older ones are installed or returned.
4. **Ageing alerts** — units held longer than `CUSTODY_AGE_ALERT_DAYS` are flagged
   on the dashboard and in the reconciliation report.
5. **Spot stock counts** — a technician scans every router they physically hold; the
   system compares against the ledger and records missing/unexpected serials.
6. **Reconciliation report** — per technician: issued, installed, returned, lost, still in
   hand, overdue; bulk: issued vs. consumed vs. returned vs. balance.
7. **Check-out reminder** — the evening check-out shows the technician everything still
   in their custody.

## 5. Photo integrity (no uploads from gallery)

1. Client asks `POST /capture/challenge { purpose }` → server returns a random `nonce`
   valid for **90 s**, single use, bound to the user and purpose.
2. App opens the in-app camera (there is **no** gallery picker anywhere in the app).
3. App uploads the JPEG with `challengeId`, `nonce`, GPS, accuracy and device id.
4. Server verifies: challenge owner, purpose, not expired, not reused, real JPEG (magic
   bytes), size limits, and **SHA-256 not seen before** (a re-sent photo is rejected).
5. Server records its own `receivedAt` timestamp (device clocks are not trusted), raises
   flags such as `LOW_GPS_ACCURACY`, `NO_LOCATION`, `OUTSIDE_GEOFENCE`, and returns a
   `photoId`.
6. The action (`check-in`, `task start`, ...) consumes the `photoId` once.

## 6. Data model (summary)

`User` · `CaptureChallenge` · `Photo` · `Attendance` · `Task` · `TaskMaterial` ·
`InventoryItem` · `SerialUnit` · `BulkHolding` · `StockMovement` · `StockCount`

See `backend/prisma/schema.prisma` for the source of truth.

## 7. Repository layout

```
OPTIMAS-MS/
├── docs/                 Architecture, API reference, roadmap
├── backend/              REST API
│   ├── prisma/           schema.prisma + seed
│   └── src/
│       ├── config/       env parsing
│       ├── lib/          prisma client, jwt, storage, geo, http errors
│       ├── middleware/   auth, validation, error handling
│       └── modules/      auth · users · capture · attendance · tasks · inventory · reports
└── mobile/               Expo app
    ├── app/              expo-router screens ((auth), (tech), (admin), task, capture …)
    └── src/
        ├── theme/        colours, typography, spacing
        ├── components/   design-system components
        ├── api/          typed API client
        ├── store/        auth & session state
        └── utils/        formatting helpers
```
