import { NextResponse } from "next/server";
import { getMockAdvisorLogs } from "@/lib/canvas/client";
export async function GET() {
  return NextResponse.json({ logs: getMockAdvisorLogs() });
}
