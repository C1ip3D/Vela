// TODO(rewrite phase 2, security fix): replace this with firebase-admin's
// verifyIdToken. The current implementation decodes the JWT payload WITHOUT
// verifying its signature, so any base64-shaped blob can impersonate any
// Firebase UID and read/write another student's grades, GPA, and advisor
// logs. Ported as-is from apps/web/lib/authToken.ts so nothing breaks while
// the rest of the monorepo is scaffolded; do not ship this as-is.
export function extractUid(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    return parsed.user_id ?? parsed.sub ?? null;
  } catch {
    return null;
  }
}
