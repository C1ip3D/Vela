import { NextRequest, NextResponse } from "next/server";
import { extractUid } from "@vela/auth";
import { prisma } from "@vela/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = await extractUid(req.headers.get("authorization"));
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: enrollmentId } = await params;

  let finalWeight: number | null;
  try {
    const body = await req.json();
    finalWeight = body.finalWeight ?? null;
    if (finalWeight !== null && (typeof finalWeight !== "number" || finalWeight < 0 || finalWeight > 1)) {
      return NextResponse.json({ error: "finalWeight must be a number between 0 and 1, or null" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Verify the enrollment belongs to the requesting user
  const user = await prisma.user.findUnique({ where: { firebaseUid: uid }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, userId: user.id },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  const updated = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { finalWeight },
    select: { id: true, finalWeight: true },
  });

  return NextResponse.json(updated);
}
