import { NextRequest, NextResponse } from "next/server";
import { fetchAssignments, verifyIcDistrictHost, type IcSession } from "@vela/ic-client";

/**
 * POST /api/ic/assignments
 *
 * Fetches detailed assignments for a specific course from Infinite Campus,
 * via @vela/ic-client (the same client apps/mobile uses directly).
 *
 * Body: { authToken: string, baseUrl: string, courseId: string, appName?: string, districtName?: string, stateCode?: string }
 * - districtName/stateCode: as returned by /api/ic/districts for this
 *   district — required to verify a baseUrl on a custom (non
 *   *.infinitecampus.org) domain against IC's own district-search API.
 */
export async function POST(req: NextRequest) {
  let body: {
    authToken?: string;
    baseUrl?: string;
    appName?: string;
    courseId?: string;
    districtName?: string;
    stateCode?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { authToken, baseUrl, appName, courseId, districtName, stateCode } = body;
  if (!authToken || !baseUrl || !courseId) {
    return NextResponse.json(
      { error: "authToken, baseUrl, and courseId are required" },
      { status: 400 }
    );
  }

  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return NextResponse.json({ error: "Invalid baseUrl" }, { status: 400 });
  }
  // Without this, a caller could point fetchAssignments at an arbitrary
  // server — this route allows unauthenticated callers through, so it's
  // reachable without any auth token.
  if (!(await verifyIcDistrictHost(host, districtName, stateCode))) {
    return NextResponse.json({ error: "baseUrl is not a recognized Infinite Campus district." }, { status: 400 });
  }

  const session: IcSession = { cookies: authToken, baseUrl, appName: appName ?? "" };

  try {
    const groups = await fetchAssignments(session, courseId);
    return NextResponse.json({ groups, source: groups.length > 0 ? "ic" : "none" });
  } catch {
    return NextResponse.json(
      { error: "Session expired or could not reach Infinite Campus. Please reconnect in Settings." },
      { status: 401 }
    );
  }
}
