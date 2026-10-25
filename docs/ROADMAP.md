# Roadmap

## ✅ v1.0 (this release)
- Camera-only, challenge-bound proof photos with GPS and duplicate detection
- Daily check-in / check-out with dress-code checklist and supervisor review
- Job assignment, start/finish photos, durations, materials & amounts, verification
- Serial-level router chain of custody, two-party handover, custody cap, ageing alerts, stock counts, reconciliation
- Supervisor dashboard, team status, attendance register, stock ledger

## ✅ v1.1 — Phase 2 (this release)
- Push notifications + in-app inbox for technicians and supervisors
- Customer signature sign-off on job completion
- Excel exports: attendance & payroll summary, jobs & materials, reconciliation & device locations
- Self-hosted production stack for the Proxmox server (Docker Compose, Caddy HTTPS, backups/restore, hardening)
- Manager web console served from the same server; login rate limiting

## 🔜 v1.2 — recommended next steps
- **Offline queue** for jobs in areas with poor coverage (server-signed capture tokens issued in advance)
- **SMS** (Africa's Talking) — job-done OTP / receipt to the customer, SMS fallback for critical alerts
- **Admin user management screens** (create/deactivate staff, catalogue editing) in the app
- **Off-site backup sync** (Proxmox Backup Server or rsync/S3) and uptime monitoring

## 🔭 Later
- Face verification on check-in selfies (match against enrolled staff photo)
- Automated dress-code detection (vision model) to pre-screen photos
- Live technician map and route optimisation
- Web admin portal (React) re-using the same API
- M-Pesa integration for amounts collected
