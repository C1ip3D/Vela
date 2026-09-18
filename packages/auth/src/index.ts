import { createRemoteJWKSet, jwtVerify } from "jose";

// Verifies Firebase ID tokens against Google's public signing keys — the
// same mechanism firebase-admin's verifyIdToken() uses internally — without
// requiring a service-account key. See:
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

function getProjectId(): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not configured; cannot verify Firebase ID tokens.");
  }
  return projectId;
}

export interface VerifiedClaims {
  uid: string;
  email: string | null;
  displayName: string | null;
}

/**
 * Verifies the Bearer token in an Authorization header and returns its
 * claims, or null if the header is missing, malformed, or the token's
 * signature/claims don't check out.
 *
 * Unlike a bare JWT payload decode, this actually validates the signature
 * (RS256 against Google's rotating public keys) plus issuer, audience, and
 * expiry — so a caller can no longer impersonate an arbitrary UID (or forge
 * an email/name) by handing us a base64-shaped blob.
 */
export async function verifyAuthHeader(authHeader: string | null): Promise<VerifiedClaims | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const projectId = getProjectId();

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    const uid = payload.user_id ?? payload.sub;
    if (typeof uid !== "string" || uid.length === 0) return null;
    return {
      uid,
      email: typeof payload.email === "string" ? payload.email : null,
      displayName: typeof payload.name === "string" ? payload.name : null,
    };
  } catch {
    return null;
  }
}

/** Convenience wrapper for callers that only need the UID. */
export async function extractUid(authHeader: string | null): Promise<string | null> {
  const claims = await verifyAuthHeader(authHeader);
  return claims?.uid ?? null;
}
