# Optimas MS — API Reference

Base URL: `/api/v1` · All endpoints except `POST /auth/login` require `Authorization: Bearer <token>`.
Errors are returned as `{ "error": { "message", "code", "details?" } }`.

Roles: **T** technician · **K** storekeeper · **S** supervisor · **A** admin.

## Auth
| Method | Path | Who | Body / notes |
|---|---|---|---|
| POST | `/auth/login` | all | `{ identifier: staffNo \| email, password }` → `{ token, user }` |
| GET | `/auth/me` | all | current user |
| POST | `/auth/change-password` | all | `{ currentPassword, newPassword }` |

## Users
| GET | `/users?role=TECHNICIAN` | K S A | team list + today's attendance, open jobs, devices held |
|---|---|---|---|
| POST | `/users` | A | `{ staffNo, name, email?, phone?, role, region?, password }` |
| PATCH | `/users/:id` | A | any of the above + `active` |

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
| POST | `/tasks/:id/complete` | assignee | `{ photoId, notes, customerAccount?, amountCollected?, serials: string[], materials: [{ itemId, quantity, unitPrice? }] }` — installations require ≥1 serial |
| POST | `/tasks/:id/verify` | S A | `{ decision: VERIFIED \| REJECTED, note? }` |
| POST | `/tasks/:id/cancel` | S A | |

## Inventory
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/inventory/items` | all | catalogue with store / field quantities and low-stock flag |
| POST | `/inventory/items` | K S A | `{ sku, name, category, tracking: SERIALIZED \| BULK, unit, unitPrice, reorderLevel }` |
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
