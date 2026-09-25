import { NextRequest, NextResponse } from "next/server";
import { fetchPersonInfo, verifyIcDistrictHost } from "@vela/ic-client";
import { mintCustomTokenForIcIdentity } from "@vela/auth";
import { prisma } from "@vela/db";
import { districtHostnameFromBaseUrl } from "@/lib/syncIC";

/**
 * POST /api/ic/mint-token
 *
 * apps/mobile establishes its IC session directly against IC's own login
 * page in an on-device WebView (see
 * apps/mobile/components/auth/IcLoginWebView.tsx) — this backend never
 * observes that login. So before minting anything, this route re-verifies
 * the session mobile hands it by making a real call to the district's IC
 * server (fetchPersonInfo): forged or expired cookies simply fail that
 * call rather than getting a token minted off a bare client-side claim.
 *
 * Body: { cookies: string, baseUrl: string, appName: string, districtName: string, stateCode: string }
 * - districtName/stateCode: as returned by /api/ic/districts for this
 *   district — required to verify a baseUrl on a custom (non
 *   *.infinitecampus.org) domain against IC's own district-search API.
 */
export async function POST(req: NextRequest) {
  let body: {
    cookies?: string;
    baseUrl?: string;
    appName?: string;
    districtName?: string;
    stateCode?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { cookies, baseUrl, appName, districtName, stateCode } = body;
  if (!cookies || !baseUrl) {
    return NextResponse.json({ error: "cookies and baseUrl are required" }, { status: 400 });
  }

  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return NextResponse.json({ error: "Invalid baseUrl" }, { status: 400 });
  }
  // Without this, a caller could point fetchPersonInfo at an arbitrary
  // server and get a Firebase custom token minted for a response that was
  // never actually verified against real IC infrastructure.
  if (!(await verifyIcDistrictHost(host, districtName, stateCode))) {
    return NextResponse.json({ error: "baseUrl is not a recognized Infinite Campus district." }, { status: 400 });
  }

  const person = await fetchPersonInfo({ cookies, baseUrl, appName: appName ?? "" });
  if (!person) {
    return NextResponse.json({ error: "Could not verify your Infinite Campus session." }, { status: 401 });
  }

  const hostname = districtHostnameFromBaseUrl(baseUrl);
  const lookupEmail = `${person.personId}@${hostname}.ic.vela.app`;

  try {
    // Bridge for a student who originally signed up on web (username-keyed,
    // pre-unification) and is opening mobile for the first time: if a prior
    // post-fix web login already backfilled icPersonId for them, reuse that
    // exact account instead of minting a second, orphaned one.
    const linked = await prisma.user.findFirst({
      where: { icPersonId: person.personId, district: { hostname } },
      select: { firebaseUid: true },
    });

    const minted = await mintCustomTokenForIcIdentity({
      lookupEmail,
      knownUid: linked?.firebaseUid,
      displayName: person.displayName,
    });

    return NextResponse.json({
      firebaseCustomToken: minted.customToken,
      personId: person.personId,
      displayName: person.displayName,
    });
  } catch (err) {
    console.error("[IC Mint Token] Firebase custom token mint failed:", err);
    return NextResponse.json(
      { error: "Verified your Infinite Campus session, but could not complete Vela sign-in. Please try again." },
      { status: 500 }
    );
  }
}
