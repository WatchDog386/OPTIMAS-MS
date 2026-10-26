# Optimas MS — API Reference

Base URL: `/api/v1` · All endpoints except `POST /auth/login` require `Authorization: Bearer <token>`.
Errors are returned as `{ "error": { "message", "code", "details?" } }`.

Roles: **T** technician · **K** storekeeper · **S** supervisor · **A** admin.

## Auth
| Method | Path | Who | Body / notes |
|---|---|---|---|
| POST | `/auth/login` | all | `{ identifier: staffNo \| email, password }` → `{ token, user }` |
| GET | `/auth/me` | all | current user |
| POST | `/auth/change-password` | all | `{ currentPassword, newPassword }` — min 8 chars with a letter and a digit, must differ; clears `mustChangePassword` |

Deactivated accounts cannot sign in. `user.mustChangePassword` is `true` after an admin creates or resets an
account; the app forces the password-change screen until it is cleared.

## Users
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/users?role=&q=&active=` | K S A | team list + today's attendance, open jobs, devices held. Customers only for S A |
| GET | `/users/:id` | S A | profile: 30-day attendance and job stats, recent jobs, devices / materials in custody, last stock count |
| POST | `/users` | S A | `{ staffNo, name, email?, phone?, role, region?, password?, customerAccount?, address? }` — no password → a one-time temporary password is returned as `temporaryPassword`. Customers sign in with `customerAccount`. Supervisors cannot create admins |
| PATCH | `/users/:id` | S A | profile fields, `role`, `active`. Refuses: changing your own role or deactivating yourself, removing the last active admin, deactivating someone still holding devices (`HOLDS_DEVICES`), converting staff ↔ customer |
| POST | `/users/:id/reset-password` | S A | → `{ temporaryPassword }`; the user must set a new one at next sign-in |

## Search & audit
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/search?q=` | staff | jobs, devices, people (store roles+), customers & requests (S A). Technicians only see their own jobs and devices |
| GET | `/audit?entity=&entityId=&before=&limit=` | A | append-only audit trail: user created/updated/password reset, item changes, stock adjustments, lost devices, job cancel/reassign/verify, request closed |

## Photo capture (camera-only proof)
| Method | Path | Who | Body / notes |
|---|---|---|---|
| POST | `/capture/challenge` | all | `{ purpose: CHECK_IN \| CHECK_OUT \| TASK_START \| TASK_END, taskId? }` → `{ challengeId, nonce, expiresAt }` (90 s, single use) |
| POST | `/capture/upload` | all | multipart: `photo` (JPEG), `challengeId`, `nonce`, `lat?`, `lng?`, `accuracyM?`, `deviceId?`, `deviceTime?` → `{ photoId, flags[] }` |
| GET | `/capture/photos/:id` | owner, K S A | streams the image |

Rejections: `CHALLENGE_EXPIRED`, `CHALLENGE_USED`, `INVALID_IMAGE`, `DUPLICATE_PHOTO`.
Flags: `NO_LOCATION`, `LOW_GPS_ACCURACY`, `OUTSIDE_GEOFENCE`, `DEVICE_CLOCK_SKEW`.
A `photoId` must be used by its action within 10 minutes, once.

## Attendance
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/attendance/today` | all | today's record, shift start, custody summary |
| POST | `/attendance/check-in` | all | `{ photoId, checklist: { uniform, idBadge, safetyBoots, groomed } }` (all must be `true`) |
| POST | `/attendance/check-out` | all | `{ photoId }` → record + custody summary |
| GET | `/attendance/history` | all | last 60 days |
| GET | `/attendance?date=YYYY-MM-DD` | S A | daily register + absent list |
| GET | `/attendance/reviews/pending` | S A | dress-code review queue |
| POST | `/attendance/:id/review` | S A | `{ decision: APPROVED \| REJECTED, note? }` |

## Tasks (jobs)
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/tasks?status=A,B&assigneeId=` | all | technicians only see their own |
| GET | `/tasks/:id` | assignee, K S A | includes photos & materials |
| POST | `/tasks` | S A | `{ title, type, priority?, customerName, customerPhone?, customerAccount?, address, lat?, lng?, dueAt?, assigneeId, description? }` |
| PATCH | `/tasks/:id` | S A | edit / reassign (only while `ASSIGNED`) |
| POST | `/tasks/:id/start` | assignee | `{ photoId }` — must be checked in, one job in progress at a time |
| POST | `/tasks/:id/complete` | assignee | `{ photoId, notes, customerAccount?, amountCollected?, serials: string[], materials: [{ itemId, quantity, unitPrice? }], signature?: { path, signedBy } }` — installations require ≥1 serial **and** a customer signature (`path` = SVG path data on a 300×150 canvas) |
| POST | `/tasks/:id/verify` | S A | `{ decision: VERIFIED \| REJECTED, note? }` |
| POST | `/tasks/:id/cancel` | S A | |

