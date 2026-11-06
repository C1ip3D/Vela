import { Hono } from "hono";
import { verifyAuthHeader, extractUid, mintCustomTokenForIcIdentity } from "@vela/auth";
import { defaultsForHostname, getLocalParts } from "@vela/domain";
import { fetchCourses, fetchPersonInfo, fetchSchedule, verifyIcDistrictHost, type IcSession } from "@vela/ic-client";
import { prisma } from "@vela/db";
import { syncICCoursesToDB, getCachedCourses, districtHostnameFromBaseUrl } from "../lib/syncIC";

export const ic = new Hono();

/**
 * POST /api/ic/mint-token
 *
 * apps/mobile establishes its IC session directly against IC's own login
 * page in an on-device WebView — this backend never observes that login.
 * So before minting anything, this route re-verifies the session mobile
 * hands it by making a real call to the district's IC server
 * (fetchPersonInfo): forged or expired cookies simply fail that call rather
 * than getting a token minted off a bare client-side claim.
 *
 * Body: { cookies, baseUrl, appName, districtName, stateCode }
 * - districtName/stateCode: required to verify a baseUrl on a custom (non
 *   *.infinitecampus.org) domain against IC's own district-search API.
 */
ic.post("/mint-token", async (c) => {
  let body: {
    cookies?: string;
    baseUrl?: string;
    appName?: string;
    districtName?: string;
    stateCode?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { cookies, baseUrl, appName, districtName, stateCode } = body;
  if (!cookies || !baseUrl) {
    return c.json({ error: "cookies and baseUrl are required" }, 400);
  }

  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return c.json({ error: "Invalid baseUrl" }, 400);
  }
  // Without this, a caller could point fetchPersonInfo at an arbitrary
  // server and get a Firebase custom token minted for a response that was
  // never actually verified against real IC infrastructure.
  if (!(await verifyIcDistrictHost(host, districtName, stateCode))) {
    return c.json({ error: "baseUrl is not a recognized Infinite Campus district." }, 400);
  }

  const person = await fetchPersonInfo({ cookies, baseUrl, appName: appName ?? "" });
  if (!person) {
    return c.json({ error: "Could not verify your Infinite Campus session." }, 401);
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

    return c.json({
      firebaseCustomToken: minted.customToken,
      personId: person.personId,
      displayName: person.displayName,
    });
  } catch (err) {
    console.error("[IC Mint Token] Firebase custom token mint failed:", err);
    return c.json(
      { error: "Verified your Infinite Campus session, but could not complete Vela sign-in. Please try again." },
      500
    );
  }
});

/**
 * POST /api/ic/courses
 *
 * Fetches the student's active courses and current grades from Infinite
 * Campus (via @vela/ic-client) and syncs them to the DB. Serves from the DB
 * cache when available, refreshing in the background if the cache is stale.
 *
 * Body: { authToken, baseUrl, appName?, personId?, districtName?, stateCode? }
 */
ic.post("/courses", async (c) => {
  let body: {
    authToken?: string;
    baseUrl?: string;
    appName?: string;
    personId?: string;
    districtName?: string;
    stateCode?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { authToken, baseUrl, appName, personId, districtName, stateCode } = body;
  if (!authToken || !baseUrl) {
    return c.json({ error: "authToken and baseUrl are required" }, 400);
  }

  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return c.json({ error: "Invalid baseUrl" }, 400);
  }
  // Without this, a caller could point fetchCourses at an arbitrary server
  // — this route allows unauthenticated callers through, so it's reachable
  // without any auth token.
  if (!(await verifyIcDistrictHost(host, districtName, stateCode))) {
    return c.json({ error: "baseUrl is not a recognized Infinite Campus district." }, 400);
  }

  const claims = await verifyAuthHeader(c.req.header("authorization") ?? null);
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
      if (cached.isStale) void syncInBackground(); // fire-and-forget
      return c.json({ courses: cached.courses, source: "cache" });
    }
  }

  let courses;
  try {
    courses = await fetchCourses(session);
  } catch {
    return c.json({ error: "Session expired or unable to fetch grades. Please log in again." }, 401);
  }

  if (claims && courses.length > 0) {
    await syncICCoursesToDB(claims.uid, claims.email ?? "", claims.displayName ?? claims.email ?? "", districtHostname, courses, personId).catch(
      (e: unknown) => console.error("[IC Courses] DB sync error:", e)
    );
  }

  return c.json({ courses, source: "ic" });
});

/**
 * POST /api/ic/schedule
 *
 * Pulls the student's class schedule from Infinite Campus and replaces their
 * stored IC-sourced entries. Needs a Vela auth token (the schedule is stored
 * per user) and an existing User row (created by the courses sync). Only
 * districts with a known day-type mapping (see defaultsForHostname) are supported.
 *
 * Body: { authToken, baseUrl, appName?, districtName?, stateCode? }
 */
ic.post("/schedule", async (c) => {
  const uid = await extractUid(c.req.header("authorization") ?? null);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);

  let body: { authToken?: string; baseUrl?: string; appName?: string; districtName?: string; stateCode?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const { authToken, baseUrl, appName, districtName, stateCode } = body;
  if (!authToken || !baseUrl) {
    return c.json({ error: "authToken and baseUrl are required" }, 400);
  }

  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return c.json({ error: "Invalid baseUrl" }, 400);
  }
  if (!(await verifyIcDistrictHost(host, districtName, stateCode))) {
    return c.json({ error: "baseUrl is not a recognized Infinite Campus district." }, 400);
  }
  const defaults = defaultsForHostname(host);
  if (!defaults) {
    return c.json({ error: "Schedules aren't supported for this district yet. Add your classes manually." }, 422);
  }

  const user = await prisma.user.findUnique({ where: { firebaseUid: uid }, select: { id: true } });
  if (!user) return c.json({ error: "User not found. Load your courses first." }, 404);

  const session: IcSession = { cookies: authToken, baseUrl, appName: appName ?? "" };
  let entries;
  try {
    entries = await fetchSchedule(session, {
      today: getLocalParts(new Date(), defaults.timezone).dateKey,
      dayTypeDays: defaults.dayTypeDays,
    });
  } catch {
    return c.json({ error: "Session expired or unable to fetch schedule. Please log in again." }, 401);
  }

  // Don't wipe a stored schedule just because IC returned nothing this time.
  if (entries.length > 0) {
    const cap = (v: string | undefined, n: number) => (v ? v.slice(0, n) : null);
    const data = entries.slice(0, 50).map((e) => ({
      userId: user.id,
      period: e.period.slice(0, 50),
      courseName: e.courseName.slice(0, 200),
      teacher: cap(e.teacher, 200),
      room: cap(e.room, 100),
      days: (e.days ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
      term: cap(e.term, 100),
      source: "INFINITE_CAMPUS" as const,
    }));
    try {
      await prisma.$transaction(
        [
          prisma.scheduleEntry.deleteMany({ where: { userId: user.id, source: "INFINITE_CAMPUS" } }),
          prisma.scheduleEntry.createMany({ data }),
        ],
        { isolationLevel: "Serializable" }
      );
    } catch {
      return c.json({ error: "Another sync is in progress. Try again." }, 409);
    }
  }

  return c.json({ count: entries.length });
});
