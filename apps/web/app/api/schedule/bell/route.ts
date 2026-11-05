import { NextRequest, NextResponse } from "next/server";
import { extractUid } from "@vela/auth";
import { prisma } from "@vela/db";
import { parseBellSchedules } from "@/lib/bellValidation";

/** PUT /api/schedule/bell — saves the student's bell schedules. Body: { bells: BellSchedule[] } */
export async function PUT(req: NextRequest) {
  const uid = await extractUid(req.headers.get("authorization"));
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = (await req.json())?.bells;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parseBellSchedules(raw);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { firebaseUid: uid }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Single upsert: atomic, and concurrent saves just last-write-wins.
  await prisma.bellConfig.upsert({
    where: { userId: user.id },
    create: { userId: user.id, schedules: parsed.value as object[] },
    update: { schedules: parsed.value as object[] },
  });
  return NextResponse.json({ count: parsed.value.length });
}
