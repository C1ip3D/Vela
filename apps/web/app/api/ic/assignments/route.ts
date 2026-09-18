import { NextRequest, NextResponse } from "next/server";
import { fetchAssignments, type IcSession } from "@vela/ic-client";

/**
 * POST /api/ic/assignments
 *
 * Fetches detailed assignments for a specific course from Infinite Campus,
 * via @vela/ic-client (the same client apps/mobile uses directly).
 *
 * Body: { authToken: string, baseUrl: string, courseId: string, appName?: string }
 */
export async function POST(req: NextRequest) {
  let body: { authToken?: string; baseUrl?: string; appName?: string; courseId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { authToken, baseUrl, appName, courseId } = body;
  if (!authToken || !baseUrl || !courseId) {
    return NextResponse.json(
      { error: "authToken, baseUrl, and courseId are required" },
      { status: 400 }
    );
  }

  const session: IcSession = { cookies: authToken, baseUrl, appName: appName ?? "" };

  try {
    const groups = await fetchAssignments(session, courseId);
    return NextResponse.json({ groups, source: groups.length > 0 ? "ic" : "none" });
  } catch {
    return NextResponse.json(
      { error: "Session expired or could not reach Infinite Campus. Please reconnect in Settings." },
      { status: 401 }
    );
  }
}
