import { isFailedIcRedirectUrl, containsIcFailureMarkers } from "./loginSignals";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36";

export interface IcLoginResult {
  cookies: string;
  baseUrl: string;
  appName: string;
  displayName: string | null;
}

export class IcLoginError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function parseCookiePairs(setCookieValues: string[]): Map<string, string> {
  const jar = new Map<string, string>();
  for (const c of setCookieValues) {
    const pair = c.split(";")[0].trim();
    const splitIdx = pair.indexOf("=");
    if (splitIdx !== -1) {
      jar.set(pair.substring(0, splitIdx).trim(), pair.substring(splitIdx + 1).trim());
    }
  }
  return jar;
}

function getSetCookies(res: Response): string[] {
  if (typeof res.headers.getSetCookie === "function") return res.headers.getSetCookie();
  const raw = res.headers.get("set-cookie") ?? "";
  return raw ? raw.split(/,(?=\s*[A-Za-z0-9_-]+=)/) : [];
}

/**
 * Logs into an Infinite Campus district portal via its undocumented
 * verify.jsp endpoint and returns the resulting session cookie jar.
 *
 * Used by apps/web's /api/ic/auth route only — browsers need a
 * server-side proxy to avoid CORS. apps/mobile establishes its IC
 * session via a WebView against IC's real login page instead (see
 * apps/mobile/components/auth/IcLoginWebView.tsx), reusing the
 * isFailedIcRedirectUrl/containsIcFailureMarkers signals from
 * ./loginSignals to detect success/failure the same way.
 *
 * IC authentication flow:
 *   1. GET  <base>/portal/students/<appName>.jsp   — establishes a tenancy session
 *   2. POST <base>/verify.jsp                       — submits credentials, IC sets auth cookies
 *
 * Raw passwords are never persisted — only the resulting cookie string is
 * returned to the caller.
 */
export async function loginToIc(
  districtUrl: string,
  username: string,
  password: string,
  providedAppName?: string
): Promise<IcLoginResult> {
  const base = districtUrl.replace(/\/+$/, "");
  const appName = providedAppName || base.split("/").pop() || "campus";

  // 1. Initialize tenancy session
  const initRes = await fetch(`${base}/portal/students/${appName}.jsp`, {
    headers: { "User-Agent": USER_AGENT },
  });
  const cookieJar = parseCookiePairs(getSetCookies(initRes));
  const initCookieStr = Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");

  // 2. Submit credentials
  const formBody = new URLSearchParams();
  formBody.append("username", username);
  formBody.append("password", password);
  formBody.append("appName", appName);
  formBody.append("portalLoginPage", "students");
  formBody.append("portalUrl", `portal/students/${appName}.jsp`);
  formBody.append("url", "nav-wrapper");
  formBody.append("lang", "en");

  let icRes: Response;
  try {
    icRes = await fetch(`${base}/verify.jsp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
        Cookie: initCookieStr,
      },
      body: formBody.toString(),
      redirect: "manual",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error";
    throw new IcLoginError(`Could not reach Infinite Campus: ${msg}`, 502);
  }

  const location = icRes.headers.get("location") ?? "";
  if (isFailedIcRedirectUrl(location)) {
    throw new IcLoginError("Invalid username, password, or district setting.", 401);
  }

  if (icRes.status === 200) {
    const text = await icRes.text();
    if (containsIcFailureMarkers(text)) {
      throw new IcLoginError("Invalid username or password.", 401);
    }
  }

  // Merge verify cookies on top of the init jar (same key wins with the newer value)
  for (const c of getSetCookies(icRes)) {
    const pair = c.split(";")[0].trim();
    const splitIdx = pair.indexOf("=");
    if (splitIdx !== -1) {
      const key = pair.substring(0, splitIdx).trim();
      const val = pair.substring(splitIdx + 1).trim();
      const lowerKey = key.toLowerCase();
      if (key && lowerKey !== "path" && lowerKey !== "domain" && lowerKey !== "expires") {
        cookieJar.set(key, val);
      }
    }
  }
  // Always set appName to prevent IC's "conflicting app name values" error
  cookieJar.set("appName", appName);

  const cookies = Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
  if (!cookies) {
    throw new IcLoginError("Authenticated but could not extract session token.", 500);
  }

  // Best-effort: fetch the student profile for a display name
  let displayName: string | null = null;
  try {
    const profileRes = await fetch(`${base}/prism/api/portal/person`, {
      headers: { Cookie: cookies, Accept: "application/json" },
    });
    if (profileRes.ok) {
      const profile = await profileRes.json();
      displayName =
        profile?.data?.[0]?.formattedName ??
        profile?.firstName ??
        `${profile?.data?.[0]?.firstName ?? ""} ${profile?.data?.[0]?.lastName ?? ""}`.trim() ??
        null;
    }
  } catch {
    // Display name is optional; don't fail the whole flow
  }

  return { cookies, baseUrl: base, appName, displayName };
}
