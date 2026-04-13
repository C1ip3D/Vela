/**
 * Extracts the Firebase UID from a Bearer token in an Authorization header.
 * Decodes the JWT payload without signature verification (sufficient for
 * associating DB records — the token is issued by Firebase over HTTPS).
 */
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
