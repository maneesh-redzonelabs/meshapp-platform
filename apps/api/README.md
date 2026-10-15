# MeshApp API

Production-style REST backend for **MeshApp AI** — the Doctors Professional Partner (DPP)
social/health platform. Implements `MeshApp-API-Specification.html` against the Postgres +
PostGIS schema in `meshapp-create-db.sql`.

## Quick start

```bash
# from the monorepo root
npm install

cd apps/api
cp .env.example .env     # edit DATABASE_URL (and secrets) for your local Postgres
npx prisma generate
npm run dev               # tsx watch — starts on http://localhost:4000

# in another terminal, once the server is up:
npm run seed:demo         # creates demo doctors/patients/posts/appointment
```

- `npm run dev` — start the API with hot reload (tsx watch), against the live DB.
- `npm run build` — `tsc` compile to `dist/` (zero errors).
- `npm start` — run the compiled build.
- `npm run seed:demo` — idempotent demo data seed (see below).
- `npm run prisma:pull` — re-introspect `prisma/schema.prisma` from the DB (never `prisma migrate`;
  the schema is hand-authored SQL with triggers/partitions/RLS that Prisma can't fully express).

`GET /v1/health` requires no auth and returns `{status:"ok"}`.

## Environment variables

See `.env.example` for the full annotated list. The important ones:

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string, `?schema=meshapp` (Prisma `multiSchema`, reads `meshapp` + `public`) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | HS256 signing secrets (see "Auth" below for the production upgrade path) |
| `MOCK_OTP_EXPOSE` | Dev-only: when `true` **and** `NODE_ENV=development`, OTP responses include `data.debug_otp` with the plaintext code. Forced off otherwise — see `src/config/env.ts`. |
| `UPLOADS_DIR` / `UPLOAD_BASE_URL` | Local-disk file storage substitute for S3 |
| `PLATFORM_SERVICE_FEE` | Flat per-appointment platform fee (₹49 default, matches the prototype) |
| `RATE_LIMIT_*` | Tunable for local testing — see "Rate limiting" below |

Secrets live only in the gitignored `.env`. Logs are redacted (`src/lib/logger.ts`) so the DB
password, JWT secrets, tokens, and OTP hashes never appear in server output.

## Architecture / folder layout

```
src/
  app.ts, server.ts        Express app assembly + process bootstrap
  config/env.ts             Typed env loading/validation (fails fast on missing required vars)
  lib/
    prisma.ts                Prisma client singleton
    jwt.ts                   Access/refresh/registration token signing+verification
    crypto.ts                Argon2 hashing, SHA-256, OTP generation
    apiError.ts              ApiError — single source of truth for the error envelope
    response.ts              ok()/created() — success envelope helpers
    rbac.ts                  Role derivation (user_type + tier/admin_role) + permission map
    geo.ts                   Raw-SQL helpers for the Unsupported("geography") columns
  middleware/
    authenticate.ts           Verifies JWT + live session + account status
    rbac.ts                    requireRole / requirePermission / requireOwnership / auditLog
    rateLimit.ts               express-rate-limit tiers per the spec's §Rate Limits table
    idempotency.ts             Idempotency-Key dedupe (in-memory)
    validate.ts                Zod body/query/param validation
    errorHandler.ts            Converts any thrown error into the standard envelope
  modules/<domain>/           One folder per API module (see mapping table below)
prisma/schema.prisma          Introspected from the live DB (`prisma db pull`), hand-fixed where noted
scripts/seed-demo.ts          Demo data seed
uploads/                      Local file storage (gitignored content, dir tracked)
```

### Request lifecycle / middleware chain

Every protected route composes the same chain the spec's Security Architecture section
describes, e.g. (`src/modules/appointments/appointments.routes.ts`):

```ts
router.post('/',
  authenticate(),                 // verifies JWT + session is still active (supports forced logout)
  requireRole(['patient']),       // user_type gate
  appointmentCreateLimiter,       // 10/min per spec
  idempotencyKey(),               // Idempotency-Key dedupe for payment/booking POSTs
  validateBody(createAppointmentSchema),
  asyncHandler(async (req, res) => { ... }),
);
```

- **authenticate()** — verifies the JWT signature/expiry, then re-checks the referenced
  `user_sessions` row is still `is_active` (this is what makes "logout everywhere" actually
  invalidate already-issued access tokens without needing Redis — see "Deviations" below),
  and checks the user isn't locked/deleted/inactive.
- **requireRole(allowed)** — checks `req.authUser.userType`.
- **requirePermission(name)** — checks a resource:action permission map (`src/lib/rbac.ts`)
  derived from `user_type` + doctor `subscription_tier` + `platform_admins.admin_role`.
- **requireOwnership(resourceLookup)** — defense-in-depth: re-verifies at the application tier
  that the caller owns the resource, independent of Postgres RLS (used directly in a few
  routes; most routes inline the equivalent check since the "lookup" step and the route's own
  query are the same call — see `loadOwnedAppointment` in `appointments.routes.ts` for the
  pattern).
- **auditLog(action, entityType)** — fires after a successful response, writing to
  `user_audit_log` without blocking the response.

## API module → endpoint mapping

| Module (file) | Mounted at | Implements |
|---|---|---|
| `modules/auth` | `/v1/auth` | Dual-OTP doctor registration, single-OTP patient registration, OTP/password login, refresh rotation + reuse detection, logout/logout-all, sessions, password reset/change |
| `modules/uploads` | `/v1/uploads` | Local-disk presign substitute for S3 |
| `modules/doctors` | `/v1/doctors` | Profile, education, affiliations, achievements/publications (compliance-gated), clinic locations, availability, blocked dates, computed available-times, verification documents |
| `modules/patients` | `/v1/patients` | Profile, addresses, family members, prescriptions list |
| `modules/appointments` | `/v1/appointments` | Booking (transactional, advisory-lock double-booking guard), confirm/cancel/reschedule/complete/no-show, video sessions (stub), prescriptions |
| `modules/compliance` | `/v1/compliance`, `/v1/admin/compliance` | `/scan`, `/scans/:id`, admin rule CRUD, scan audit log |
| `modules/social` | `/v1` (`/feed`, `/posts/*`, `/network/*`, `/communities/*`) | Feed, posts/likes/comments (compliance-gated), network connections, communities |
| `modules/marketplace` | `/v1/market` | Listings (compliance-gated), media, inquiries, categories |
| `modules/medicoLegal` | `/v1/medico-legal` | Requests, expert assignment, consultations (free-tier minute tracking), resolution |
| `modules/notifications` | `/v1/notifications` | Cursor-paginated inbox, mark read/read-all |
| `modules/support` | `/v1/support` | Tickets, chat messages, keyword-matching bot with escalation |
| `modules/subscriptions` | `/v1/subscriptions` | Plans, subscribe (creates pending payment), cancel |
| `modules/payments` | `/v1/payments` | Mock confirm (always succeeds), history, admin refund |
| `modules/admin` | `/v1/admin` | Verification queue approve/reject, user lock/unlock, audit log, post takedown |
| `modules/search` | `/v1/search` | Doctor geo-search (`ST_DWithin`/`ST_Distance`), specialities/subspecialities |
| `modules/otherRoles` | `/v1/mr`, `/v1/paramedical`, `/v1/suppliers` | Profile read/update for the remaining user types |
| `modules/webhooks` | `/v1/webhooks` | Stub receivers (see "Mock vs real" below) |

## Content-compliance enforcement design

`POST /v1/compliance/scan` evaluates the submitted `text` against every active row in
`content_compliance_rules` as a **JS `RegExp`** (the rules were authored to be regex-compatible),
writes an immutable row to `content_compliance_scans`, and returns a verdict. Matching the
prototype's own gating logic and the spec, **any** match — `block` or `warn` severity — is
treated as a hard stop; there is no soft-allow path.

The four gated creation endpoints (`doctor_achievements`, `doctor_publications`, `posts`,
`equipment_listings`) all call `assertPassedScan()` (`src/modules/compliance/compliance.service.ts`)
before insert, which independently re-verifies:
1. the scan belongs to the calling user,
2. the scan's `entity_type` matches the endpoint,
3. **the scanned text matches byte-for-byte** the text about to be persisted (so a client can't
   scan innocuous text and then submit something else under the same `scan_id`),
4. the verdict is `passed`,
5. the scan is less than 15 minutes old (spec's recommended validity window).

This is defense-in-depth on top of (not a replacement for) the DB-level trigger
`fn_require_passed_compliance_scan`, which independently blocks any INSERT/UPDATE on those four
tables unless `compliance_scan_id` references a `passed` scan — verified directly against the
live DB during development (a raw attempt to reuse a `blocked` scan's id is rejected with a 4xx
from the API layer before it would even reach the DB trigger).

## Mock vs. real integration points

| Concern | This build (dev) | Production swap-out |
|---|---|---|
| OTP delivery | Generates a real 4-digit code, Argon2-hashes it into `otp_verifications`, logs it to console. Returns `data.debug_otp` **only** when `MOCK_OTP_EXPOSE=true` and `NODE_ENV=development` (forced off otherwise, see `src/config/env.ts`) | Wire `issueOtp()` in `src/modules/auth/otp.service.ts` to a real SMS/email provider (Twilio/MSG91/SES) |
| File storage | `POST /uploads/presign` issues a one-time in-memory ticket + a local URL; the client `PUT`s bytes to `/uploads/_put/:upload_id`, written under `apps/api/uploads/`; served back via `express.static('/uploads')` | Replace `src/modules/uploads/*` with real S3 presigned POST/PUT URLs; never proxy file bytes through the API process |
| Payments | `POST /payments/:id/confirm` always succeeds immediately; no gateway call | Verify the gateway's HMAC signature server-side before trusting success (never trust client-reported success alone); also handle the gateway's signed webhook as an idempotent alternate confirmation path (`modules/webhooks`) |
| Video calls | `POST /appointments/:id/video-session` generates a random hex "room token"; join/end timestamps and duration are tracked for real | Call a real SDK (Twilio Video/Agora) server-side to mint a short-TTL room token |
| JWT signing | HS256 with a shared secret in `.env` | RS256 with KMS-managed asymmetric keys + rotation |
| Admin 2FA step-up | Not implemented — `requirePermission()` + role checks are the enforced control in this dev build | `requireAdmin2FA()` middleware checking a short-lived TOTP step-up claim, mandatory before any admin mutation |
| PII/PHI encryption | Phone/email/diagnosis/etc. stored as plaintext in this dev build (see "Deviations") | AES-256-GCM envelope encryption via KMS before persisting; decrypt only for authorized callers |
| Rate limit store | In-memory (`express-rate-limit` default store) — per-process only | Redis-backed store so limits are shared across horizontally scaled instances |
| Idempotency-Key store | In-memory `Map` with TTL | Redis, so it survives restarts and works across instances |
| Session revocation | Checked synchronously against `user_sessions.is_active` on every request | Spec recommends a Redis denylist keyed on `session_id` for sub-millisecond revocation checks at higher scale; the DB check used here is correct but adds one query per request |

## Known deviations from the spec (and why)

- **HS256 instead of RS256** — explicitly allowed by the build brief for this environment;
  documented above as the production upgrade path.
- **No field-level AES-256 encryption** of phone/email/diagnosis/etc. — the schema's own
  comments mark these as "encrypted at application layer", but implementing real envelope
  encryption + KMS key management for every PII/PHI column would have made every unique
  constraint, login lookup, and search query substantially more complex for a dev build whose
  goal is a working, testable API. Flagged clearly here and in inline code comments; this is the
  single biggest gap before any production/PHI-bearing deployment.
- **`requireAdmin2FA()` is not implemented** — no real TOTP flow exists in this build. Admin
  mutations are gated by `requirePermission()` role checks and write to `admin_actions_log`,
  but the spec's mandatory 2FA step-up is not enforced. Documented as a required addition before
  production.
- **Profile completeness percentage** — the prototype has no such calculation at all. This build
  defines it as 8 equally-weighted sections (selfie, bio, education, affiliations, clinic
  location, availability, achievements-or-publications, an approved verification document) —
  see `src/modules/doctors/profileCompleteness.ts`. A product/design call, not a spec quote.
- **Flat ₹49 platform service fee** on every appointment, matching the exact hardcoded value in
  `doctor-patient-v-1.0.html`'s booking flow rather than inventing a percentage-based fee the
  spec never specifies. Configurable via `PLATFORM_SERVICE_FEE`.
- **Idempotency-Key semantics** are inferred (the spec doesn't fully define them) — applied to
  `POST /appointments` and `POST /payments/:id/confirm`, keyed per `(user, method, path, header
  value)`, TTL `IDEMPOTENCY_TTL_MINUTES` (default 60), replays return the original response with
  an `Idempotent-Replayed: true` header.
- **Admin moderation queue** (`GET /admin/moderation/posts`) — the base schema has no
  "reported"/flag table, so this surfaces the most recent active posts for manual review rather
  than a true reports queue. A `post_reports` table would be the real fix (out of scope: schema
  is frozen for this build).
- **OTP length/expiry** — not numerically specified by the spec; used 4 digits / 10 minutes /
  3 attempts (env-tunable via `OTP_LENGTH`, `OTP_TTL_MINUTES`, `OTP_MAX_ATTEMPTS`), matching the
  prototype's 4-digit OTP fields.
- **Webhooks are stubs** — since the payment gateway and video provider are themselves mocked in
  this build, there's no real external service to sign a callback; the routes exist and log
  their payload so the shape matches the spec, but do not verify a signature (there is none to
  verify against a mock gateway).

## Verified locally

During development this build was run against the live local Postgres instance and exercised
end-to-end (not just unit-level): patient single-OTP registration → login; doctor dual-OTP
registration (mobile+email independently gated) → profile completion (creates `doctors` +
`doctor_education` + `doctor_clinic_locations` with a real PostGIS-backed geolocation insert);
a compliance scan that blocks "best cardiologist" text and passes neutral text; achievement
creation gated on a passing scan, and a direct attempt to reuse the *blocked* scan's id was
correctly rejected; password login; and a geo-radius doctor search (`ST_DWithin`) that returned
a seeded doctor with a correct computed `distance_meters`. `npm run build` compiles with zero
TypeScript errors.

## What's fully implemented vs. lighter-weight

**Fully implemented with real logic:** auth (both registration flows, OTP+password login,
refresh rotation with reuse detection, logout/logout-all, sessions), the full RBAC middleware
chain, content compliance scanning + all four gated creation endpoints (DB-trigger-verified),
doctor profile/education/affiliations/locations/availability/blocked-dates/available-times/
verification docs, doctor geo-search, patient profile/addresses/family members, appointment
booking with advisory-lock double-booking prevention + fee snapshot + transactional payment
creation, confirm/cancel/reschedule/complete/no-show, video session stub with real join/end/
duration tracking, prescriptions, posts/feed/likes/comments with visibility-scope resolution,
network connections, communities, marketplace listings/media/inquiries, medico-legal
requests/consultations with free-tier minute tracking, notifications, support tickets + keyword
bot, subscriptions + mock payment confirm with real state-machine transitions, and the admin
verification/lock/audit-log/moderation endpoints.

**Thinner / stubbed by design (see "Mock vs real" table):** OTP/email delivery, file storage,
payment gateway, video SDK, admin 2FA, webhook signature verification, PII/PHI field encryption.

## Local dev notes

- Rate limits in `.env.example` are the spec's real numbers; lower them further for load testing
  if needed (e.g. `RATE_LIMIT_MAX_DEFAULT`).
- `prisma/schema.prisma` was generated via `prisma db pull` against the live schema and is
  otherwise untouched — the two geography columns are `Unsupported("geography")` as required;
  writes to them go through `src/lib/geo.ts`'s raw-SQL helpers (`$queryRaw`/`$executeRaw`),
  since Prisma Client does not generate a `.create()` method at all for a model with a
  *required* `Unsupported` column (confirmed while building this).
