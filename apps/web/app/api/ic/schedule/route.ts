import { NextRequest, NextResponse } from "next/server";
import { extractUid } from "@vela/auth";
import { prisma } from "@vela/db";
import { defaultsForHostname, getLocalParts } from "@vela/domain";
import { fetchSchedule, verifyIcDistrictHost, type IcSession } from "@vela/ic-client";

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
export async function POST(req: NextRequest) {
  const uid = await extractUid(req.headers.get("authorization"));
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { authToken?: string; baseUrl?: string; appName?: string; districtName?: string; stateCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { authToken, baseUrl, appName, districtName, stateCode } = body;
  if (!authToken || !baseUrl) {
    return NextResponse.json({ error: "authToken and baseUrl are required" }, { status: 400 });
  }

  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return NextResponse.json({ error: "Invalid baseUrl" }, { status: 400 });
  }
  if (!(await verifyIcDistrictHost(host, districtName, stateCode))) {
    return NextResponse.json({ error: "baseUrl is not a recognized Infinite Campus district." }, { status: 400 });
  }
  const defaults = defaultsForHostname(host);
  if (!defaults) {
    return NextResponse.json({ error: "Schedules aren't supported for this district yet. Add your classes manually." }, { status: 422 });
  }

  const user = await prisma.user.findUnique({ where: { firebaseUid: uid }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found. Load your courses first." }, { status: 404 });

  const session: IcSession = { cookies: authToken, baseUrl, appName: appName ?? "" };
  let entries;
  try {
    entries = await fetchSchedule(session, {
      today: getLocalParts(new Date(), defaults.timezone).dateKey,
      dayTypeDays: defaults.dayTypeDays,
    });
  } catch {
    return NextResponse.json({ error: "Session expired or unable to fetch schedule. Please log in again." }, { status: 401 });
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
      return NextResponse.json({ error: "Another sync is in progress. Try again." }, { status: 409 });
    }
  }

  return NextResponse.json({ count: entries.length });
}
