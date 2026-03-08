import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/notifications/email";
import { renderTestEmail } from "@/components/emails/TestEmail";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json(
                { success: false, error: "Email is required" },
                { status: 400 }
            );
        }

        const htmlContent = renderTestEmail(email);

        const result = await sendEmail(
            email,
            "Test Alert from Vela",
            htmlContent
        );

        if (result.success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json(
                { success: false, error: "Failed to dispatch email", details: result.error },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error("[TEST_EMAIL_POST]", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
