import { NextRequest, NextResponse } from "next/server";
import { extractUid } from "@vela/auth";
import { prisma } from "@vela/db";
import { fetchSchedule, verifyIcDistrictHost, type IcSession } from "@vela/ic-client";

/**
 * POST /api/ic/schedule
 *
 * Pulls the student's class schedule from Infinite Campus and replaces their
 * stored IC-sourced schedule entries. Requires a Vela auth token (the schedule
 * is persisted per user) and an existing User row (created by the courses sync).
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

  const user = await prisma.user.findUnique({ where: { firebaseUid: uid }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found. Load your courses first." }, { status: 404 });

  const session: IcSession = { cookies: authToken, baseUrl, appName: appName ?? "" };
  let entries;
  try {
    entries = await fetchSchedule(session);
  } catch {
    return NextResponse.json({ error: "Session expired or unable to fetch schedule. Please log in again." }, { status: 401 });
  }

  // Don't wipe a stored schedule just because IC returned nothing this time.
  if (entries.length > 0) {
    const cap = (v: string | null, n = 200) => (v == null ? null : v.slice(0, n));
    const seen = new Set<string>();
    const data = [];
    for (const e of entries.slice(0, 500)) {
      const key = [e.sectionId, e.period, e.dayType, e.termName, e.startDate].join("\u0000");
      if (seen.has(key)) continue;
      seen.add(key);
      data.push({
        sectionId: e.sectionId.slice(0, 100),
        courseName: e.courseName.slice(0, 200),
        teacher: cap(e.teacher),
        room: cap(e.room, 100),
        period: e.period.slice(0, 50),
        dayType: e.dayType.slice(0, 50),
        termName: cap(e.termName, 100),
        startDate: e.startDate,
        endDate: e.endDate,
        userId: user.id,
        source: "INFINITE_CAMPUS" as const,
      });
    }
    try {
      await prisma.$transaction(
        [
          prisma.scheduleEntry.deleteMany({ where: { userId: user.id, source: "INFINITE_CAMPUS" } }),
          prisma.scheduleEntry.createMany({ data }),
        ],
        { isolationLevel: "Serializable" }
      );
    } catch {
      // A concurrent sync won the race; its result is equivalent.
      return NextResponse.json({ error: "Another sync is in progress. Try again." }, { status: 409 });
    }
  }

  return NextResponse.json({ count: entries.length });
}
