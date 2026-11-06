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

To exercise login, "Stay signed in" and silent re-login without a real student account, run the fake IC and point a Debug build at it:

```bash
python3 apps/ios/Scripts/mock_ic.py 8099        # login: student / pw123
# launch args: -VelaMockIC http://localhost:8099 [-VelaMockStale] [-VelaMockBadPassword]
```

`-VelaMockStale` starts signed in with an expired session and saved credentials (silent re-login); add `-VelaMockBadPassword` to see it fall back to sign-in.
Use a signed simulator build (the default Xcode build): with `CODE_SIGNING_ALLOWED=NO` the Keychain is unavailable and nothing is saved.

## Backend contract (unchanged, Hono-compatible)

- `POST /api/ic/mint-token` — `{cookies, baseUrl, appName, districtName, stateCode}` → `{firebaseCustomToken, personId, displayName}`
- `POST /api/ic/courses` — Bearer Firebase ID token; best-effort grade snapshot
- `GET /api/schedule` (custom `bells` only) and `PUT /api/schedule/bell` — bell times shared with web

These are the same routes the Expo app uses, so the Next.js → Hono port only has to preserve them.

## Porting notes

- `Parsers.swift` is a line-for-line port of `packages/ic-client/src/parsers.ts`, including its quirks (e.g. any node's `score` can set a course's grade; last one visited wins). IC's JSON varies per district, so it walks a key-order-preserving `JSON` value instead of fixed `Codable` models.
- The IC session (cookie jar) lives in the Keychain. Login runs in a non-persistent `WKWebView`. IC credentials are only kept if the student leaves "Stay signed in" on: they go to this device's Keychain (this-device-only, never sent to Vela) and are only ever typed into the district's own IC login page by `SilentIcLogin`, which checks the refreshed session is the same student before using it.

## Not yet ported (parity gaps vs apps/mobile)

- "Reset to school schedule" for edited bell times (the backend has no delete route yet)
- Finals/study coach
