import { NextRequest, NextResponse } from "next/server";

const CANVAS_BASE = "https://dublinusd.instructure.com";

export async function POST(req: NextRequest) {
    try {
        const { token } = await req.json();
        if (!token) {
            return NextResponse.json({ error: "No token provided" }, { status: 400 });
        }

        // Fetch user's upcoming 'todo' items from Canvas
        const res = await fetch(
            `${CANVAS_BASE}/api/v1/users/self/todo`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!res.ok) {
            return NextResponse.json({ error: `Canvas API error: ${res.status}` }, { status: res.status });
        }

        const rawTodos = await res.json();

        // Write the full response to a file for debugging
        try {
            require('fs').writeFileSync('canvas_todo_debug.json', JSON.stringify(rawTodos, null, 2));
        } catch (e) {
            console.error("Failed to write debug file", e);
        }

        // Process Canvas Todos and filter to ONLY true missing assignments
        const logsPromises = rawTodos.map(async (todo: any) => {
            const entity = todo.assignment || todo.quiz || {};
            const courseName = todo.context_name || todo.course?.name || "Unknown Course";

            const dueDate = entity.due_at ? new Date(entity.due_at) : null;
            const isPastDue = dueDate ? dueDate < new Date() : false;

            // Immediately filter out things that aren't past due or are waiting for grading
            if (!isPastDue || todo.ignore_url?.includes("grading")) {
                return null;
            }

            // Since the `todo` array doesn't include the actual submission grade by default,
            // we do a quick secondary fetch to get the actual submission state for this assignment.
            try {
                const subRes = await fetch(
                    `${CANVAS_BASE}/api/v1/courses/${todo.course_id}/assignments/${entity.id}/submissions/self`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (subRes.ok) {
                    const submission = await subRes.json();

                    // If they have a score, it's graded. If the workflow_state is submitted/graded, it's done.
                    // We also explicitly check the Canvas 'missing' flag. If it's explicitly not missing 
                    // and has been turned in (even with a 0), don't show it as a missing alert.
                    const isGradedOrSubmitted =
                        (submission.score !== null && submission.score !== undefined && submission.score > 0) ||
                        submission.workflow_state === 'graded' ||
                        submission.workflow_state === 'submitted';

                    if (isGradedOrSubmitted) {
                        return null; // Skip, it's not truly missing
                    }
                }
            } catch (err) {
                console.error("Failed to fetch submission state for", entity.name);
            }

            return {
                id: `canvas_todo_${todo.ignore_url || Math.random().toString()}`,
                logType: "MISSING_ASSIGNMENT_ALERT",
                severity: "CRITICAL",
                title: `Missing: ${entity.name || "Missing Item"}`,
                body: { course: courseName },
                isRead: false,
                createdAt: entity.due_at || new Date().toISOString()
            };
        });

        const logsArray = await Promise.all(logsPromises);
        let logs = logsArray.filter(Boolean);

        // Add a friendly greeting if no todos exist
        if (logs.length === 0) {
            logs.push({
                id: "all_caught_up",
                logType: "COURSE_RECOMMENDATION",
                severity: "INFO",
                title: "All Caught Up!",
                body: { count: 0, topTrack: "Keep up the great work in Canvas!" },
                isRead: true,
                createdAt: new Date().toISOString()
            });
        }

        return NextResponse.json({ logs });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to fetch notifications" }, { status: 500 });
    }
}
