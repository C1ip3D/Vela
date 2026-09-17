# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Vela

Vela is a student academic monitoring and planning platform built for Stang Hacks 2026. It integrates with **Infinite Campus** (not Canvas, despite some legacy naming in the schema) to pull course data, assignments, and grades. It has two surfaces:

- **Web app** (`/`) — Next.js 16 dashboard with grade simulation, AI advisor (Kepler), and counselor tools
- **Mobile app** (`/mobile/`) — Expo/React Native app with the same IC integration and grade history charts

## Commands

### Web (Next.js)

```bash
npm run dev       # dev server with Turbopack
npm run build     # production build
npm run lint      # ESLint
npx prisma migrate dev   # run DB migrations
npx prisma generate      # regenerate Prisma client after schema changes
npx prisma studio        # browse the DB
```

### Mobile (Expo)

```bash
cd mobile
npm start         # Expo dev server
npm run ios       # run on iOS simulator
npm run android   # run on Android emulator
npm run bundle:ios  # production iOS bundle
```

## Architecture

### Data flow

1. The user enters their **Infinite Campus** credentials (stored client-side: `localStorage` on web, `expo-secure-store` on mobile; IC credentials are never sent to the Vela backend). The app derives a deterministic pseudo email/password from the IC username + district hostname and uses it to sign up/sign in with **Firebase Auth** (email/password provider — there is no Google OAuth or other real-identity login). The resulting Firebase UID is used as the primary user identity across both web and mobile, and the ID token is sent as a Bearer token on API requests (decoded, not signature-verified, by `lib/authToken.ts:extractUid`).
2. The IC session (cookies/XSRF token) established with those credentials is what's used for subsequent IC API calls.
3. IC data is fetched directly from the IC API (from the client or via `/api/ic/*` proxy routes), then **synced to the Postgres DB** via `lib/syncIC.ts:syncICCoursesToDB`. This function upserts users, courses, enrollments, grade history snapshots, and assignment grades, and logs meaningful grade/assignment changes to the advisor feed (`AdvisorLog`).
4. The DB (accessed via Prisma + `@prisma/adapter-pg`) is the source of truth for all historical data, GPA snapshots, and advisor logs.

### Web app structure

- `app/(student)/` — protected student pages: `dashboard`, `courses`, `advisor`, `settings`
- `app/api/` — Next.js route handlers:
  - `ic/` — proxy routes for IC (auth, courses, assignments, districts, gpa-history)
  - `sync/` — triggers `syncICCoursesToDB`
  - `advisor/` — Kepler AI chat and counselor-note integration (Gemini via `@google/generative-ai`)
  - `recommend/` — course recommendation engine
  - `simulate/` — grade simulation endpoint
- `contexts/AuthContext.tsx` — wraps Firebase `onAuthStateChanged`
- `contexts/InfiniteCampusContext.tsx` — manages IC session/credentials, auto-reauths on load from `localStorage`
- `lib/authToken.ts` — decodes Firebase JWT from `Authorization: Bearer` header **without signature verification** (used in API routes to get UID)
- `lib/syncIC.ts` — core sync logic; also exports `getCachedCourses` for stale-while-revalidate pattern

### Mobile app structure

- `mobile/app/(tabs)/` — bottom tab screens: `dashboard`, `courses`, `advisor`, `schedule`, `settings`
- `mobile/lib/icClient.ts` — low-level IC HTTP client; stores session in SecureStore; handles XSRF token
- `mobile/lib/icApi.ts` — higher-level IC API calls (courses, assignments, etc.)
- `mobile/lib/icParsers.ts` — parses raw IC API responses into `SyncableCourse` shape
- `mobile/lib/api.ts` — axios client pointed at the Next.js backend; attaches Firebase ID token automatically
- `mobile/lib/engines/gpa.ts` — client-side GPA calculation engine
- `mobile/contexts/` — `AuthContext` (Firebase) and `InfiniteCampusContext` (IC session), mirrors web

### Auth pattern in API routes

All API routes authenticate by reading `Authorization: Bearer <firebase-jwt>` and calling `extractUid()` from `lib/authToken.ts`. The UID maps to `User.canvasUserId` in the DB (legacy field name — actually holds Firebase UID).

### Database

PostgreSQL via Prisma. Key models: `User`, `Course`, `Enrollment`, `GradeHistory`, `GpaSnapshot`, `AdvisorLog`, `AssignmentGrade`. The `canvasUserId` field on `User` stores the Firebase UID. `Course.canvasCourseId` stores the IC course ID. Grade history is pruned to 30 days (runs only on Sundays during sync).

### Environment variables

Web app needs: `DATABASE_URL`, `FIREBASE_*` (admin SDK), `GOOGLE_AI_API_KEY` (Gemini/Kepler), Telegram bot token.  
Mobile needs: `EXPO_PUBLIC_API_BASE_URL` (points to the Next.js backend).
