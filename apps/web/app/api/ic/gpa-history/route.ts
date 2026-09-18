import { NextRequest, NextResponse } from "next/server";
import { extractUid } from "@vela/auth";
import { prisma } from "@vela/db";

export async function GET(req: NextRequest) {
  const uid = await extractUid(req.headers.get("authorization"));
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) {
    return NextResponse.json({ snapshots: [] });
  }

  const snapshots = await prisma.gpaSnapshot.findMany({
    where: { userId: user.id },
    orderBy: { recordedAt: "asc" },
    take: 20,
  });

  const result = snapshots.map((s) => ({
    date: new Date(s.recordedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    gpa: s.unweightedGpa,
    term: s.weightedGpa,
  }));

  return NextResponse.json({ snapshots: result });
}
