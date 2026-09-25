import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader } from "@vela/auth";
import { fetchCourses, verifyIcDistrictHost, type IcSession } from "@vela/ic-client";
import { syncICCoursesToDB, getCachedCourses, districtHostnameFromBaseUrl } from "@/lib/syncIC";

/**
 * POST /api/ic/courses
 *
 * Fetches the student's active courses and current grades from Infinite
 * Campus (via @vela/ic-client, trying its known endpoints in order) and
 * syncs them to the DB. Serves from the DB cache when available, refreshing
 * in the background if the cache is stale.
 *
 * Body: { authToken: string, baseUrl: string, appName?: string, districtName?: string, stateCode?: string }
 * - districtName/stateCode: as returned by /api/ic/districts for this
 *   district — required to verify a baseUrl on a custom (non
 *   *.infinitecampus.org) domain against IC's own district-search API.
 */
export async function POST(req: NextRequest) {
  let body: {
    authToken?: string;
    baseUrl?: string;
    appName?: string;
    personId?: string;
    districtName?: string;
    stateCode?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { authToken, baseUrl, appName, personId, districtName, stateCode } = body;
  if (!authToken || !baseUrl) {
    return NextResponse.json({ error: "authToken and baseUrl are required" }, { status: 400 });
  }

  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return NextResponse.json({ error: "Invalid baseUrl" }, { status: 400 });
  }
  // Without this, a caller could point fetchCourses at an arbitrary server
  // — this route allows unauthenticated callers through, so it's reachable
  // without any auth token.
  if (!(await verifyIcDistrictHost(host, districtName, stateCode))) {
    return NextResponse.json({ error: "baseUrl is not a recognized Infinite Campus district." }, { status: 400 });
  }

  const claims = await verifyAuthHeader(req.headers.get("authorization"));
  const session: IcSession = { cookies: authToken, baseUrl, appName: appName ?? "" };
  const districtHostname = districtHostnameFromBaseUrl(baseUrl);

  const syncInBackground = async () => {
    if (!claims) return;
    try {
      const courses = await fetchCourses(session);
      if (courses.length > 0) {
        await syncICCoursesToDB(claims.uid, claims.email ?? "", claims.displayName ?? claims.email ?? "", districtHostname, courses, personId);
      }
    } catch (e) {
      console.error("[IC Courses] Background sync error:", e);
    }
  };

  if (claims) {
    const cached = await getCachedCourses(claims.uid);
    if (cached) {
      if (cached.isStale) {
        const response = NextResponse.json({ courses: cached.courses, source: "cache" });
        syncInBackground(); // fire-and-forget
        return response;
      }
      return NextResponse.json({ courses: cached.courses, source: "cache" });
    }
  }

  let courses;
  try {
    courses = await fetchCourses(session);
  } catch {
    return NextResponse.json(
      { error: "Session expired or unable to fetch grades. Please log in again." },
      { status: 401 }
    );
  }

  if (claims && courses.length > 0) {
    await syncICCoursesToDB(claims.uid, claims.email ?? "", claims.displayName ?? claims.email ?? "", districtHostname, courses, personId).catch(
      (e: unknown) => console.error("[IC Courses] DB sync error:", e)
    );
  }

  return NextResponse.json({ courses, source: "ic" });
}
