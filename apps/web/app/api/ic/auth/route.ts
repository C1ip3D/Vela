import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/ic/auth
 *
 * Proxies credentials to the Infinite Campus portal API and returns a
 * short-lived authToken. Raw passwords are NEVER stored.
 *
 * Body: { districtUrl: string, username: string, password: string }
 * - districtUrl: base URL of the district IC instance
 *   e.g. "https://dublinusd.infinitecampus.org/campus"
 *   (trailing slash is fine — we normalise it)
 *
 * Infinite Campus authentication endpoint (undocumented mobile/web API):
 *   POST <base>/verify.jsp
 *   Form-encoded: username=<u>&password=<p>&appName=<appName>&url=<url>
 *
 * On success the response sets an IC auth cookie (ICSID / X-IC-Authorization).
 * We extract it and return it to the client as authToken.
 */

export async function POST(req: NextRequest) {
  let body: { districtUrl?: string; username?: string; password?: string; appName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { districtUrl, username, password, appName: providedAppName } = body;

  if (!districtUrl || !username || !password) {
    return NextResponse.json(
      { error: "districtUrl, username, and password are required" },
      { status: 400 }
    );
  }

  // Normalise base URL (strip trailing slash)
  const base = districtUrl.replace(/\/+$/, "");

  const appName = providedAppName || base.split("/").pop() || "campus";
  
  // Initialize Tenancy Session (CRITICAL FOR DUBLIN UNIFIED)
  const initRes = await fetch(`${base}/portal/students/${appName}.jsp`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36" }
  });
  const initCookies = typeof initRes.headers.getSetCookie === "function" ? initRes.headers.getSetCookie() : initRes.headers.get("set-cookie")?.split(/,(?=\s*[A-Za-z0-9_-]+\=)/) || [];

  // Parse init cookies into a map so they can be merged with verify cookies later
  const cookieJar = new Map<string, string>();
  for (const c of initCookies) {
    const pair = c.split(";")[0].trim();
    const splitIdx = pair.indexOf("=");
    if (splitIdx !== -1) {
      cookieJar.set(pair.substring(0, splitIdx).trim(), pair.substring(splitIdx + 1).trim());
    }
  }
  const initCookieStr = Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");

  const verifyUrl = `${base}/verify.jsp`;
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
    console.log(`[IC Auth Debug] verifyUrl (POST): ${verifyUrl}`);
    icRes = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36",
        "Cookie": initCookieStr
      },
      body: formBody.toString(),
      redirect: "manual",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error";
    return NextResponse.json(
      { error: `Could not reach Infinite Campus: ${msg}` },
      { status: 502 }
    );
  }

  // IC returns a redirect (302) on success, with the auth cookie
  // It returns 200 with an error page on bad credentials
  const setCookieHeader = icRes.headers.get("set-cookie") ?? "";
  const location = icRes.headers.get("location") ?? "";
  
  console.log("[IC Auth Debug] Response status:", icRes.status);
  console.log("[IC Auth Debug] Location header:", location);
  console.log("[IC Auth Debug] SetCookie length:", setCookieHeader.length);

  const locLower = location.toLowerCase();
  
  // In standard POST login, success is usually a 302 redirecting to portal/parents.jsp or portal/students.jsp
  // Or it might be a 200 OK if it doesn't redirect. We can check if cookies contain XSRF-TOKEN or similar.
  const isFailedRedirect = locLower.includes("error") || locLower.includes("failed") || locLower.includes("verify.jsp") || locLower.includes("login") || locLower.includes("noappname");

  console.log(`[IC Auth Debug] Response status: ${icRes.status}`);
  console.log(`[IC Auth Debug] Location header: ${location}`);
  console.log(`[IC Auth Debug] SetCookie length: ${setCookieHeader.length}`);
  console.log(`[IC Auth Debug] isFailedRedirect: ${isFailedRedirect}`);

  // If it redirected back to login or threw an error
  if (isFailedRedirect) {
    return NextResponse.json(
      { error: "Invalid username, password, or district setting." },
      { status: 401 }
    );
  }
  
  // If it's a 200 OK, it might be the login page again (failure).
  if (icRes.status === 200) {
    const text = await icRes.text();
    // If the page contains a standard error message
    if (text.includes("username and/or password") || text.includes("error in the application") || text.includes("signinForm")) {
       return NextResponse.json(
         { error: "Invalid username or password." },
         { status: 401 }
       );
    }
  }

  // Extract verify cookies and merge them on top of the init cookie jar.
  // IC expects the full accumulated browser cookie jar — both the initial session
  // cookies (JSESSIONID, tenancy cookies) AND the auth cookies from verify.jsp.
  let verifyCookies: string[] = [];
  if (typeof icRes.headers.getSetCookie === "function") {
    verifyCookies = icRes.headers.getSetCookie();
  } else {
    const raw = icRes.headers.get("set-cookie") ?? "";
    verifyCookies = raw ? raw.split(/,(?=\s*[A-Za-z0-9_-]+\=)/) : [];
  }

  // Merge: verify cookies override init cookies (same key wins with newer value)
  for (const c of verifyCookies) {
    const pair = c.split(";")[0].trim();
    const splitIdx = pair.indexOf("=");
    if (splitIdx !== -1) {
      const key = pair.substring(0, splitIdx).trim();
      const val = pair.substring(splitIdx + 1).trim();
      if (key && !key.toLowerCase().startsWith("path") && !key.toLowerCase().startsWith("domain") && !key.toLowerCase().startsWith("expires")) {
        cookieJar.set(key, val);
      }
    }
  }

  // Always ensure appName cookie is set to prevent IC "conflicting app name values" errors
  if (appName) cookieJar.set("appName", appName);

  const authToken = Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
  console.log(`[IC Auth Debug] Final cookie jar keys: ${Array.from(cookieJar.keys()).join(", ")}`);

  if (!authToken) {
    return NextResponse.json(
      { error: "Authenticated but could not extract session token." },
      { status: 500 }
    );
  }

  // Optionally: fetch the student profile to get a display name
  let displayName: string | null = null;
  try {
    const profileRes = await fetch(`${base}/prism/api/portal/person`, {
      headers: {
        Cookie: authToken,
        Accept: "application/json",
      },
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

  return NextResponse.json({
    authToken,
    baseUrl: base,
    displayName,
    appName,
  });
}
