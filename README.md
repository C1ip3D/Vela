# Tassel

A native iPhone app that shows students their grades, assignments and class schedule from **Infinite Campus**, with a small backend. Built for Stang Hacks 2026.

Tassel is a student project. It is not affiliated with or endorsed by Infinite Campus or any school district.

## What it does

- **Grades:** weighted and unweighted GPA, every course with its current grade and missing-assignment count, and a per-course breakdown by category.
- **What-if:** edit a score, drop an assignment or add a hypothetical one, and see the course grade change. Nothing is saved or sent anywhere. A final-exam calculator shows the score needed to reach a target grade.
- **Today:** a countdown to the end of the current class (or the start of the next one) and the rest of the day's classes. Class times come from built-in bell schedules, which currently cover Dublin Unified only. Other districts see their classes without times.
- **Access:** sign up for or switch flex-period sessions (Infinite Campus Responsive Scheduling), search sessions by teacher's last name, and see seats left.
- **Stay signed in:** optionally keeps the Infinite Campus login in the device Keychain, so an expired session is renewed in the background instead of sending the student back to sign in.

## How it works

1. The student signs in on their district's own Infinite Campus page, shown inside the app. The password never goes to Tassel's server.
2. The app reads courses, assignments and schedule **directly from Infinite Campus on the device**. It needs no backend to show grades.
3. The app sends the Infinite Campus session to the backend, which re-checks it against the district's server and mints a Firebase sign-in token. The Firebase user is the student's Tassel account.
4. As a best-effort extra, the app asks the backend to copy grades into Postgres, which keeps grade history and GPA snapshots. If that fails, the app is unaffected.

The full policy is in the app (Settings → Privacy Policy) and served by the backend at `/privacy`.

## Repository layout

npm-workspaces monorepo. The code still uses the project's earlier name, Vela, in paths, package names and the Xcode project.

```
apps/
  ios/          native SwiftUI app (iOS 18+), see apps/ios/README.md
    VelaKit/    Swift package: ports of ic-client and domain, with tests
  api/          Hono backend (Node, run with tsx), deployed on Render
packages/
  ic-client/    Infinite Campus sign-in check, API client and response parsers
  domain/       grading, GPA and bell-schedule logic
  auth/         Firebase ID-token verification and custom-token minting
  db/           Prisma schema, client and migrations (PostgreSQL)
  types/        shared TypeScript types
```

The iOS app can't import the TypeScript packages, so `VelaKit` carries a Swift port of them. A change to grading or Infinite Campus parsing must be made in both.

## Getting started

### Backend

Requires Node 22 and a PostgreSQL database.

```bash
npm install
```

Create `.env.local` in the repo root:

```bash
DATABASE_URL=postgresql://...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_SERVICE_ACCOUNT_KEY_BASE64=...   # base64 of the Firebase service-account JSON
```

`packages/db` needs its own copy of `DATABASE_URL` (a `.env` there) for the Prisma CLI.

```bash
npm run db:migrate
```

```bash
npm run dev
```

The API runs on `http://localhost:3000`.

| Route | Purpose |
|---|---|
| `POST /api/ic/mint-token` | Verifies an Infinite Campus session and returns a Firebase custom token |
| `POST /api/ic/courses` | Saves a grade snapshot to the database |
| `POST /api/ic/schedule` | Saves the student's class schedule |
| `GET /api/schedule` | Saved schedule plus the district's bell preset |
| `GET /privacy` | Public privacy policy page |
| `GET /health` | Health check |

API routes take `Authorization: Bearer <Firebase ID token>`, except `mint-token`.

### iOS app

Requires a Mac with Xcode and [XcodeGen](https://github.com/yonaskolb/XcodeGen). The Xcode project is generated, not committed.

```bash
brew install xcodegen
```

```bash
npm run xcode
```

```bash
open apps/ios/Vela.xcodeproj
```

Use the `Vela Dev` scheme for a Debug build against `localhost:3000`, or `Vela Release` for the Render backend. Firebase config is optional: put `GoogleService-Info.plist` in `apps/ios/`. Without it the app still signs in to Infinite Campus and shows grades, and only skips the Tassel account and server snapshot.

To try the app without an Infinite Campus account, run it with the `-VelaDemo` launch argument (Debug builds) for sample data. See [apps/ios/README.md](apps/ios/README.md) for a mock Infinite Campus server and more.

### Preview in a browser, without a Mac

Every push that touches `apps/ios` runs the **iOS preview build** GitHub Actions workflow. It builds a demo-mode simulator app and attaches it to the run as `Vela-simulator`. Download it, unzip it once, and upload the inner zip at [appetize.io](https://appetize.io/upload). Add `[skip ci]` to a commit message to skip the build.

## Tests

```bash
npm run test -w @vela/domain
```

```bash
npm run test -w @vela/ic-client
```

```bash
npm run build
```

The last one typechecks the backend. The Swift port's tests need macOS:

```bash
swift test --package-path apps/ios/VelaKit
```

## Deployment

The backend deploys to Render from `render.yaml`. Set `DATABASE_URL`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` and `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` in the Render dashboard. The free plan sleeps when idle, so the first request after a pause is slow.
