import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/notifications/email";
import { sendTelegram } from "@/lib/notifications/telegram";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            studentName,
            studentEmail,
            type,          // "grade_update" | "assignment_update"
            courseName,
            details,       // { oldGrade?, newGrade?, assignmentTitle?, score? }
            prefs,         // { email, emailEnabled, telegram, telegramBotToken, telegramChatId, gradeAlerts, assignmentAlerts }
        } = body;

        if (!prefs) {
            return NextResponse.json({ success: false, error: "Missing prefs" }, { status: 400 });
        }

        const results: { email?: boolean; telegram?: boolean } = {};

        // Build notification content
        let subject = "";
        let htmlContent = "";
        let telegramText = "";

        if (type === "grade_update") {
            if (!prefs.gradeAlerts) return NextResponse.json({ success: true, skipped: true });
            const arrow = details.newGrade > details.oldGrade ? "↑" : "↓";
            subject = `Vela: Grade update in ${courseName}`;
            htmlContent = `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#101828;color:#E8ECFF;padding:24px;border-radius:12px">
                    <h2 style="color:#A5B4FC;margin:0 0 8px">⭐ Vela · Grade Update</h2>
                    <p style="color:#8B98B8;margin:0 0 16px;font-size:13px">${new Date().toLocaleDateString()}</p>
                    <p style="font-size:16px;margin:0 0 12px">Hi <strong>${studentName}</strong>,</p>
                    <p>Your grade in <strong>${courseName}</strong> has been updated:</p>
                    <div style="background:#162032;border:1px solid #1C2A45;border-radius:8px;padding:16px;margin:16px 0;text-align:center">
                        <span style="font-size:24px;color:#8B98B8">${details.oldGrade?.toFixed(1) ?? "—"}%</span>
                        <span style="font-size:20px;color:#818CF8;margin:0 12px">${arrow}</span>
                        <span style="font-size:24px;color:${details.newGrade >= details.oldGrade ? "#34C759" : "#F43F5E"}">${details.newGrade?.toFixed(1) ?? "—"}%</span>
                    </div>
                    <p style="color:#8B98B8;font-size:12px">View your full grades in <a href="https://vela.app/dashboard" style="color:#A5B4FC">Vela Dashboard</a>.</p>
                </div>`;
            telegramText = `<b>⭐ Vela · Grade Update</b>\n\nHi ${studentName}!\n\nYour grade in <b>${courseName}</b> changed:\n${details.oldGrade?.toFixed(1) ?? "—"}% ${arrow} <b>${details.newGrade?.toFixed(1) ?? "—"}%</b>`;
        } else if (type === "assignment_update") {
            if (!prefs.assignmentAlerts) return NextResponse.json({ success: true, skipped: true });
            subject = `Vela: New assignment graded in ${courseName}`;
            htmlContent = `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#101828;color:#E8ECFF;padding:24px;border-radius:12px">
                    <h2 style="color:#A5B4FC;margin:0 0 8px">✦ Vela · Assignment Graded</h2>
                    <p style="color:#8B98B8;margin:0 0 16px;font-size:13px">${new Date().toLocaleDateString()}</p>
                    <p style="font-size:16px;margin:0 0 12px">Hi <strong>${studentName}</strong>,</p>
                    <p>An assignment has been graded in <strong>${courseName}</strong>:</p>
                    <div style="background:#162032;border:1px solid #1C2A45;border-radius:8px;padding:16px;margin:16px 0">
                        <p style="margin:0;font-size:15px;color:#E8ECFF">${details.assignmentTitle}</p>
                        <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#A5B4FC">${details.score}${details.pointsPossible ? ` / ${details.pointsPossible}` : ""}</p>
                    </div>
                    <p style="color:#8B98B8;font-size:12px">View your assignments in <a href="https://vela.app/courses" style="color:#A5B4FC">Vela</a>.</p>
                </div>`;
            telegramText = `<b>✦ Vela · Assignment Graded</b>\n\nHi ${studentName}!\n\n<b>${details.assignmentTitle}</b> in ${courseName}\nScore: <b>${details.score}${details.pointsPossible ? ` / ${details.pointsPossible}` : ""}</b>`;
        } else {
            return NextResponse.json({ success: false, error: "Unknown type" }, { status: 400 });
        }

        // Send email
        if (prefs.emailEnabled && prefs.email) {
            const emailResult = await sendEmail(prefs.email, subject, htmlContent);
            results.email = emailResult.success;
        }

        // Send Telegram
        if (prefs.telegram && prefs.telegramBotToken && prefs.telegramChatId) {
            const tgResult = await sendTelegram(prefs.telegramBotToken, prefs.telegramChatId, telegramText);
            results.telegram = tgResult.success;
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        console.error("[GRADE_ALERT_POST]", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
