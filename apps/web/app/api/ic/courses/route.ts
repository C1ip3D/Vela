import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader } from "@vela/auth";
import { fetchCourses, type IcSession } from "@vela/ic-client";
import { syncICCoursesToDB, getCachedCourses, districtHostnameFromBaseUrl } from "@/lib/syncIC";

/**
 * POST /api/ic/courses
 *
 * Fetches the student's active courses and current grades from Infinite
 * Campus (via @vela/ic-client, trying its known endpoints in order) and
 * syncs them to the DB. Serves from the DB cache when available, refreshing
 * in the background if the cache is stale.
 *
 * Body: { authToken: string, baseUrl: string, appName?: string }
 */
export async function POST(req: NextRequest) {
  let body: { authToken?: string; baseUrl?: string; appName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { authToken, baseUrl, appName } = body;
  if (!authToken || !baseUrl) {
    return NextResponse.json({ error: "authToken and baseUrl are required" }, { status: 400 });
  }

  const claims = await verifyAuthHeader(req.headers.get("authorization"));
  const session: IcSession = { cookies: authToken, baseUrl, appName: appName ?? "" };
  const districtHostname = districtHostnameFromBaseUrl(baseUrl);

  const syncInBackground = async () => {
    if (!claims) return;
    try {
      const courses = await fetchCourses(session);
      if (courses.length > 0) {
        await syncICCoursesToDB(claims.uid, claims.email ?? "", claims.displayName ?? claims.email ?? "", districtHostname, courses);
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
    await syncICCoursesToDB(claims.uid, claims.email ?? "", claims.displayName ?? claims.email ?? "", districtHostname, courses).catch(
      (e: unknown) => console.error("[IC Courses] DB sync error:", e)
    );
  }

  return NextResponse.json({ courses, source: "ic" });
}
