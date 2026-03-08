import { NextRequest, NextResponse } from "next/server";

const CANVAS_BASE = "https://dublinusd.instructure.com";

export async function POST(req: NextRequest) {
    try {
        const { token } = await req.json();
        if (!token) {
            return NextResponse.json({ error: "No token provided" }, { status: 400 });
        }

        const res = await fetch(`${CANVAS_BASE}/api/v1/users/self/profile`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
            return NextResponse.json({ error: "Invalid token or Canvas unreachable" }, { status: 401 });
        }

        const profile = await res.json();
        return NextResponse.json({
            connected: true,
            name: profile.name || profile.short_name || null,
            email: profile.primary_email || profile.login_id || null,
            id: profile.id,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Connection failed" }, { status: 500 });
    }
}
