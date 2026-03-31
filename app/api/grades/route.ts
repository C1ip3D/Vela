import { NextResponse } from "next/server";

// Returns empty — grades are derived client-side from Canvas/Classroom live data.
export async function GET() {
  return NextResponse.json({ gpa: null, student: null, history: [] });
}
