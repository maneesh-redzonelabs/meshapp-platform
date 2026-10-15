# MeshApp AI — Mobile (Expo / React Native)

Mobile client for the MeshApp AI Doctors Professional Partner (DPP) platform,
covering the Doctor app and the Patient app. Built with Expo (SDK 51),
React Navigation (native-stack + bottom-tabs), and plain `StyleSheet`
(no NativeWind) in a purple/indigo medical theme matching
`doctor-patient-v-1.0.html`.

## Quick start

```bash
cd apps/mobile
npm install
cp .env.example .env     # then edit EXPO_PUBLIC_API_BASE_URL if needed
npx expo start
```

- Press `i` to open the iOS simulator, `a` for an Android emulator, or scan
  the QR code with **Expo Go** on a physical device.
- `npm run lint` runs ESLint (`eslint-config-universe/native`).
- `npm run android` / `npm run ios` / `npm run web` are shortcuts for
  `expo start --android` / `--ios` / `--web`.

Verified in this build: `npx tsc --noEmit` passes with zero errors, and
`npx expo export --platform ios` / `--platform android` both bundle the
full app successfully (1153 modules, no red-screen errors) without a
simulator attached.

## API base URL / the Android-emulator gotcha

The API base URL comes from Expo's built-in `EXPO_PUBLIC_*` env convention
(`process.env.EXPO_PUBLIC_API_BASE_URL`, read in `src/lib/apiClient.ts`),
defaulting to `http://localhost:4000/v1` if unset.

| Target                                   | `EXPO_PUBLIC_API_BASE_URL`              |
|-------------------------------------------|------------------------------------------|
| iOS Simulator (Mac)                       | `http://localhost:4000/v1`               |
| Android Emulator (AVD)                    | `http://10.0.2.2:4000/v1` — the emulator's special alias for the host machine's `localhost`; plain `localhost` inside the emulator refers to the emulator itself, not your dev machine |
| Physical device via Expo Go               | `http://<your-computer's-LAN-IP>:4000/v1` (e.g. `http://192.168.1.50:4000/v1`) — the phone and computer must be on the same Wi-Fi network |
| Production                                | `https://api.meshapp.ai/v1`              |

