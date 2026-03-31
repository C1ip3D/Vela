import { NextResponse } from "next/server";

// Returns empty — courses are derived client-side from Canvas/Classroom live data.
export async function GET() {
  return NextResponse.json({ courses: [] });
}