## Inventory
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/inventory/items` | all | catalogue with store / field quantities and low-stock flag |
| POST | `/inventory/items` | K S A | `{ sku, name, category, tracking: SERIALIZED \| BULK, unit, unitPrice, reorderLevel }` |
| PATCH | `/inventory/items/:id` | K S A | `{ name?, unit?, unitPrice?, reorderLevel?, active? }` — cannot archive while stock is in the field (`ITEM_IN_FIELD`) |
| POST | `/inventory/adjust` | K S A | `{ itemId, quantity: ±n, reason }` — bulk items only, store stock cannot go negative; written to the ledger as `ADJUST` |
| POST | `/inventory/receive` | K S A | `{ itemId, serials?: [{ serialNumber, macAddress? }], quantity?, note? }` |
| POST | `/inventory/issue` | K S A | `{ userId, serials?: string[], itemId?, quantity?, note? }` — enforces custody cap |
| POST | `/inventory/return` | K S A | `{ userId, serials?, itemId?, quantity?, condition: GOOD \| FAULTY, note? }` |
| POST | `/inventory/report-lost` | K S A | `{ serialNumber, note }` |
| GET | `/inventory/my` | all | pending acceptance, devices in hand (days held), materials, last count |
| POST | `/inventory/accept` | all | `{ unitIds? }` — confirm receipt (all pending if omitted) |
| POST | `/inventory/stock-count` | all | `{ serials: string[] }` → expected / missing / unexpected |
| GET | `/inventory/units?status=&holderId=&q=` | K S A | device search |
| GET | `/inventory/units/:serial/history` | K S A | chain of custody |
| GET | `/inventory/movements?limit=` | K S A | ledger |
| GET | `/inventory/reconciliation` | K S A | per-technician accountability report |

## Reports
| GET | `/reports/dashboard` | K S A | supervisor dashboard numbers |
|---|---|---|---|
| GET | `/reports/me` | all | technician's monthly stats |

## Notifications
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/notifications` | all | latest 100 + `unread` count |
| GET | `/notifications/unread-count` | all | `{ unread }` |
| POST | `/notifications/read` | all | `{ ids? }` — mark given (or all) as read |
| POST | `/notifications/push-token` | all | `{ token: "ExponentPushToken[…]", platform? }` — register this device |
| DELETE | `/notifications/push-token` | all | `{ token }` — on sign-out |

Types: `TASK_ASSIGNED`, `TASK_COMPLETED`, `TASK_VERIFIED`, `TASK_REJECTED`, `TASK_CANCELLED`, `STOCK_ISSUED`,
`DRESS_REJECTED`, `LATE_CHECK_IN`, `PHOTO_FLAGGED`, `STOCK_COUNT_MISMATCH`, `UNIT_LOST`.

## Exports (Excel)
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/exports/attendance.xlsx?from=YYYY-MM-DD&to=YYYY-MM-DD` | K S A | sheets: Attendance, Summary (payroll) |
| GET | `/exports/jobs.xlsx?from=&to=` | K S A | sheets: Jobs, Materials |
| GET | `/exports/reconciliation.xlsx` | K S A | sheets: Reconciliation, Devices |

Defaults to the last 30 days; at most one year per export. `POST /auth/login` is rate-limited (10 attempts / 15 min / IP by default).

## Customer portal (role `CUSTOMER` only)
| Method | Path | Notes |
|---|---|---|
| GET | `/customer/overview` | account, active visits (with technician name & phone), past visits, installed devices, requests, support contacts |
| GET | `/customer/jobs/:id` | one visit on the customer's own account (404 otherwise) |
| POST | `/customer/requests` | `{ type: REPAIR \| RELOCATION \| INSTALLATION \| MAINTENANCE, description, phone?, address? }` — notifies supervisors |
| GET | `/customer/requests` | the customer's requests with linked job |

Customers are refused (403) on every staff endpoint (`/users`, `/capture`, `/attendance`, `/tasks`, `/inventory`, `/reports`, `/exports`).

## Customer requests (supervisors / admins)
| Method | Path | Notes |
|---|---|---|
| GET | `/requests?status=OPEN\|SCHEDULED\|CLOSED` | inbox |
| POST | `/requests/:id/close` | `{ note }` — the customer is notified |
| POST | `/tasks` with `requestId` | turns a request into a job (request → `SCHEDULED`; a cancelled job reopens it) |

Customers receive `JOB_UPDATE` notifications when a technician is assigned, starts, and completes their job.
