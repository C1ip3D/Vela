import { NextRequest, NextResponse } from "next/server";
import { extractUid } from "@/lib/authToken";
import prisma from "@/lib/db";

export async function POST(req: NextRequest) {
  const uid = extractUid(req.headers.get("authorization"));
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { expoPushToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { expoPushToken } = body;
  if (!expoPushToken) {
    return NextResponse.json({ error: "expoPushToken is required" }, { status: 400 });
  }

  await prisma.user.update({
    where: { canvasUserId: uid },
    data: { expoPushToken },
  });

  return NextResponse.json({ ok: true });
}
