import { NextRequest, NextResponse } from "next/server";
import { getMockAdvisorLogs, getMockCounselorStudents } from "@/lib/canvas/client";
export async function GET() {
  return NextResponse.json({ alerts: getMockAdvisorLogs(), students: getMockCounselorStudents() });
}
export async function PUT(req: NextRequest) {
  const body = await req.json();
  return NextResponse.json({ ok: true, alertId: body.alertId, status: body.status });
}
