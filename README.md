# MeshApp AI — Doctors Professional Partner (DPP) Platform

Monorepo for the MeshApp AI platform: a Node.js/Express/Prisma backend API, a
React (Vite) responsive web client, and an Expo/React Native mobile client,
built against the contracts in the project's reference documents:

- `MeshApp-API-Specification.html` — the REST API contract (`apps/api` implements it)
- `MeshApp-Database-Schema.html` / `meshapp-create-db.sql` — the Postgres schema (already created in the local `meshapp` schema)
- `doctor-patient-v-1.0.html` — the functional/visual prototype (`apps/web` and `apps/mobile` are built from it)
- `MeshApp-Social-Platform-Rules.pdf` — NMC ethics rules enforced by the AI content-compliance scan (`POST /compliance/scan`, gating achievements/publications/posts/marketplace listings)

## Structure

```
meshapp-platform/
├── apps/
│   ├── api/      Node.js + TypeScript + Express + Prisma backend (port 4000)
│   ├── web/      React + TypeScript + Vite + Tailwind responsive web client
│   └── mobile/   Expo (React Native) client for iOS + Android
├── packages/
│   └── shared/   Shared TypeScript enums/types/error-code contract (@meshapp/shared)
├── render.yaml   Render deployment blueprint (API + web static site)
└── docs/
```

`apps/api` and `apps/web` are npm workspaces (see root `package.json`) and both
depend on `packages/shared`. `apps/mobile` is a standalone Expo project (its
own `package.json`/lockfile) — see its README for why it isn't a workspace member.

## Quick start (local dev)

```bash
npm install                                    # installs api + web + shared workspaces
npm run build --workspace packages/shared

# Backend — copy apps/api/.env.example to apps/api/.env and fill in your local
# Postgres connection string (schema "meshapp", already created by meshapp-create-db.sql)
cd apps/api && npx prisma generate && npm run dev     # http://localhost:4000
# in another terminal:
npm run seed:demo --workspace apps/api                 # creates demo doctors/patients/appointment

# Web client
npm run dev --workspace apps/web               # http://localhost:5173

# Mobile client (separate install)
cd apps/mobile && npm install && npx expo start
```

Each app has its own README with full details: [`apps/api/README.md`](apps/api/README.md),
[`apps/web/README.md`](apps/web/README.md), [`apps/mobile/README.md`](apps/mobile/README.md).

## What's real vs mocked in this build

OTP delivery, email, payment gateway confirmation, and file storage (S3) are
mocked for this build (by agreed scope) — console-logged/local-disk/auto-success
substitutes with clearly documented swap-out points for real providers. The
content-compliance enforcement, RBAC, appointment booking transaction safety,
and PostGIS geo-search are real, working implementations against the live
Postgres schema. See `apps/api/README.md` → "Mock vs Real integrations" for the
complete list.

## Deployment (Render)

`render.yaml` defines two services, both built from the repo root so the
`@meshapp/shared` workspace dependency resolves:

- `meshapp-api` — Node web service (needs a reachable Postgres with the
  `meshapp` schema applied — see `meshapp-create-db.sql` — and its
  `DATABASE_URL`/`CORS_ORIGIN`/`UPLOAD_BASE_URL` env vars set in the Render dashboard)
- `meshapp-web` — static site (needs `VITE_API_BASE_URL` set to the deployed API's URL)

Mobile is not deployed to Render — it's run via Expo Go / EAS Build separately.
