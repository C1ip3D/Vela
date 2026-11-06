# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Vela

Vela is a student academic monitoring and planning platform built for Stang Hacks 2026. It integrates with **Infinite Campus** to pull course data, assignments, and grades. It is a mobile-first product plus a small backend, sharing a set of workspace packages in an npm-workspaces monorepo:

- **Mobile app** (`apps/mobile/`) — Expo/React Native app. Talks to Infinite Campus directly from the device and uses the backend only for login token minting and a best-effort grade snapshot.
- **Backend** (`apps/web/`) — API-only Next.js 16 app (route handlers, no pages or UI). The directory/package name `@vela/web` is kept so the Vercel root directory and deployed URL don't change.

## Monorepo layout

```
apps/
  web/         — API-only Next.js 16 backend (route handlers, no UI)
  mobile/      — Expo/React Native app
packages/
  types/       — shared TypeScript interfaces
  domain/      — pure grading logic: GPA calculation, finals study-coach ranking (tested — see packages/domain/src/__tests__)
  ic-client/   — Infinite Campus auth handshake, fetch client, response parsers (environment-agnostic; used by apps/mobile directly and by apps/web's API routes)
  db/          — Prisma schema, client export, and migrations
  auth/        — verified Firebase ID token check (signature verification against Google's public JWKS; custom-token minting needs the service-account key)
```

Both apps depend on the `@vela/*` packages via npm workspaces (`"@vela/domain": "*"` etc.) — always fix shared logic (grading math, IC parsing, auth) in the relevant `packages/` directory, never by re-duplicating it inside `apps/web` or `apps/mobile`.

## Commands

### Root (run from repo root)

```bash
npm install        # installs all workspaces
npm run dev         # backend dev server (Turbopack, port 3000)
npm run build       # backend production build
npm run lint         # backend ESLint
npm run mobile       # expo dev server
npm run db:generate  # regenerate Prisma client after schema changes
npm run db:migrate   # run DB migrations
npm run db:studio    # browse the DB
```

### Mobile-specific (from apps/mobile, or via `npm run <script> -w @vela/mobile`)

```bash
npm run ios       # run on iOS simulator
npm run android   # run on Android emulator
npm run bundle:ios  # production iOS bundle
npm test           # jest (currently only packages/domain has unit tests; apps/mobile has none of its own)
```

### Domain package tests

```bash
npm run test -w @vela/domain
```

## Architecture

### Data flow

1. The user signs in to **Infinite Campus** inside an on-device WebView on mobile. The IC session (cookies/XSRF token) is stored in `expo-secure-store`; IC credentials are never sent to the Vela backend. Mobile posts the session to the backend's `/api/ic/mint-token`, which re-verifies it against the district's IC server (`@vela/ic-client`'s `fetchPersonInfo`) and mints a **Firebase custom token** (`@vela/auth`). The resulting Firebase UID is the primary user identity; the ID token is sent as a Bearer token on later API requests, verified with `verifyAuthHeader()`/`extractUid()` from `@vela/auth` (RS256 signature check against Google's public keys).
2. Mobile fetches courses/assignments/schedule **directly from IC on the device** via `@vela/ic-client`'s `fetchCourses`/`fetchAssignments`/`fetchSchedule` — it does not need the backend to render grades.
3. As a best-effort side effect, mobile also posts to `/api/ic/courses`, which syncs the data to Postgres via `apps/web/lib/syncIC.ts:syncICCoursesToDB` (upserts `District`, user, courses, enrollments, grade history snapshots, assignment grades; logs meaningful changes to `AdvisorLog`). Failure there never affects what the app shows.
4. The DB (`@vela/db`'s Prisma client + `@prisma/adapter-pg`) is the source of truth for historical data, GPA snapshots, and advisor logs.

### Backend structure (`apps/web/`)

API-only Next.js app — no pages, no UI. Route handlers:

- `app/api/ic/mint-token` — verifies a mobile-supplied IC session and mints a Firebase custom token
- `app/api/ic/courses` — syncs courses/grades to the DB, serving from the DB cache when available
- `lib/syncIC.ts` — core sync logic; also exports `getCachedCourses` (stale-while-revalidate) and `districtHostnameFromBaseUrl` (District scoping)

### Mobile app structure (`apps/mobile/`)

- `app/(tabs)/` — bottom tab screens: `dashboard`, `courses`, `advisor`, `schedule`, `finals`, `settings`
- `lib/icSession.ts` — single source of truth for the persisted IC session (SecureStore key `vela_ic_session`); converts the stored shape to `@vela/ic-client`'s `IcSession`
- `lib/icApi.ts` — thin wrapper binding `@vela/ic-client`'s `fetchCourses`/`fetchAssignments`/`fetchSchedule` to the stored session
- `lib/api.ts` — axios client pointed at the Next.js backend; attaches Firebase ID token automatically
- `contexts/` — `AuthContext` (Firebase) and `InfiniteCampusContext` (IC session; also resolves `personId` via `@vela/ic-client`'s `fetchPersonInfo` right after login)

Metro is configured (`metro.config.js`) with `watchFolders`/`nodeModulesPaths` pointed at the monorepo root, since npm hoists the `@vela/*` workspace packages there rather than into `apps/mobile/node_modules`.

### Auth pattern in API routes

All API routes authenticate by reading `Authorization: Bearer <firebase-jwt>` and calling `extractUid()` (or `verifyAuthHeader()` for the full claims) from `@vela/auth`. The UID maps to `User.firebaseUid` in the DB.

### Database

PostgreSQL via Prisma (schema in `packages/db/prisma/schema.prisma`). Key models: `District`, `User`, `Course`, `Enrollment`, `GradeHistory`, `GpaSnapshot`, `AdvisorLog`, `AssignmentGrade`. `User.firebaseUid` stores the Firebase UID; `Course.icCourseId` stores the IC course/section ID, uniqued *within* its `District` (`@@unique([districtId, icCourseId])`) rather than globally — IC section IDs repeat across districts. Grade history is pruned to 30 days (runs only on Sundays during sync).

### Environment variables

Root `.env`/`.env.local` are symlinked into `apps/web` and `packages/db` (both need them — Next.js and the Prisma CLI each only auto-load env files from their own cwd).

Needs: `DATABASE_URL`, `NEXT_PUBLIC_FIREBASE_*` (also used server-side by `@vela/auth` to verify ID tokens), `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` (used by `@vela/auth`'s `mintCustomTokenForIcIdentity` for `/api/ic/mint-token`).
Mobile needs: `EXPO_PUBLIC_API_BASE_URL` (points to the Next.js backend).
