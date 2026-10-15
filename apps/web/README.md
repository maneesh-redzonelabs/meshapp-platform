# MeshApp AI — Web Client

Production React web client for MeshApp AI, the Doctors Professional Partner (DPP) social/health
platform. Built with React 18 + TypeScript + Vite, React Router v6, TanStack Query, Tailwind CSS,
and `react-leaflet` for interactive clinic geolocation.

## Setup

```bash
# from the repo root (this app is an npm workspace member)
npm install

# build the shared types/enums package this app imports from
npm run build --workspace packages/shared

# copy env file and adjust if your API runs elsewhere
cp apps/web/.env.example apps/web/.env

# start the dev server
npm run dev --workspace apps/web
```

Or, from inside `apps/web` directly: `npm run dev`.

The app expects the API at `VITE_API_BASE_URL` (default `http://localhost:4000/v1`). If the API
isn't running yet, public screens (landing, login forms) still render; authenticated data screens
show a friendly error state with a "Try again" button instead of crashing.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server (hot reload) |
| `npm run build` | Type-check (`tsc -b`) then produce a static `dist/` bundle |
| `npm run preview` | Serve the built `dist/` bundle locally |
| `npm run lint` | Type-check only, no emit |

`npm run build` produces a static site suitable for Render's static site hosting — no server-side
code, just `dist/index.html` + hashed assets.

## Folder structure

```
src/
  lib/
    apiClient.ts      Typed fetch wrapper: attaches JWT, unwraps {success,data} envelope,
                       auto-retries once via refresh-token rotation on 401, throws ApiError/NetworkError.
    api.ts             One function per REST resource (auth, doctors, patients, appointments,
                       posts, network, communities, market, medico-legal, support, notifications,
                       compliance, uploads, search).
    queryClient.ts     TanStack Query client config.
  context/
    AuthContext.tsx    Session user + tokens (persisted to localStorage), login/logout.
    ToastContext.tsx   Slide-in toast notifications (success/error/info/warning).
  components/
    ui/                Modal, Button, Input/Select/Textarea, Card, Badge, Loading/Error/Empty states.
    layout/
      DashboardLayout.tsx  Responsive shell: persistent left sidebar on md+ screens, bottom tab
                           bar (+ "More" sheet for overflow items) on mobile. Shared by doctor and
                           patient dashboards via a navItems prop.
      NotificationBell.tsx Bell icon + dropdown list + mark-all-read.
    ComplianceGate.tsx  useComplianceScan() hook + ComplianceScanningOverlay / ComplianceBlockedDialog.
                       Implements the mandatory NMC content-compliance flow (see below).
    LocationPickerMap.tsx  react-leaflet map for picking clinic lat/lng (click-to-drop-pin).
    ProtectedRoute.tsx  Redirects to "/" if unauthenticated or wrong user_type.
  pages/
    Landing.tsx                     Role-selection tiles; non-doctor/patient roles show a
                                    "coming soon" toast.
    doctor/
      DoctorAuth.tsx                Mobile+email entry -> dual OTP -> onboarding (all one flow).
      DoctorOnboardingForm.tsx      Selfie upload, speciality/subspeciality cascading dropdowns,
                                    education, clinic location + Leaflet map, complete-profile call.
      ProfileTab.tsx                About, affiliations, achievements (+compliance scan), publications
                                    (+compliance scan), team invites, premium/NMC verification modal.
      NetworkTab.tsx                Category filter chips, search, accept/reject connections.
      FeedTab.tsx                   Compose modal (+compliance scan, visibility scope), like/comment.
      CommunityTab.tsx              List/create/join/leave communities.
      MarketplaceTab.tsx            Category/search, listing grid, create-listing modal
                                    (+compliance scan), contact-seller modal.
      MedicoLegalTab.tsx            Free-tier info card, ask-help modal, request list.
      HelpDeskTab.tsx                Chat UI calling the support bot endpoint.
    patient/
      PatientAuth.tsx               Profile fields + single mobile OTP.
      HomeTab.tsx                   PIN code + speciality filter chips, nearby doctor list.
      BookingFlow.tsx               Doctor summary -> family member + mode -> date + time slots
                                    -> payment summary + mock method select -> confirmation.
      AppointmentsTab.tsx           Upcoming/completed tabs, cancel, video-call stub modal,
                                    prescription modal.
      PatientProfileTab.tsx         Family members list + add-member modal.
  App.tsx              All routes.
  main.tsx             Providers: BrowserRouter, QueryClientProvider, ToastProvider, AuthProvider.
```

## Screens → API endpoints

| Screen | Endpoints |
| --- | --- |
| Landing | — (client-side only) |
| Doctor auth | `POST /auth/doctor/register/request-otp`, `/verify-mobile-otp`, `/verify-email-otp` |
| Doctor onboarding | `GET /search/specialities`, `/search/specialities/:id/subspecialities`, `POST /uploads/presign` + direct S3 PUT, `POST /auth/doctor/register/complete-profile` |
| Patient auth | `POST /auth/patient/register/request-otp`, `/verify-otp` |
| Doctor Profile/Home | `GET/PATCH /doctors/me`, `GET/POST/DELETE /doctors/me/affiliations`, `GET/POST /doctors/me/achievements` (+ `POST /compliance/scan`), `GET/POST /doctors/me/publications` (+ `POST /compliance/scan`), `POST /doctors/me/team-members`, `POST /doctors/me/verification-documents` |
| Doctor Network | `GET /network`, `POST /network/requests`, `PATCH /network/requests/:id/accept\|reject` |
| Doctor Feed | `GET /feed`, `POST /posts` (+ `POST /compliance/scan`), `POST/DELETE /posts/:id/likes`, `GET/POST /posts/:id/comments` |
| Doctor Community | `GET/POST /communities`, `POST /communities/:id/join`, `DELETE /communities/:id/leave` |
| Doctor Marketplace | `GET /market/listings`, `POST /market/listings` (+ `POST /compliance/scan`), `POST /market/listings/:id/inquiries` |
| Doctor Medico-Legal | `GET/POST /medico-legal/requests` |
| Doctor Help Desk | `POST /support/bot/query` |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |
| Patient Home | `GET /search/doctors`, `GET /search/specialities` |
| Patient Booking | `GET /doctors/:id` (+ `/locations`), `GET /patients/me/family-members`, `GET /doctors/:id/available-times`, `POST /appointments` |
| Patient Appointments | `GET /appointments`, `PATCH /appointments/:id/cancel`, `GET /appointments/:id/prescription` |
| Patient Profile | `GET/PATCH /patients/me`, `GET/POST /patients/me/family-members` |

