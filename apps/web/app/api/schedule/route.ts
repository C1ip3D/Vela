import { NextRequest, NextResponse } from "next/server";
import { extractUid } from "@vela/auth";
import { prisma } from "@vela/db";

/** GET /api/schedule — the signed-in student's stored classes and bell times. */
export async function GET(req: NextRequest) {
  const uid = await extractUid(req.headers.get("authorization"));
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { firebaseUid: uid }, select: { id: true } });
  if (!user) return NextResponse.json({ entries: [], bells: [] });

  const [entries, bells] = await Promise.all([
    prisma.scheduleEntry.findMany({
      where: { userId: user.id },
      select: { sectionId: true, courseName: true, teacher: true, room: true, period: true, dayType: true, termName: true, startDate: true, endDate: true },
    }),
    prisma.bellPeriod.findMany({
      where: { userId: user.id },
      select: { dayType: true, period: true, start: true, end: true },
    }),
  ]);
  return NextResponse.json({ entries, bells });
}