Edit `.env` (copied from `.env.example`) and restart with `npx expo start -c`
(the `-c` clears Metro's cache so the new env value is picked up).

## Metro / workspace resolution choice

**Chosen approach: duplicate the needed enum/type definitions** into
`src/types/shared.ts`, with a comment noting they're copied from
`packages/shared/src/{enums,types,errorCodes}.ts`.

Why, instead of wiring up `apps/mobile` as an npm workspace member with
`watchFolders` + `resolver.disableHierarchicalLookup`:
- This repo's root `package.json`/`apps/*` layout is being actively edited by
  other agents in parallel (API, web) right now; changing root workspace
  config or `packages/shared`'s build output format was out of scope and
  risked breaking their in-flight work.
- Expo SDK 51's Metro resolver is particular about `watchFolders` + symlinked
  or hoisted monorepo packages, especially on Windows (this environment),
  and is a common source of "works on my machine" Metro cache bugs across
  SDK upgrades.
- The actual surface area needed from `packages/shared` is small (a dozen
  enum unions + a dozen interfaces + the API envelope types) and changes
  rarely, so hand-syncing is a low-maintenance, zero-config-risk tradeoff.

Tradeoff accepted: if `packages/shared/src/enums.ts` or `types.ts` change,
`src/types/shared.ts` must be updated by hand. The file's header comment
flags this explicitly.

`metro.config.js` is therefore the vanilla `getDefaultConfig()` output with
no `watchFolders` changes, and `apps/mobile` is **not** listed as a
workspace member in the repo root `package.json`.

## What's fully built

- **Role selection** — Doctor / Patient tiles; other roles show a
  "Coming soon" alert, matching the prototype's behavior.
- **Doctor auth** — dual OTP (mobile + email) registration
  (`/auth/doctor/register/request-otp` → `verify-mobile-otp` →
  `verify-email-otp` → onboarding) and mobile-OTP login
  (`/auth/login/request-otp` → `/auth/login/verify-otp`). If a response
  includes a `debug_otp`-shaped field, the matching OTP input is
  auto-filled (user still must tap Verify) — see
  `extractDebugOtp()` in `DoctorAuthScreen.tsx` / `PatientAuthScreen.tsx`.
  Note: neither reference document actually specifies a `debug_otp`
  field, so this is defensive/best-effort, not a confirmed contract.
- **Doctor onboarding** — selfie via `expo-image-picker` (camera or
  library) uploaded through `POST /uploads/presign` → S3 PUT → `complete-profile`;
  name; speciality/subspeciality cascading chips from
  `GET /search/specialities[/:id/subspecialities]`; graduation/PG college
  name + year; clinic name + GPS pin via `expo-location`'s
  "Use my current location" button.
- **Doctor home/profile tab** — about/bio (PATCH `/doctors/me`),
  achievements list + add screen, publications list + add screen,
  both gated by the compliance-scan flow below. Affiliations section is
  present but marked "Coming soon" (no affiliations CRUD UI in this pass).
- **Posts/feed tab** — create post with visibility-scope chips (gated by
  compliance scan), feed list (`GET /feed`) with like/unlike
  (`POST`/`DELETE /posts/:id/likes`) and a comment-count display (no
  comment composer yet).
- **Compliance gate** — `src/lib/compliance.ts` wraps
  `POST /compliance/scan`; `src/components/ComplianceModal.tsx` is the
  blocking "no override" modal listing each violation's
  category/excerpt/guidance. Wired into Achievements, Publications, and
  Create Post, per the brief's "at least these three" requirement.
- **Patient auth** — profile fields (name, age, gender, PIN) + single
  mobile OTP (`/auth/patient/register/request-otp` → `verify-otp`, which
  per the spec returns tokens immediately with no separate
  complete-profile step) and mobile-OTP login.
- **Patient home** — PIN entry, speciality/subspeciality filter chips,
  nearby doctor list (`GET /search/doctors`).
- **Booking flow** — doctor summary → family member picker
  (`GET /patients/me/family-members`) → mode toggle (in-person/video) →
  date picker (`react-native-calendars`) → time slot grid
  (`GET /doctors/:id/available-times`, with a synthetic half-hour-slot
  fallback if that call fails, so the flow stays testable before the API
  is live) → payment summary → mock "Pay Now" button that calls the real
  `POST /appointments` then `POST /payments/:payment_id/confirm`.
- **Appointments list** — Upcoming/Completed tabs (`GET /appointments`,
  filtered client-side by status), reschedule entry point (re-enters the
  date/time/payment steps and calls
  `POST /appointments/:id/reschedule`), "Video Call" placeholder screen,
  "See Prescription" screen (`GET /appointments/:id/prescription`).
- **Patient profile** — family members list + add-member form
  (`GET`/`POST /patients/me/family-members`).
- **Navigation** — separate bottom-tab navigators for the Doctor app
  (Profile/Network/Posts/Community/Market/Legal Help/Help Desk — names and
  order match the prototype's 7 tabs) and the Patient app
  (Home/My Appointments/Alerts/Profile — matches the prototype's 4 tabs),
  each reached only after that role's auth flow completes.

## Coming-soon placeholders (reachable from nav, clearly labeled)

- Doctor: Network, Community, Marketplace, Medico-Legal Help, Help Desk
  tabs (each a simple "🚧 Coming soon" screen).
- Doctor: Affiliations section (listed in Profile but not editable).
- Patient: Alerts tab.
- Patient: Video Call screen (placeholder, no WebRTC/session wiring).
- A full interactive draggable map in onboarding is not implemented —
  only the "Use my current location" GPS button, per the brief's
  "nice-to-have, not required" note.

## Known gaps / deviations from the plan

These stem from the API specification document itself not enumerating
certain response shapes (confirmed by a dedicated read-through — see
inline code comments at each call site for the exact gap):

- `GET /search/doctors` and `GET /doctors/:id/available-times` response
  *field names* for list items aren't documented (only query params and
  backing-view logic are) — `PatientHomeScreen.tsx` and
  `BookingTimeScreen.tsx` normalize defensively across a few plausible
  shapes (snake_case API-style and the prototype's camelCase demo
  fields) rather than assuming one exact contract.
- A passing `POST /compliance/scan` response's exact JSON shape isn't
  shown in the spec (only the blocked-scan error shape is) —
  `src/lib/compliance.ts` assumes `{ scan_id, verdict, violations }` and
  documents this assumption inline.
- No `GET /colleges`-style endpoint is documented, so the onboarding
  education form only collects free-text college names
  (`college_name_other`), not a `college_id` picker.
- Payment confirmation is modeled as the spec's separate
  `POST /payments/:payment_id/confirm` (keyed by `payment_id` returned
  from `POST /appointments`), not a same-call or appointment-id-keyed
  endpoint.
- `GET /appointments` upcoming/completed split is inferred from the
  generic `status` values (`requested|confirmed|rescheduled` → Upcoming,
  `completed|no_show|cancelled` → Completed), since the spec only
  documents the filter *parameter names*, not a literal
  upcoming/completed enum.

## Running on each target

### iOS Simulator (Mac only)
```bash
npx expo start
# press i
```

### Android Emulator
1. Start an AVD from Android Studio first.
2. Set `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:4000/v1` in `.env`.
3. `npx expo start`, then press `a`.

### Physical device (Expo Go)
1. Install **Expo Go** from the App Store / Play Store.
2. Set `EXPO_PUBLIC_API_BASE_URL` to your computer's LAN IP (same Wi-Fi
   network as the phone), e.g. `http://192.168.1.50:4000/v1`.
3. `npx expo start`, then scan the QR code.

## EAS Build (for real app-store binaries, later)

Not run in this pass — producing real signed binaries requires an Expo
account and Apple/Google developer program credentials this environment
doesn't have. For when that's available, the commands are:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios       # or android, or both
eas submit --platform ios      # after a successful build, to push to the stores
```

`app.json` already has an `extra.eas.projectId` placeholder
(`REPLACE_WITH_EAS_PROJECT_ID`) to fill in once `eas build:configure` is
run against a real Expo account.

## Verifying this build yourself

```bash
cd apps/mobile
npm install
npx expo-doctor              # 17/17 checks should pass
npx tsc --noEmit             # should report no errors
npx expo export --platform ios      # bundles the full app without a simulator
npx expo export --platform android  # same, for Android
npx expo start                      # interactive dev server
```