## NMC content-compliance flow

Before creating a doctor achievement, publication, post, or marketplace listing, the client calls
`POST /compliance/scan` with `{content_type, text}`. If `verdict === 'passed'`, the returned
`scan_id` is sent as `compliance_scan_id` on the real create call. If blocked, a red dialog lists
every violation's category/excerpt/guidance (`ComplianceBlockedDialog` in
`src/components/ComplianceGate.tsx`) and the only path forward is editing the text and rescanning —
there is no override. This is implemented once via the `useComplianceScan()` hook and reused in
`ProfileTab` (achievements, publications), `FeedTab` (posts), and `MarketplaceTab` (listings).

## What's fully built vs. simplified

**Fully built:** role-selection landing with "coming soon" toast for out-of-scope roles; doctor
dual-OTP registration + mandatory onboarding (selfie upload, cascading speciality dropdowns,
graduation/PG education, Leaflet clinic map); patient single-OTP registration; responsive dashboard
shell (sidebar on `md+`, bottom tabs + "More" sheet on mobile) shared by both doctor and patient
apps; all 7 doctor tabs with their primary list + create-modal flows; the NMC compliance-scan gate
wired into every content-creation path the spec calls out; notifications bell with mark-all-read;
premium/NMC verification modal; patient home search, full booking flow (family member → mode →
date/slot → payment summary → mock payment method → confirmation), appointments (upcoming/completed,
cancel, prescription viewer, video-call stub), and family member management; a typed API client with
401 → refresh-token rotation → retry-once, and an `{success,data}`/`{success:false,error}` envelope
unwrapped into typed results or a thrown `ApiError`.

**Simplified / stubbed (flagged in-UI, not silently faked):**
- **Video calls** open a modal explaining that the real video SDK integration (Twilio/Agora token
  exchange) is out of scope for this pass; `POST /appointments/:id/video-session` is wired in
  `src/lib/api.ts` for whoever picks this up next.
- **Payment gateway**: booking calls the real `POST /appointments` and shows a mock payment-method
  selector (UPI/card/netbanking radio tiles) rather than embedding Razorpay/Stripe's client SDK —
  `POST /payments/:id/confirm` is implemented in the API client but not invoked from the UI yet,
  since that requires a real gateway checkout widget.
- **Reschedule** currently only exposes cancel from the appointments list; `appointmentsApi.reschedule`
  exists but isn't wired to a date/time picker UI yet.
- **MR / Paramedical / Medico Legal (as a role) / Supplier** are "coming soon" toasts per the brief —
  no screens were built for these roles.
- **Doctor "Your Team" members list** only exposes the invite input (matching
  `POST /doctors/me/team-members`); there's no GET-list-of-team-members endpoint in the spec to
  render an existing roster against, so none is rendered.
- Image/media attachment on posts and marketplace listings accepts text content only in this pass;
  the `media: [upload_ids]` field is typed in the API client but the compose/listing modals don't yet
  include a file picker for it (selfie upload in onboarding does use the real presign-and-PUT flow,
  so the pattern is proven and reusable for a follow-up).
- Admin screens (verification queue, audit log, moderation) are entirely out of scope per the brief
  and were not built.

## Deviations from the prototype and why

- The prototype is a fixed 420×860 "phone frame" simulator; this client is genuinely responsive
  instead — a persistent sidebar + multi-column grids replace the phone chrome on `md`/`lg`/`xl`
  breakpoints, while mobile gets the bottom tab bar the prototype visually implies. This was an
  explicit requirement, not an oversight.
- Doctor onboarding and the dual-OTP flow are kept as step-state inside one page component (not
  separate routes) so the short-lived registration token issued after OTP verification doesn't need
  to be threaded through route params/history — it lives in component state until
  `complete-profile` succeeds and real session tokens replace it.
- Where the API spec was ambiguous about exact response shapes for OTP verification (e.g. whether
  `registration_token` comes back from the mobile or email verify call), the client accepts it from
  either response and a `data.debug_otp`/`debug_otp_mobile`/`debug_otp_email` field for dev autofill,
  per the brief's guidance — this may need a one-line adjustment once the API's actual field names
  are finalized.

## Tech notes

- State: React Context for auth/session and toasts only; all server state goes through TanStack
  Query (cache keys mirror the resource — `['doctor', id]`, `['feed']`, `['appointments', tab]`, etc.).
- Forms are plain controlled components (no `react-hook-form`) for consistency and to keep the
  dependency footprint small — every form in the app follows the same `useState` + inline validation
  pattern.
- `@meshapp/shared` (the workspace package with enums/types/error codes) must be built
  (`npm run build --workspace packages/shared`) before `apps/web` type-checks, since it's consumed
  as compiled `dist/` output, not source.
