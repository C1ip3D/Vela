import { NextRequest, NextResponse } from "next/server";

// Returns empty lists — real data comes from the student's Canvas sync.
export async function GET() {
  return NextResponse.json({ alerts: [], students: [] });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  return NextResponse.json({ ok: true, alertId: body.alertId, status: body.status });
}
