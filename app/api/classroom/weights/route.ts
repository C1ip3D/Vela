// app/api/classroom/weights/route.ts
// Manages per-course weight templates stored in localStorage on the client.
// This route is a thin pass-through for server-side persistence (Prisma).
// In demo mode (no DB), the client stores in localStorage directly.
//
// GET  ?courseId=X&userId=Y → { templates: WeightTemplate[] }
// POST { courseId, userId, categories } → { templates: WeightTemplate[] }

import { NextRequest, NextResponse } from "next/server";

// In production this would use Prisma. In hackathon/demo mode we return
// empty so the client falls back to localStorage.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");
  const userId = searchParams.get("userId");

  if (!courseId || !userId) {
    return NextResponse.json({ error: "Missing courseId or userId" }, { status: 400 });
  }

  // TODO: query Prisma ClassroomWeightTemplate where userId + courseId
  // For now return empty — client falls back to localStorage cache
  return NextResponse.json({ templates: [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { courseId, userId, categories } = body;

    if (!courseId || !userId || !Array.isArray(categories)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Validate weights sum to ~1.0
    const total = categories.reduce(
      (sum: number, c: { weight: number }) => sum + c.weight,
      0
    );
    if (Math.abs(total - 1.0) > 0.01) {
      return NextResponse.json(
        { error: `Weights must sum to 100% (got ${(total * 100).toFixed(1)}%)` },
        { status: 400 }
      );
    }

    // TODO: upsert into Prisma ClassroomWeightTemplate
    // prisma.classroomWeightTemplate.deleteMany({ where: { userId, courseId } })
    // prisma.classroomWeightTemplate.createMany({ data: categories.map(...) })

    return NextResponse.json({ success: true, templates: categories });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
