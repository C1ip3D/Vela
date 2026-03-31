import { NextResponse } from "next/server";

// Returns an empty log list — real data comes from Canvas sync via the student's token.
export async function GET() {
  return NextResponse.json({ logs: [] });
}
