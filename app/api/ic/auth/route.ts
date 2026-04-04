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
  let body: { districtUrl?: string; username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { districtUrl, username, password } = body;

  if (!districtUrl || !username || !password) {
    return NextResponse.json(
      { error: "districtUrl, username, and password are required" },
      { status: 400 }
    );
  }

  // Normalise base URL (strip trailing slash)
  const base = districtUrl.replace(/\/+$/, "");

  // Build the IC verify endpoint
  const appName = base.split("/").pop() ?? "campus";
  const verifyUrl = `${base}/verify.jsp?nonBrowser=true&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&appName=${encodeURIComponent(appName)}`;

  let icRes: Response;
  try {
    icRes = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Vela Academic Navigator)",
      },
      redirect: "manual", // don't follow redirects — we need the cookies
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

  // A successful login always has a redirect and sets IC session cookies
  if (icRes.status !== 302 || !location || !setCookieHeader) {
    // Try parsing response body for an error message
    return NextResponse.json(
      {
        error:
          "Invalid username or password. Make sure you are using your Infinite Campus login.",
      },
      { status: 401 }
    );
  }

  // Extract ALL cookies to use as our short-lived token
  // This accounts for JSESSIONID, ICSID, campusTimezone, etc., across all IC versions.
  let cookiesArray: string[] = [];
  if (typeof icRes.headers.getSetCookie === "function") {
    cookiesArray = icRes.headers.getSetCookie();
  } else {
    // Fallback if getSetCookie is somehow not available
    const setCookieHeader = icRes.headers.get("set-cookie") ?? "";
    cookiesArray = setCookieHeader ? setCookieHeader.split(/,(?=\s*[A-Za-z0-9_-]+\=)/) : [];
  }

  // Map "cookie1=val1; Path=/; Secure" into "cookie1=val1"
  const authToken = cookiesArray
    .map((c) => c.split(";")[0].trim())
    .filter((c) => c && !c.toLowerCase().startsWith("path=") && !c.toLowerCase().startsWith("domain=") && !c.toLowerCase().startsWith("expires="))
    .join("; ");

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
  });
}
