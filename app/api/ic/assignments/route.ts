import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/ic/assignments
 *
 * Fetches detailed assignments for a specific course from Infinite Campus.
 *
 * Body: { authToken: string, baseUrl: string, courseId: string }
 *
 * Returns assignment groups (categories) with individual assignments,
 * scores, weights, and missing/late status — ready for the course detail page
 * and what-if grade calculator.
 */

export interface ICAssignment {
  id: string;
  name: string;
  pointsPossible: number;
  score: number | null;
  grade: string | null;
  submittedAt: string | null;
  missing: boolean;
  late: boolean;
  dueAt: string | null;
}

export interface ICAssignmentGroup {
  id: string;
  name: string;
  weight: number;   // 0–100 (percentage)
  score: number | null;
  assignments: ICAssignment[];
}

export async function POST(req: NextRequest) {
  let body: { authToken?: string; baseUrl?: string; courseId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { authToken, baseUrl, courseId } = body;
  if (!authToken || !baseUrl || !courseId) {
    return NextResponse.json(
      { error: "authToken, baseUrl, and courseId are required" },
      { status: 400 }
    );
  }

  const cookieStr = authToken.includes("=") ? authToken : `ICSID=${authToken}`;

  const headers = {
    Cookie: cookieStr,
    Accept: "application/json",
    "User-Agent": "InfiniteCampus/1.0",
  };

  let groups: ICAssignmentGroup[] = [];
  let fetched = false;

  // ── Endpoint 1: Prism API ────────────────────────────────────────────────
  try {
    const res = await fetch(
      `${baseUrl}/prism/api/portal/grades/assignmentDetail?courseSectionID=${courseId}`,
      { headers }
    );
    if (res.ok) {
      const data = await res.json();
      groups = parsePrismAssignments(data);
      fetched = true;
    }
  } catch {
    // fall through
  }

  // ── Endpoint 2: Legacy resources API ─────────────────────────────────────
  if (!fetched) {
    try {
      const res = await fetch(
        `${baseUrl}/resources/portal/assignment?courseSectionID=${courseId}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        groups = parseLegacyAssignments(data);
        fetched = true;
      }
    } catch {
      // fall through
    }
  }

  if (!fetched) {
    return NextResponse.json(
      { error: "Session expired or could not load assignments. Please log in again." },
      { status: 401 }
    );
  }

  return NextResponse.json({ groups });
}

// ── Parsers ────────────────────────────────────────────────────────────────

function parsePrismAssignments(data: any): ICAssignmentGroup[] {
  // IC Prism shape: { data: [ { categoryName, weight, score, assignments: [...] } ] }
  const categories: any[] = data?.data ?? data?.categories ?? [];
  return categories.map((cat: any, i: number) => {
    const assignments: any[] = cat?.assignments ?? [];
    return {
      id: String(cat?.categoryID ?? cat?.id ?? i),
      name: cat?.categoryName ?? cat?.name ?? `Category ${i + 1}`,
      weight: parseFloat(cat?.weight ?? 0) || 0,
      score: cat?.score?.percent != null ? parseFloat(cat.score.percent) : null,
      assignments: assignments.map((a: any, j: number) => ({
        id: String(a?.assignmentID ?? a?.id ?? j),
        name: a?.assignmentName ?? a?.name ?? "Assignment",
        pointsPossible: parseFloat(a?.totalPoints ?? a?.pointsPossible ?? 0),
        score: a?.score?.points != null ? parseFloat(a.score.points) : null,
        grade: a?.score?.percent != null ? `${parseFloat(a.score.percent).toFixed(2)}%` : null,
        submittedAt: a?.turnInDate ?? a?.submittedAt ?? null,
        missing: !!(a?.missing ?? a?.isMissing),
        late: !!(a?.late ?? a?.isLate),
        dueAt: a?.dueDate ?? a?.dueAt ?? null,
      })),
    };
  });
}

function parseLegacyAssignments(data: any): ICAssignmentGroup[] {
  // Legacy IC shape varies by district — common shape:
  // { Tasks: [ { taskName, weight, standardScore, assignments: [...] } ] }
  const tasks: any[] = data?.Task ?? data?.tasks ?? data?.GradingTask ?? [];
  return tasks.map((task: any, i: number) => {
    const assignments: any[] = task?.Assignments ?? task?.assignments ?? [];
    return {
      id: String(task?.taskID ?? task?.id ?? i),
      name: task?.taskName ?? task?.name ?? `Category ${i + 1}`,
      weight: parseFloat(task?.weight ?? 0) || 0,
      score: task?.score != null ? parseFloat(task.score) : null,
      assignments: assignments.map((a: any, j: number) => ({
        id: String(a?.assignmentID ?? a?.id ?? j),
        name: a?.assignmentName ?? a?.name ?? "Assignment",
        pointsPossible: parseFloat(a?.totalPoints ?? a?.pointsPossible ?? 0),
        score: a?.score != null ? parseFloat(a.score) : null,
        grade: a?.percent != null ? `${parseFloat(a.percent).toFixed(2)}%` : null,
        submittedAt: a?.turnInDate ?? null,
        missing: !!(a?.missing ?? a?.isMissing ?? false),
        late: !!(a?.late ?? a?.isLate ?? false),
        dueAt: a?.dueDate ?? null,
      })),
    };
  });
}
