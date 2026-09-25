import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth, type UserRecord } from "firebase-admin/auth";

// This is the ONE file in the app that uses the Firebase Admin SDK / a
// service-account key. Everything in index.ts deliberately avoids it
// (ID-token verification uses public JWKS instead, no admin key required).
// Keeping this boundary in its own file makes it easy to audit what
// actually needs the admin key and what doesn't.
//
// IMPORTANT: the service-account key must be read from a var WITHOUT the
// NEXT_PUBLIC_ prefix. Every existing Firebase var in this repo uses that
// prefix (see apps/web/lib/firebase.ts), and Next.js inlines anything with
// that prefix into the client bundle — using it here would ship the
// service-account key to every browser.
let adminApp: App | null = null;

function getAdminApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps();
  if (existing.length > 0) {
    adminApp = existing[0];
    return adminApp;
  }

  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!encoded) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 is not configured; cannot mint Firebase custom tokens."
    );
  }

  let serviceAccount: object;
  try {
    serviceAccount = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 is not valid base64-encoded JSON.");
  }

  adminApp = initializeApp({ credential: cert(serviceAccount) });
  return adminApp;
}

export interface MintCustomTokenParams {
  /** The canonical (IC personId-based) lookup email for this identity. */
  lookupEmail: string;
  /**
   * A legacy (IC username-based) lookup email to fall back to when no
   * account exists yet under `lookupEmail` — lets an existing
   * pre-migration account keep resolving to the same uid instead of
   * getting a second, orphaned one created alongside it. Only web can
   * supply this (it has the username in hand); mobile's WebView login
   * flow never learns the raw IC username by design.
   */
  legacyLookupEmail?: string;
  /**
   * A uid already resolved through some other means (e.g. a DB lookup
   * keyed on icPersonId) — when given, mint directly for this uid and
   * skip the Firebase user lookup/creation entirely.
   */
  knownUid?: string;
  displayName?: string | null;
}

export interface MintCustomTokenResult {
  customToken: string;
  uid: string;
}

/**
 * Mints a Firebase custom token for a verified Infinite Campus identity.
 *
 * Callers MUST have already verified a real IC login server-side (see
 * apps/web/app/api/ic/auth and apps/web/app/api/ic/mint-token) — this
 * function does no verification of its own. It only maps a
 * already-verified identity onto a Firebase uid (reusing an existing
 * account when one exists, so this is a no-op migration for anyone who
 * already had one) and signs a short-lived token for the client to
 * exchange via signInWithCustomToken().
 */
export async function mintCustomTokenForIcIdentity(
  params: MintCustomTokenParams
): Promise<MintCustomTokenResult> {
  const { lookupEmail, legacyLookupEmail, knownUid, displayName } = params;
  const auth = getAuth(getAdminApp());

  if (knownUid) {
    // Best-effort hygiene only — never let this block sign-in.
    void auth.updateUser(knownUid, { email: lookupEmail }).catch(() => {});
    const customToken = await auth.createCustomToken(knownUid);
    return { customToken, uid: knownUid };
  }

  const existing = await findUserByEmail(auth, lookupEmail);
  if (existing) {
    const customToken = await auth.createCustomToken(existing.uid);
    return { customToken, uid: existing.uid };
  }

  if (legacyLookupEmail) {
    const legacy = await findUserByEmail(auth, legacyLookupEmail);
    if (legacy) {
      // One-time migration: point the account at its new canonical email
      // so future logins resolve via `lookupEmail` directly.
      await auth.updateUser(legacy.uid, { email: lookupEmail }).catch(() => {});
      const customToken = await auth.createCustomToken(legacy.uid);
      return { customToken, uid: legacy.uid };
    }
  }

  try {
    const created = await auth.createUser({
      email: lookupEmail,
      displayName: displayName || undefined,
      emailVerified: true,
    });
    const customToken = await auth.createCustomToken(created.uid);
    return { customToken, uid: created.uid };
  } catch (err: unknown) {
    // Two near-simultaneous first-time logins (e.g. web+mobile racing, or a
    // double-tap) can both miss the lookups above and both call createUser.
    // Firebase enforces email uniqueness, so the loser gets this error
    // rather than silently creating a duplicate — retry the lookup once.
    if (isFirebaseErrorCode(err, "auth/email-already-exists")) {
      const winner = await findUserByEmail(auth, lookupEmail);
      if (winner) {
        const customToken = await auth.createCustomToken(winner.uid);
        return { customToken, uid: winner.uid };
      }
    }
    throw new Error("Could not create or resolve the Firebase account for this student.");
  }
}

async function findUserByEmail(auth: Auth, email: string): Promise<UserRecord | null> {
  try {
    return await auth.getUserByEmail(email);
  } catch (err: unknown) {
    if (isFirebaseErrorCode(err, "auth/user-not-found")) return null;
    throw err;
  }
}

function isFirebaseErrorCode(err: unknown, code: string): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === code;
}
