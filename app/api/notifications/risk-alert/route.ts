import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/notifications/email";
import { renderRiskEmail } from "@/components/emails/RiskEmail";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { studentName, counselorName, counselorEmail, courses } = body;

        if (!counselorEmail || !studentName) {
            return NextResponse.json(
                { success: false, error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Academic risk criteria: 3 or more courses with grade <= 79
        const riskCourses = courses.filter((c: any) => c.currentGrade !== null && c.currentGrade <= 79);

        if (riskCourses.length < 3) {
            return NextResponse.json({ success: true, message: "Risk criteria not met", alertSent: false });
        }

        const htmlContent = renderRiskEmail(studentName, counselorName);

        const result = await sendEmail(
            counselorEmail,
            `Academic Intervention Needed: ${studentName}`,
            htmlContent
        );

        if (result.success) {
            return NextResponse.json({ success: true, alertSent: true });
        } else {
            return NextResponse.json(
                { success: false, error: "Failed to dispatch email", details: result.error },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error("[RISK_ALERT_POST]", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
