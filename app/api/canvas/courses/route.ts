import { NextRequest, NextResponse } from "next/server";

const CANVAS_BASE = "https://dublinusd.instructure.com";

export async function POST(req: NextRequest) {
    try {
        const { token } = await req.json();
        if (!token) {
            return NextResponse.json({ error: "No token provided" }, { status: 400 });
        }

        // Fetch active courses with current grading period scores
        const res = await fetch(
            `${CANVAS_BASE}/api/v1/courses?include[]=total_scores&include[]=current_grading_period_scores&include[]=term&enrollment_state=active&per_page=50`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!res.ok) {
            return NextResponse.json({ error: `Canvas API error: ${res.status}` }, { status: res.status });
        }

        const rawCourses = await res.json();

        // Normalize and filter courses that have enrollments with grades
        const courses = rawCourses
            .filter((c: any) => c.enrollments && c.enrollments.length > 0)
            .filter((c: any) => {
                const term = (c.term?.name || "").toLowerCase();
                return term.includes("2025") || term.includes("2026") || term.includes("25-26") || term.includes("25/26");
            })
            .map((c: any) => {
                const enrollment = c.enrollments[0];
                // Prefer current grading period scores (current semester) over overall
                const score = enrollment?.current_period_computed_current_score
                    ?? enrollment?.computed_current_score;
                const grade = enrollment?.current_period_computed_current_grade
                    ?? enrollment?.computed_current_grade;

                return {
                    id: String(c.id),
                    name: c.name,
                    courseCode: c.course_code,
                    term: c.term?.name || "Current Term",
                    currentGrade: score ?? null,
                    letterGrade: grade ?? null,
                    courseType: detectCourseType(c.name),
                    enrollmentType: enrollment?.type,
                };
            });

        return NextResponse.json({ courses });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to fetch courses" }, { status: 500 });
    }
}

function detectCourseType(name: string): string {
    const upper = name.toUpperCase();
    if (upper.includes("AP ") || upper.includes("ADVANCED PLACEMENT")) return "AP";
    if (upper.includes("HONORS") || upper.includes("HON ") || upper.includes("(H)") || upper.includes("(HP)")) return "HONORS";
    return "STANDARD";
}
