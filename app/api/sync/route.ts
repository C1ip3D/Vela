import { NextResponse } from "next/server";
export async function POST() {
  // In production: trigger Canvas sync job
  // For demo: return success with mock timestamp
  return NextResponse.json({ status: "ok", syncedAt: new Date().toISOString(), message: "Sync queued" });
}
