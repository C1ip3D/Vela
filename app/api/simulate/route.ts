import { NextRequest, NextResponse } from "next/server";
import { calculateSimulation } from "@/lib/engines/simulation";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { categories, assignments, overrides, placeholders, courseType } = body;
  const result = calculateSimulation({ categories, assignments, overrides: overrides ?? {}, placeholders: placeholders ?? [], courseType: courseType ?? "STANDARD" });
  return NextResponse.json(result);
}
