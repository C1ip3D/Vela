# Plan: Push Notifications for Grade Changes

## Context

The user wants mobile push notifications triggered when:

1. A course that was previously ungraded receives a grade (null → value)
2. An existing course grade changes (e.g. assignment gets graded, updating the overall course %)

Delivery: Expo Push Notifications (no Firebase Cloud Messaging config needed).

Currently, `syncICCoursesToDB` in `lib/syncIC.ts` writes a `GradeHistory` row on every IC sync but does nothing with the previous record. The `AdvisorLog` model exists for storing alerts. The User model has no push token field. The mobile app has no `expo-notifications` installed.

---

## Implementation Steps

### 1. Prisma schema — add push token field

**File:** `prisma/schema.prisma`

- Add `expoPushToken String?` to the `User` model
- Run `npx prisma migrate dev --name add_expo_push_token`
- Run `npx prisma generate`

### 2. Backend — push notification utility

**New file:** `lib/pushNotifications.ts`

- Install `expo-server-sdk` on backend: `npm install expo-server-sdk`
- Export `sendPushNotification(expoPushToken: string, title: string, body: string, data?: object)`
- Use `Expo` class from `expo-server-sdk`, handle ticket errors and receipts

### 3. Backend — token registration API

**File:** `app/api/notifications/register/route.ts` (directory already exists, is empty)

- `POST` handler, requires `Authorization: Bearer <firebase-token>`
- Body: `{ expoPushToken: string }`
- Uses `extractUid` from `lib/authToken.ts` to get uid
- Upserts `expoPushToken` on the `User` record via Prisma

### 4. Backend — grade change detection in sync

**File:** `lib/syncIC.ts` — modify `syncICCoursesToDB`

Before writing the new `GradeHistory` row for each course, fetch the most recent previous record:

```ts
const prev = await prisma.gradeHistory.findFirst({
  where: { userId: user.id, courseId: course.id },
  orderBy: { recordedAt: "desc" },
});
```

After writing the new record, compare:

- `prev === null && newGrade !== null` → "New grade posted" notification
- `prev !== null && Math.abs(prev.percentageGrade - newGrade) >= 1` → "Grade updated" notification

If notification warranted and `user.expoPushToken` exists, call `sendPushNotification`.

Notification copy:

- New grade: `"📊 New grade in {courseName}"` / `"You received {grade}% in {courseName}"`
- Grade change: `"📈 Grade updated in {courseName}"` / `"Your grade changed to {newGrade}% (was {prevGrade}%)"`

Also write an `AdvisorLog` row for in-app history.

### 5. Mobile — install and configure expo-notifications

**Directory:** `mobile/`

- `npx expo install expo-notifications`
- Add `expo-notifications` plugin to `mobile/app.json` plugins array

### 6. Mobile — request permissions and register token

**File:** `mobile/contexts/AuthContext.tsx` (or a new `mobile/hooks/usePushNotifications.ts`)

- On user login/mount, call `Notifications.requestPermissionsAsync()`
- If granted, call `Notifications.getExpoPushTokenAsync({ projectId: <EAS project ID> })`
- POST token to `/api/notifications/register` with Firebase auth header
- Store token in AsyncStorage to avoid re-registering on every launch

### 7. Mobile — notification listener

**File:** `mobile/app/_layout.tsx` (root layout)

- Add `Notifications.addNotificationReceivedListener` — shows in-app toast or badge
- Add `Notifications.addNotificationResponseReceivedListener` — navigate to courses tab on tap

---

## Critical Files

- `prisma/schema.prisma` — add `expoPushToken`
- `lib/syncIC.ts` — grade change detection + trigger
- `lib/pushNotifications.ts` — new Expo push sender
- `app/api/notifications/register/route.ts` — token registration
- `mobile/app.json` — add expo-notifications plugin
- `mobile/contexts/AuthContext.tsx` — token registration on login
- `mobile/app/_layout.tsx` — notification listeners

## Reuse

- `extractUid` from `lib/authToken.ts` — auth for register endpoint
- `prisma` client from `lib/db.ts`
- Existing `AdvisorLog` model for in-app alert storage

## Verification

1. Run `npx prisma migrate dev` — schema valid, no errors
2. Log into mobile app → check Neon DB for `expoPushToken` on User row
3. Trigger an IC sync → confirm `GradeHistory` comparison runs, log fires
4. Use Expo push tool (https://expo.dev/notifications) to test token receives a message
5. Change a test grade in IC → confirm push arrives on device within the next sync
