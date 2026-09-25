import { NextRequest, NextResponse } from "next/server";
import { IcLoginError, loginToIc, fetchPersonInfo, verifyIcDistrictHost } from "@vela/ic-client";
import { mintCustomTokenForIcIdentity } from "@vela/auth";
import { prisma } from "@vela/db";
import { districtHostnameFromBaseUrl } from "@/lib/syncIC";

/**
 * POST /api/ic/auth
 *
 * Proxies credentials to the Infinite Campus portal API, then — because
 * this route has just verified a *real* IC login server-side — mints a
 * Firebase custom token for the resulting identity. Raw passwords are
 * NEVER stored.
 *
 * Body: { districtUrl: string, username: string, password: string, appName?: string, districtName: string, stateCode: string }
 * - districtUrl: base URL of the district IC instance
 *   e.g. "https://dublinusd.infinitecampus.org/campus"
 * - districtName/stateCode: as returned by /api/ic/districts for this
 *   district — required to verify a districtUrl on a custom (non
 *   *.infinitecampus.org) domain against IC's own district-search API.
 */
export async function POST(req: NextRequest) {
  let body: {
    districtUrl?: string;
    username?: string;
    password?: string;
    appName?: string;
    districtName?: string;
    stateCode?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { districtUrl, username, password, appName, districtName, stateCode } = body;
  if (!districtUrl || !username || !password) {
    return NextResponse.json(
      { error: "districtUrl, username, and password are required" },
      { status: 400 }
    );
  }

  let districtHost: string;
  try {
    districtHost = new URL(districtUrl).hostname;
  } catch {
    return NextResponse.json({ error: "Invalid districtUrl" }, { status: 400 });
  }
  // Without this, a caller could point loginToIc/fetchPersonInfo at an
  // arbitrary server and get a Firebase custom token minted for a response
  // that was never actually verified against real IC infrastructure.
  if (!(await verifyIcDistrictHost(districtHost, districtName, stateCode))) {
    return NextResponse.json({ error: "districtUrl is not a recognized Infinite Campus district." }, { status: 400 });
  }

  let result;
  try {
    result = await loginToIc(districtUrl, username, password, appName);
  } catch (err) {
    if (err instanceof IcLoginError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error logging into Infinite Campus." }, { status: 500 });
  }

  const hostname = districtHostnameFromBaseUrl(result.baseUrl);
  // personId is the canonical identity anchor (shared with mobile); the
  // username-derived email is kept only as a fallback lookup so an
  // existing pre-migration account keeps resolving to the same uid.
  const legacyLookupEmail = `${username.toLowerCase()}@${hostname}.ic.vela.app`;

  let personId: string | null = null;
  let firebaseCustomToken: string | null = null;
  try {
    const person = await fetchPersonInfo({
      cookies: result.cookies,
      baseUrl: result.baseUrl,
      appName: result.appName,
    });
    const lookupEmail = person
      ? `${person.personId}@${hostname}.ic.vela.app`
      : legacyLookupEmail;
    personId = person?.personId ?? null;

    const minted = await mintCustomTokenForIcIdentity({
      lookupEmail,
      // Only offer the legacy fallback when we actually resolved a
      // *different* canonical email — no point looking up the same email
      // twice when fetchPersonInfo failed and we fell back to it directly.
      legacyLookupEmail: person ? legacyLookupEmail : undefined,
      displayName: result.displayName,
    });
    firebaseCustomToken = minted.customToken;

    // Best-effort backfill so a future mobile-first login for this same
    // person can find this account via icPersonId. Never blocks the login.
    if (personId) {
      await prisma.user
        .update({ where: { firebaseUid: minted.uid }, data: { icPersonId: personId } })
        .catch(() => {});
    }
  } catch (err) {
    console.error("[IC Auth] Firebase custom token mint failed:", err);
    return NextResponse.json(
      { error: "Signed into Infinite Campus, but could not complete Vela sign-in. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    authToken: result.cookies,
    baseUrl: result.baseUrl,
    appName: result.appName,
    displayName: result.displayName,
    personId,
    firebaseCustomToken,
  });
}
