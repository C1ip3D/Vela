import { NextResponse } from "next/server";

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
    const response = await fetch(
      `https://mobile.infinitecampus.com/api/district/searchDistrict?query=${encodeURIComponent(query)}&state=${encodeURIComponent(state)}`,
      {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Vela Academic Navigator)",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Infinite Campus API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching IC districts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
