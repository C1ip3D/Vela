# Vela for iOS (SwiftUI)

Native rewrite of `apps/mobile` (Expo). iOS 18+, SwiftUI + Observation, Swift 5 language mode.

```
apps/ios/
  project.yml        XcodeGen spec (the .xcodeproj is generated, not committed)
  Config/            xcconfig: API base URL + Firebase keys (Secrets.xcconfig is gitignored)
  Vela/              the app: App/, Services/, Theme/, Features/{Login,Dashboard,Courses,Day,Settings}
  VelaKit/           Swift package, no UI: ports of @vela/ic-client and @vela/domain + tests
```

## Run

```bash
brew install xcodegen          # once
cd apps/ios
cp Config/Secrets.example.xcconfig Config/Secrets.xcconfig   # fill in; optional (see below)
xcodegen generate && open Vela.xcodeproj
```

Unit tests (macOS, no simulator): `swift test --package-path apps/ios/VelaKit`

`Secrets.xcconfig` holds `VELA_API_BASE_URL` and the `FIREBASE_*` values (same ones the Expo app took from `EXPO_PUBLIC_*`).
Without the Firebase values the app still signs in to Infinite Campus and shows grades; it just skips Vela sign-in and the best-effort `/api/ic/courses` snapshot.

Debug builds accept a `-VelaDemo` launch argument: skips sign-in and shows fixture data (no network).

## Backend contract (unchanged, Hono-compatible)

- `POST /api/ic/mint-token` — `{cookies, baseUrl, appName, districtName, stateCode}` → `{firebaseCustomToken, personId, displayName}`
- `POST /api/ic/courses` — Bearer Firebase ID token; best-effort grade snapshot
- `GET /api/schedule` (custom `bells` only) and `PUT /api/schedule/bell` — bell times shared with web

These are the same routes the Expo app uses, so the Next.js → Hono port only has to preserve them.

## Porting notes

- `Parsers.swift` is a line-for-line port of `packages/ic-client/src/parsers.ts`, including its quirks (e.g. any node's `score` can set a course's grade; last one visited wins). IC's JSON varies per district, so it walks a key-order-preserving `JSON` value instead of fixed `Codable` models.
- The IC session (cookie jar) lives in the Keychain; IC credentials are never stored or sent anywhere. Login runs in a non-persistent `WKWebView`.

## Not yet ported (parity gaps vs apps/mobile)

- "Reset to school schedule" for edited bell times (the backend has no delete route yet)
- Responsive scheduling / flex-period picker (`Schedule` tab)
- Silent IC re-login with saved credentials (an expired session now returns to sign-in)
- Finals/study coach
