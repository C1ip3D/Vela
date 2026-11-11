# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Vela

Vela is a student academic monitoring and planning platform built for Stang Hacks 2026. It integrates with **Infinite Campus** to pull course data, assignments, and grades. It is a mobile-first product plus a small backend, sharing a set of workspace packages in an npm-workspaces monorepo:

- **iOS app** (`apps/ios/`) — native SwiftUI app (iOS 18+). Talks to Infinite Campus directly from the device and uses the backend only for login token minting, a best-effort grade snapshot, and saved bell schedules. It replaced the former Expo `apps/mobile`.
- **Backend** (`apps/api/`) — API-only [Hono](https://hono.dev) server (Node, run with `tsx`), deployed on Render via `render.yaml`. Replaces the former Next.js `apps/web`.

## Monorepo layout

```
apps/
  api/         — Hono backend (routes: ic/mint-token, ic/courses, ic/schedule, schedule, schedule/bell)
  ios/         — native SwiftUI app (see apps/ios/README.md); VelaKit/ is a Swift port of ic-client + domain
packages/
  types/       — shared TypeScript interfaces
  domain/      — pure grading logic: GPA calculation, finals study-coach ranking (tested — see packages/domain/src/__tests__)
  ic-client/   — Infinite Campus auth handshake, fetch client, response parsers (environment-agnostic; used by apps/api's routes; the iOS app uses its Swift port in `apps/ios/VelaKit`)
  db/          — Prisma schema, client export, and migrations
  auth/        — verified Firebase ID token check (signature verification against Google's public JWKS; custom-token minting needs the service-account key)
```

`apps/api` depends on the `@vela/*` packages via npm workspaces (`"@vela/domain": "*"` etc.) — always fix shared logic (grading math, IC parsing, auth) in the relevant `packages/` directory, never by re-duplicating it inside `apps/api`. `apps/ios` can't import them, so it carries a Swift port (`VelaKit`) that must be kept in sync.

## Commands

### Root (run from repo root)

```bash
npm install        # installs all workspaces
npm run dev         # Hono API with tsx watch (port 3000; reads root .env.local)
npm run build       # typecheck the API (no bundle step; prod runs TS via tsx)
npm run start       # run the API as in production
npm run db:generate  # regenerate Prisma client after schema changes
npm run db:migrate   # run DB migrations
npm run db:studio    # browse the DB
```

### iOS (apps/ios)

```bash
cd apps/ios && xcodegen generate   # .xcodeproj is generated from project.yml
swift test --package-path apps/ios/VelaKit   # ported ic-client/domain tests
```

When changing grading/IC-parsing logic, update both the TypeScript package and its Swift port in `apps/ios/VelaKit`.

`npm run xcode` (from the repo root) is a shortcut for `xcodegen generate`. Re-run it after any `project.yml` change; `Vela.xcodeproj` is gitignored and generated.

Config for the iOS app:
- **Backend URL:** set per configuration in `apps/ios/Config/Debug.xcconfig` (`http://localhost:3000`) and `Release.xcconfig` (the Render URL). In xcconfig, write URLs as `https:/$()/host` because `//` starts a comment. `Shared.xcconfig` holds common settings (`VELA_DEMO`) and optionally includes a gitignored `Secrets.xcconfig` for local overrides.
- **Firebase:** drop `GoogleService-Info.plist` (gitignored) into `apps/ios/` for the Firebase iOS app (bundle ID `com.avaneesh.vela`). It is wired into the target as an optional source, so builds still work without it. When it is absent, `FirebaseSession.configure()` falls back to `FIREBASE_*` values from xcconfig (e.g. in `Secrets.xcconfig`), and with neither the app runs IC-only.
- **Schemes:** `Vela` runs Debug (localhost); `Vela Release` runs/profiles/archives Release (Render). Archive on `Vela` also uses Release.

### Domain package tests

```bash
npm run test -w @vela/domain
```

## Architecture

### Data flow

1. The user signs in to **Infinite Campus** inside an on-device WebView in the iOS app. The IC session (cookies/XSRF token) is stored in the Keychain; IC credentials are never sent to the Vela backend. The app posts the session to the backend's `/api/ic/mint-token`, which re-verifies it against the district's IC server (`@vela/ic-client`'s `fetchPersonInfo`) and mints a **Firebase custom token** (`@vela/auth`). The resulting Firebase UID is the primary user identity; the ID token is sent as a Bearer token on later API requests, verified with `verifyAuthHeader()`/`extractUid()` from `@vela/auth` (RS256 signature check against Google's public keys).
2. The app fetches courses/assignments/schedule **directly from IC on the device** via `VelaKit`'s `ICClient` (a Swift port of `@vela/ic-client`) — it does not need the backend to render grades.
3. As a best-effort side effect, the app also posts to `/api/ic/courses`, which syncs the data to Postgres via `apps/api/src/lib/syncIC.ts:syncICCoursesToDB` (upserts `District`, user, courses, enrollments, grade history snapshots, assignment grades; logs meaningful changes to `AdvisorLog`). Failure there never affects what the app shows.
4. The DB (`@vela/db`'s Prisma client + `@prisma/adapter-pg`) is the source of truth for historical data, GPA snapshots, and advisor logs.

### Backend structure (`apps/api/`)

Hono app (`src/app.ts`), served by `src/index.ts` via `@hono/node-server`. Routes:

- `POST /api/ic/mint-token` (`src/routes/ic.ts`) — verifies an app-supplied IC session and mints a Firebase custom token
- `POST /api/ic/courses` (`src/routes/ic.ts`) — syncs courses/grades to the DB, serving from the DB cache when available
- `POST /api/ic/schedule` (`src/routes/ic.ts`) — pulls the IC class schedule and replaces the user's stored IC-sourced entries
- `GET /api/schedule`, `PUT /api/schedule/bell` (`src/routes/schedule.ts`) — read schedule + bell schedules; save custom bells (validated by `src/lib/bellValidation.ts`)
- `GET /health` — Render health check
- `src/lib/syncIC.ts` — core sync logic; also exports `getCachedCourses` (stale-while-revalidate) and `districtHostnameFromBaseUrl` (District scoping)

### iOS app structure (`apps/ios/`)

- `Vela/App/AppModel.swift` — app state and lifecycle: IC session, login/sign-out, courses, schedule, bells, Vela sign-in
- `Vela/Services/BackendClient.swift` — `AppConfig` (Info.plist values from xcconfig), `FirebaseSession` (Firebase Auth, configured in code), and `BackendClient` (calls the Hono routes with the Firebase ID token)
- `Vela/Features/` — SwiftUI screens: Login (IC web view + silent re-login), Dashboard, Courses, Day, Schedule (flex), Settings
- `VelaKit/` — Swift package: IC client + parsers, grading, schedule and what-if logic (ports of the TS packages), with tests

### Auth pattern in API routes

All API routes authenticate by reading `Authorization: Bearer <firebase-jwt>` and calling `extractUid()` (or `verifyAuthHeader()` for the full claims) from `@vela/auth`. The UID maps to `User.firebaseUid` in the DB.

### Database

PostgreSQL via Prisma (schema in `packages/db/prisma/schema.prisma`). Key models: `District`, `User`, `Course`, `Enrollment`, `GradeHistory`, `GpaSnapshot`, `AdvisorLog`, `AssignmentGrade`. `User.firebaseUid` stores the Firebase UID; `Course.icCourseId` stores the IC course/section ID, uniqued *within* its `District` (`@@unique([districtId, icCourseId])`) rather than globally — IC section IDs repeat across districts. Grade history is pruned to 30 days (runs only on Sundays during sync).

### Environment variables

`npm run dev` loads the root `.env.local`/`.env` directly (Node `--env-file`). `packages/db` still needs its own copy/symlink for the Prisma CLI (it only auto-loads env from its own cwd). On Render, set the vars listed in `render.yaml`.

Needs: `DATABASE_URL`, `NEXT_PUBLIC_FIREBASE_*` (also used server-side by `@vela/auth` to verify ID tokens), `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` (used by `@vela/auth`'s `mintCustomTokenForIcIdentity` for `/api/ic/mint-token`).
The iOS app needs `GoogleService-Info.plist` in `apps/ios/` (or `FIREBASE_*` values in xcconfig) and a backend URL from `Debug`/`Release.xcconfig` (see the iOS section above).
