# Tassel: App Store listing and release checklist

Everything App Store Connect asks for, ready to paste. Nothing here has been submitted.

## Listing

| Field | Value |
| --- | --- |
| App name (30 max) | Tassel: Grades & Schedule |
| Home screen name | Tassel (`CFBundleDisplayName`) |
| Subtitle (30 max) | Classes and GPA at a glance |
| Primary category | Education |
| Secondary category | Productivity |
| Privacy Policy URL | https://vela-434k.onrender.com/privacy |
| Support URL | https://vela-434k.onrender.com/support |
| Version / build | 1.0.0 (2) |
| Bundle ID | com.avaneesh.vela (unchanged) |

**Keywords** (100 max, no spaces after commas):

```
gradebook,gpa,student,school,grades,schedule,bell,flex,period,homework,assignments,class,high school
```

Other companies' trademarks are left out of the name, subtitle and keywords on purpose (guideline 2.3.7). Infinite Campus is named only in the description, with the "not affiliated" line.

**Promotional text** (170 max, can change without review):

```
See every grade, your GPA and what's next in your day, all in one calm place.
```

**Description:**

```
Tassel keeps your whole school day in one place: your grades, your GPA, the time left in class and the seats left in flex period.

Sign in once with your district's Infinite Campus page, right inside the app, and Tassel does the rest.

GRADES
• Every class with your current percentage and letter grade
• Assignments by category, with missing and late work called out
• Weighted and unweighted GPA, worked out for you

SCHEDULE
• Today's classes with your district's bell times
• What's on now and how long until it ends

FLEX PERIODS
• See open flex sessions and how many seats are left
• Pick or switch your session in a tap

PRIVATE BY DESIGN
• Your Infinite Campus password is typed into your district's own page and never sent to Tassel
• Your session is kept in the iOS Keychain on your device
• No ads and no tracking
• Delete your account any time from Settings

Not a student yet, or just curious? Tap "Try a demo" to look around with sample data.

Tassel is a student project and is not affiliated with or endorsed by Infinite Campus or any school district.
```

## App Review information

**Sign-in required:** Yes. Use the demo instead of an account.

**Notes for the reviewer:**

```
Tassel reads a student's grades and schedule from Infinite Campus, the student information system their school district uses. Signing in needs a real student account from a district, so we can't provide one.

To review the full app without an account, tap "Try a demo" on the sign-in screen. It opens the app with a sample student, sample classes, assignments, a bell schedule and flex periods. No network access is needed. Settings > Exit Demo returns to the sign-in screen.

Account deletion: Settings > Delete Account (shown when signed in with a real account) permanently deletes the Tassel account and all data stored on our server.

The student's Infinite Campus password is entered on the district's own sign-in page inside a web view and is never sent to our server.
```

## App Privacy (nutrition label)

Data collection: **Yes, we collect data.** None of it is used for tracking.

| Data type | Linked to user | Tracking | Purpose |
| --- | --- | --- | --- |
| Contact Info › Name | Yes | No | App Functionality |
| Contact Info › Email Address (Tassel-generated, from the IC person ID) | Yes | No | App Functionality |
| Identifiers › User ID (Firebase UID, IC person ID) | Yes | No | App Functionality |
| User Content › Other User Content (courses, assignments, grades, schedule, GPA and grade history) | Yes | No | App Functionality |

Not collected: location, contacts, photos, browsing history, purchases, diagnostics, usage data, device ID, advertising data.

This matches `apps/ios/Vela/PrivacyInfo.xcprivacy`.

## Age rating

Answer "None" to every content question; no user-generated content, no web browsing beyond the district sign-in page, no purchases. Expected rating: 4+.

## Export compliance

`ITSAppUsesNonExemptEncryption` is `false` (HTTPS only), so no export documentation is needed.

## Screenshots

The app is iPhone only, so App Store Connect needs one set at **6.9"** (1320 × 2868 portrait), 3 to 10 images. Take them in the iPhone 17 Pro Max simulator with "Try a demo" so no real student data appears. Suggested order: Grades list, a class's assignments, Schedule (today), Flex periods, Settings/privacy.

## Release checklist

1. Merge the App Store readiness PR.
2. Make sure Render has deployed the new backend (check `https://vela-434k.onrender.com/support` loads), and set `SUPPORT_EMAIL` on the Render service so the support page shows a contact.
3. On a Mac with **Xcode 26** (required since April 2026): `cd apps/ios && xcodegen`, open `Vela.xcodeproj`, choose the **Vela Release** scheme, Product › Archive, then Distribute App › App Store Connect › Upload. Build number is 2.
4. In App Store Connect: update the name, subtitle, description, keywords, URLs, privacy answers, age rating, screenshots and review notes from this file.
5. Attach build 2 to version 1.0.0 and submit for review (only when you decide to).

### The pending submission

If version 1.0.0 is already "Waiting for Review" with build 1, App Store Connect won't let you change the name, metadata or build until it is removed from review. Build 1 has no account deletion or demo mode, so it's likely to be rejected under guidelines 5.1.1(v) and 2.1. Removing it from review and resubmitting with build 2 is the usual fix, but that's your call.
