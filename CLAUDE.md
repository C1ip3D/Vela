# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Vela

Vela is a student academic monitoring and planning platform built for Stang Hacks 2026. It integrates with **Infinite Campus** to pull course data, assignments, and grades. It has two surfaces sharing a set of workspace packages in an npm-workspaces monorepo:

- **Web app** (`apps/web/`) — Next.js 16 dashboard with grade simulation, AI advisor (Kepler), and counselor tools
- **Mobile app** (`apps/mobile/`) — Expo/React Native app with the same IC integration and grade history charts

## Monorepo layout

```
apps/
  web/         — Next.js 16 app (App Router)
  mobile/      — Expo/React Native app
packages/
  types/       — shared TypeScript interfaces
  domain/      — pure grading logic: GPA calculation, finals study-coach ranking (tested — see packages/domain/src/__tests__)
  ic-client/   — Infinite Campus auth handshake, fetch client, response parsers (environment-agnostic; used by both apps/web's API routes and apps/mobile directly)
  db/          — Prisma schema, client export, and migrations
  auth/        — verified Firebase ID token check (signature verification against Google's public JWKS, no service-account key required)
```

Both apps depend on the `@vela/*` packages via npm workspaces (`"@vela/domain": "*"` etc.) — always fix shared logic (grading math, IC parsing, auth) in the relevant `packages/` directory, never by re-duplicating it inside `apps/web` or `apps/mobile`.

## Commands

### Root (run from repo root)

```bash
npm install        # installs all workspaces
npm run dev         # web dev server (Turbopack)
npm run build       # web production build
npm run lint         # web ESLint
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

1. The user enters their **Infinite Campus** credentials (stored client-side: `localStorage` on web, `expo-secure-store` on mobile; IC credentials are never sent to the Vela backend). The app derives a deterministic pseudo email/password from the IC username + district hostname and uses it to sign up/sign in with **Firebase Auth** (email/password provider — there is no Google OAuth or other real-identity login). The resulting Firebase UID is the primary user identity across both web and mobile, and the ID token is sent as a Bearer token on API requests. API routes verify it with `verifyAuthHeader()`/`extractUid()` from `@vela/auth`, which checks the RS256 signature against Google's public keys (not just a payload decode).
2. The IC session (cookies/XSRF token) established with those credentials is used for subsequent IC API calls, via `@vela/ic-client`'s `fetchCourses`/`fetchAssignments`/`fetchSchedule` — the same functions apps/web's API routes and apps/mobile both call.
3. IC data is synced to the Postgres DB via `apps/web/lib/syncIC.ts:syncICCoursesToDB`. This function upserts the `District` (derived from the IC base URL's hostname), user, courses, enrollments, grade history snapshots, and assignment grades, and logs meaningful grade/assignment changes to the advisor feed (`AdvisorLog`).
4. The DB (accessed via `@vela/db`'s Prisma client + `@prisma/adapter-pg`) is the source of truth for all historical data, GPA snapshots, and advisor logs.

### Web app structure (`apps/web/`)

- `app/(student)/` — protected student pages: `dashboard`, `courses`, `advisor`, `settings`
- `app/api/` — Next.js route handlers:
  - `ic/` — proxy routes for IC (`auth` wraps `@vela/ic-client`'s `loginToIc`; `courses`/`assignments` wrap its `fetchCourses`/`fetchAssignments`; `districts`, `gpa-history`)
  - `sync/` — triggers `syncICCoursesToDB`
  - `advisor/` — Kepler AI chat and finals study-coach (Gemini via `@google/generative-ai`)
  - `enrollments/[id]/final-weight` — per-enrollment final-exam weight override
- `contexts/AuthContext.tsx` — wraps Firebase `onAuthStateChanged`
- `contexts/InfiniteCampusContext.tsx` — manages IC session/credentials, auto-reauths on load from `localStorage`
- `lib/syncIC.ts` — core sync logic; also exports `getCachedCourses` for stale-while-revalidate pattern, and `districtHostnameFromBaseUrl` for District scoping

### Mobile app structure (`apps/mobile/`)

- `app/(tabs)/` — bottom tab screens: `dashboard`, `courses`, `advisor`, `schedule`, `finals`, `settings`
- `lib/icSession.ts` — single source of truth for the persisted IC session (SecureStore key `vela_ic_session`); converts the stored shape to `@vela/ic-client`'s `IcSession`
- `lib/icApi.ts` — thin wrapper binding `@vela/ic-client`'s `fetchCourses`/`fetchAssignments`/`fetchSchedule` to the stored session
- `lib/api.ts` — axios client pointed at the Next.js backend; attaches Firebase ID token automatically
- `contexts/` — `AuthContext` (Firebase) and `InfiniteCampusContext` (IC session; also resolves `personId` via `@vela/ic-client`'s `fetchPersonInfo` right after login), mirrors web

Metro is configured (`metro.config.js`) with `watchFolders`/`nodeModulesPaths` pointed at the monorepo root, since npm hoists the `@vela/*` workspace packages there rather than into `apps/mobile/node_modules`.

### Auth pattern in API routes

All API routes authenticate by reading `Authorization: Bearer <firebase-jwt>` and calling `extractUid()` (or `verifyAuthHeader()` for the full claims) from `@vela/auth`. The UID maps to `User.firebaseUid` in the DB.

### Database

PostgreSQL via Prisma (schema in `packages/db/prisma/schema.prisma`). Key models: `District`, `User`, `Course`, `Enrollment`, `GradeHistory`, `GpaSnapshot`, `AdvisorLog`, `AssignmentGrade`. `User.firebaseUid` stores the Firebase UID; `Course.icCourseId` stores the IC course/section ID, uniqued *within* its `District` (`@@unique([districtId, icCourseId])`) rather than globally — IC section IDs repeat across districts. Grade history is pruned to 30 days (runs only on Sundays during sync).

### Environment variables

Root `.env`/`.env.local` are symlinked into `apps/web` and `packages/db` (both need them — Next.js and the Prisma CLI each only auto-load env files from their own cwd).

Needs: `DATABASE_URL`, `NEXT_PUBLIC_FIREBASE_*` (also used server-side by `@vela/auth` to verify ID tokens — no Firebase Admin service-account key required), `GEMINI_API_KEY` (Kepler).
Mobile needs: `EXPO_PUBLIC_API_BASE_URL` (points to the Next.js backend).
