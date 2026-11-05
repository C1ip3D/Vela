import { NextRequest, NextResponse } from "next/server";
import { extractUid } from "@vela/auth";
import { prisma } from "@vela/db";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_BELLS = 200;

/** PUT /api/schedule/bell — replaces the student's bell times. Body: { bells: [{dayType, period, start, end}] } */
export async function PUT(req: NextRequest) {
  const uid = await extractUid(req.headers.get("authorization"));
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = (await req.json())?.bells;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(raw) || raw.length > MAX_BELLS) {
    return NextResponse.json({ error: `bells must be an array of at most ${MAX_BELLS}` }, { status: 400 });
  }

  const seen = new Set<string>();
  const bells: { dayType: string; period: string; start: string; end: string }[] = [];
  for (const b of raw) {
    const dayType = typeof b?.dayType === "string" ? b.dayType.trim() : "";
    const period = typeof b?.period === "string" ? b.period.trim() : "";
    const { start, end } = b ?? {};
    if (!dayType || !period || dayType.length > 50 || period.length > 50) {
      return NextResponse.json({ error: "Each bell needs a dayType and period" }, { status: 400 });
    }
    if (typeof start !== "string" || typeof end !== "string" || !HHMM.test(start) || !HHMM.test(end) || start >= end) {
      return NextResponse.json({ error: `Invalid times for ${dayType} period ${period}` }, { status: 400 });
    }
    const key = `${dayType}\u0000${period}`;
    if (seen.has(key)) {
      return NextResponse.json({ error: `Duplicate bell for ${dayType} period ${period}` }, { status: 400 });
    }
    seen.add(key);
    bells.push({ dayType, period, start, end });
  }

  const user = await prisma.user.findUnique({ where: { firebaseUid: uid }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    await prisma.$transaction(
      [
        prisma.bellPeriod.deleteMany({ where: { userId: user.id } }),
        prisma.bellPeriod.createMany({ data: bells.map((b) => ({ ...b, userId: user.id })) }),
      ],
      { isolationLevel: "Serializable" }
    );
  } catch {
    return NextResponse.json({ error: "Another save is in progress. Try again." }, { status: 409 });
  }
  return NextResponse.json({ count: bells.length });
}
