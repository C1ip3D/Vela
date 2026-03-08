import { NextRequest, NextResponse } from "next/server";

const CANVAS_BASE = "https://dublinusd.instructure.com";

export async function POST(req: NextRequest) {
    try {
        const { token, courseId } = await req.json();
        if (!token || !courseId) {
            return NextResponse.json({ error: "Missing token or courseId" }, { status: 400 });
        }

        // Fetch grading periods to find the current one
        let currentGradingPeriodId: string | null = null;
        try {
            const gpRes = await fetch(
                `${CANVAS_BASE}/api/v1/courses/${courseId}/grading_periods`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (gpRes.ok) {
                const gpData = await gpRes.json();
                const now = new Date();
                const currentPeriod = gpData.grading_periods?.find((gp: any) => {
                    const start = new Date(gp.start_date);
                    const end = new Date(gp.end_date);
                    return now >= start && now <= end;
                });
                if (currentPeriod) {
                    currentGradingPeriodId = String(currentPeriod.id);
                }
            }
        } catch {
            // Fall back to showing all assignments
        }

        // Fetch assignment groups with assignments and submissions
        // Use grading_period_id if available to scope to current semester
        let url = `${CANVAS_BASE}/api/v1/courses/${courseId}/assignment_groups?include[]=assignments&include[]=submission&per_page=50`;
        if (currentGradingPeriodId) {
            url += `&grading_period_id=${currentGradingPeriodId}`;
        }

        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

        if (!res.ok) {
            return NextResponse.json({ error: `Canvas API error: ${res.status}` }, { status: res.status });
        }

        const rawGroups = await res.json();

        const groups = rawGroups.map((g: any) => {
            const assignments = (g.assignments || []).map((a: any) => {
                const sub = a.submission;
                return {
                    id: String(a.id),
                    name: a.name,
                    pointsPossible: a.points_possible,
                    score: sub?.score ?? null,
                    grade: sub?.grade ?? null,
                    submittedAt: sub?.submitted_at ?? null,
                    missing: sub?.missing ?? false,
                    late: sub?.late ?? false,
                    dueAt: a.due_at,
                };
            });

            // Calculate group percentage
            let groupScore: number | null = null;
            const scoredAssignments = assignments.filter(
                (a: any) => a.score !== null && a.pointsPossible > 0
            );
            if (scoredAssignments.length > 0) {
                const totalEarned = scoredAssignments.reduce((sum: number, a: any) => sum + a.score, 0);
                const totalPossible = scoredAssignments.reduce((sum: number, a: any) => sum + a.pointsPossible, 0);
                groupScore = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : null;
            }

            return {
                id: String(g.id),
                name: g.name,
                weight: g.group_weight,
                score: groupScore,
                assignments,
            };
        });

        return NextResponse.json({ groups });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to fetch assignment groups" }, { status: 500 });
    }
}
