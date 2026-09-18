import { NextRequest, NextResponse } from "next/server";
import { IcLoginError, loginToIc } from "@vela/ic-client";

/**
 * POST /api/ic/auth
 *
 * Proxies credentials to the Infinite Campus portal API and returns a
 * short-lived authToken (the session cookie jar). Raw passwords are NEVER
 * stored.
 *
 * Body: { districtUrl: string, username: string, password: string, appName?: string }
 * - districtUrl: base URL of the district IC instance
 *   e.g. "https://dublinusd.infinitecampus.org/campus"
 */
export async function POST(req: NextRequest) {
  let body: { districtUrl?: string; username?: string; password?: string; appName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { districtUrl, username, password, appName } = body;
  if (!districtUrl || !username || !password) {
    return NextResponse.json(
      { error: "districtUrl, username, and password are required" },
      { status: 400 }
    );
  }

  try {
    const result = await loginToIc(districtUrl, username, password, appName);
    return NextResponse.json({
      authToken: result.cookies,
      baseUrl: result.baseUrl,
      appName: result.appName,
      displayName: result.displayName,
    });
  } catch (err) {
    if (err instanceof IcLoginError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error logging into Infinite Campus." }, { status: 500 });
  }
}
