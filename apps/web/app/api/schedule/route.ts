import { NextRequest, NextResponse } from "next/server";
import { extractUid } from "@vela/auth";
import { prisma } from "@vela/db";
import { defaultsForHostname } from "@vela/domain";
import { parseBellSchedules } from "@/lib/bellValidation";

/**
 * GET /api/schedule — the signed-in student's classes plus the bell schedules
 * to use: their own if saved, else their district's preset, else none.
 */
export async function GET(req: NextRequest) {
  const uid = await extractUid(req.headers.get("authorization"));
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { firebaseUid: uid },
    select: { id: true, district: { select: { hostname: true } }, bellConfig: { select: { schedules: true } } },
  });
  if (!user) return NextResponse.json({ entries: [], bells: [], bellsSource: "none" });

  const rows = await prisma.scheduleEntry.findMany({
    where: { userId: user.id },
    select: { period: true, courseName: true, teacher: true, room: true, days: true, term: true, source: true },
  });
  const entries = rows.map((r) => ({
    period: r.period,
    courseName: r.courseName,
    ...(r.teacher ? { teacher: r.teacher } : {}),
    ...(r.room ? { room: r.room } : {}),
    days: r.days,
    ...(r.term ? { term: r.term } : {}),
    source: r.source === "INFINITE_CAMPUS" ? "ic" : r.source === "UPLOAD" ? "upload" : "manual",
  }));

  // Stored JSON is re-validated on the way out so a bad row can't break clients.
  const custom = user.bellConfig ? parseBellSchedules(user.bellConfig.schedules) : null;
  if (custom?.ok) return NextResponse.json({ entries, bells: custom.value, bellsSource: "custom" });

  const preset = defaultsForHostname(user.district?.hostname);
  if (preset) return NextResponse.json({ entries, bells: preset.bells, bellsSource: "preset" });
  return NextResponse.json({ entries, bells: [], bellsSource: "none" });
}
