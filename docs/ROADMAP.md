# Roadmap

## ✅ v1.0 (this release)
- Camera-only, challenge-bound proof photos with GPS and duplicate detection
- Daily check-in / check-out with dress-code checklist and supervisor review
- Job assignment, start/finish photos, durations, materials & amounts, verification
- Serial-level router chain of custody, two-party handover, custody cap, ageing alerts, stock counts, reconciliation
- Supervisor dashboard, team status, attendance register, stock ledger

## 🔜 v1.1 — recommended next steps
- **Push notifications** (Expo Notifications): new job assigned, stock issued, job rejected, late check-in alerts to supervisors
- **Offline queue** for jobs in areas with poor coverage (capture locally, sync with original server challenge)
- **Object storage**: swap the storage adapter to S3 / Cloudflare R2 with signed URLs
- **Excel/PDF exports** of attendance, jobs and reconciliation for payroll and audits
- **Customer sign-off** (signature or OTP sent to the customer's phone) on job completion

## 🔭 Later
- Face verification on check-in selfies (match against enrolled staff photo)
- Automated dress-code detection (vision model) to pre-screen photos
- Live technician map and route optimisation
- Web admin portal (React) re-using the same API
- M-Pesa integration for amounts collected
