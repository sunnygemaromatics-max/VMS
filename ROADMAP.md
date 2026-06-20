# VMS Roadmap

Honest status of features in [the original product prompt](README.md). Updated when batches ship.

**Legend:** ✅ working · 🟡 partial / mocked · ❌ not built

## Live URLs

- Web dashboard — https://vms-web-theta.vercel.app
- Kiosk — https://vms-kiosk-seven.vercel.app
- API — https://vms-api-gxep.onrender.com
- Postgres — Neon
- Realtime — Socket.io on the API
- Android APK — built via EAS (see `apps/mobile/eas.json`)

Demo logins are provisioned directly in the deployment environment and should not be committed to source.

---

## Shipped

### Auth & users
- ✅ Real `/auth/login` + `/auth/register` against Neon (replaces mockLogin)
- ✅ Bcrypt-hashed passwords, JWT issued by NestJS
- 🟡 Roles in DB (7 of 10 from prompt). RBAC enforcement still permissive.

### Visitors
- ✅ Pre-register visit on web → generates QR token
- ✅ Visitor + visit creation via `POST /visitors` + `POST /visitors/visit`
- ✅ Kiosk + mobile check-in by QR token (`POST /gate/check-in`)
- ✅ Recent Visits panel on dashboard with auto-refresh
- 🟡 Status states (PENDING/APPROVED/CHECKED_IN/CHECKED_OUT/REJECTED/BLACKLISTED) in DB; only PENDING→CHECKED_IN via QR is wired

### Live headcount
- ✅ WebSocket gateway broadcasts on every check-in/check-out
- ✅ Counts: visitors (with company), employees (without company), workers (Attendance with no checkOut)
- 🟡 No per-branch / per-building / per-zone breakdown yet

### Contractors & workers
- ✅ Create contractor (company + GST)
- ✅ Create worker (contractor picker, doc, skill, medical expiry, police verified)
- ✅ Workers table with medical/police status indicators
- ✅ Compliance score per contractor (computed on read)

### Reports
- ✅ `/reports` page with five reports:
  - Visit log, Worker attendance, Compliance status, Contractor directory, Worker directory
- ✅ CSV export for each (no PDF/Excel — see below)

### Devops
- ✅ CI deployment via GitHub-connected Vercel + Render
- ✅ Neon Postgres (free)
- ✅ Upstash Redis URL configured in Render env (no code uses it yet)
- ✅ EAS Android build pipeline

---

## Not yet built (the rest of the prompt)

### Identity & visit management
- ❌ Visitor photo capture
- ❌ ID-proof file upload + storage
- ❌ Visitor badge printing
- ❌ NDA signing flow + digital signature capture
- ❌ Blacklist enforcement on check-in (field exists, not checked)
- ❌ Visitor live tracking inside premises
- ❌ Meeting-room allocation
- ❌ Emergency evacuation count export

### Workforce ops
- ❌ Worker replacement history (audit of swaps)
- ❌ Shift management
- ❌ Overtime tracking
- ❌ Zone-wise access control
- ❌ PF / ESIC tracking
- ❌ Contract expiry alerts (data is there; no scheduler)

### Face recognition
- ❌ Camera capture in any UI
- ❌ Real embedding pipeline (current `processFaceEntry` returns `Math.random()` — explicitly mocked)
- ❌ FaceAPI / TensorFlow / OpenCV not installed
- ❌ Unknown / duplicate face alerts

### Mobile app surface
- ✅ Kiosk-style check-in screen
- ❌ Employee approval queue
- ❌ Supervisor worker-onboarding flow
- ❌ Security incident reporting
- ❌ Push notifications
- ❌ Offline mode

### Notifications
- ❌ Email templates / SMTP / SendGrid
- ❌ SMS gateway
- ❌ WhatsApp Cloud API
- ❌ Push notifications

### Reports & analytics
- 🟡 Five CSV reports shipped
- ❌ PDF export
- ❌ Excel (xlsx) export
- ❌ Heatmaps
- ❌ Time-series charts
- ❌ AI anomaly detection (suspicious entry, duplicate identity, etc.)

### Vehicle / RFID
- 🟡 `vehicleNumber` field on Visit
- ❌ Vehicle model / parking allocation / RFID

### Compliance automation
- ✅ Per-contractor compliance score (read-time)
- ❌ Auto-alert on document/medical/police-cert expiry
- ❌ Safety-training records
- ❌ Insurance expiry

### Multi-tenant & isolation
- 🟡 `Organization` + `Branch` models exist
- ❌ Per-org query scoping (any logged-in user can see everything across orgs)
- ❌ Tenant switching UI for super admin

### Security hardening
- 🟡 JWT exists, dashboard endpoints are currently open
- ❌ Role-based guards re-applied to write endpoints
- ❌ MFA
- ❌ Session timeout enforcement
- ❌ Audit log table
- ❌ Rate limiting
- ❌ GDPR data-subject endpoints

### API quality
- ❌ Swagger / OpenAPI docs
- ❌ API versioning prefix
- ❌ DTO validation with class-validator (deps installed; not used)

### Hostinger / custom domain
- ✅ `vms.gemaromatics.com` and `aegis.gemaromatics.com` configured
- ✅ Gem Aromatics branding applied in app UI
- Note: hosting is currently Vercel + Render + Neon + Expo. Hostinger is used only for DNS.

---

## What an honest delivery path looks like

| Slice | Effort | Outcome |
|---|---|---|
| Custom domain + branding | done | `vms.gemaromatics.com` working, logo + name in UI |
| Re-enable RBAC + audit log | 1 day | Real role guards on writes; audit table populated |
| Camera capture + photo upload | 2 days | Visitor photos stored in S3-compatible bucket (Cloudflare R2 free) |
| Real face recognition (FaceAPI) | 1 week | Browser-side face matching; embeddings persisted |
| Notifications (Email + WhatsApp) | 3 days | Resend + Twilio integration |
| PDF/Excel exports | 1 day | server-side `pdfkit` + `exceljs` |
| Per-branch / zone headcount | 1 day | Branch dropdown on dashboard + zone field on Worker |
| Multi-tenant scoping | 2 days | Org-scoped middleware on every read |
| Mobile app for supervisors | 1 week | Add screens for worker onboarding + replacement |

If the customer signed off on this exact stack and timeline, I'd guess **6–8 weeks of one engineer's time** to make the full prompt real.
