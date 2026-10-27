import { NextResponse } from "next/server";
import { searchIcDistricts } from "@vela/ic-client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const state = searchParams.get("state");

  if (!query || !state) {
    return NextResponse.json({ error: "Missing query or state parameter" }, { status: 400 });
  }

  // Infinite Campus API requires at least 3 characters for search
  if (query.length < 3) {
    return NextResponse.json({ data: [] });
  }

  try {
    const data = await searchIcDistricts(query, state);
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("Error fetching IC districts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
