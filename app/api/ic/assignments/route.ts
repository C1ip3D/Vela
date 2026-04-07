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
  let body: { authToken?: string; baseUrl?: string; appName?: string; courseId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { authToken, baseUrl, appName, courseId } = body;
  if (!authToken || !baseUrl || !courseId) {
    return NextResponse.json(
      { error: "authToken, baseUrl, and courseId are required" },
      { status: 400 }
    );
  }

  const cookieStr = authToken.includes("=") ? authToken : `ICSID=${authToken}`;
  const finalCookieStr = appName && !cookieStr.includes("appName=") 
    ? `${cookieStr}; appName=${appName}` 
    : cookieStr;

  const headers: Record<string, string> = {
    Cookie: finalCookieStr,
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  };
  if (appName) {
    headers["appName"] = appName;
    headers["X-Campus-AppName"] = appName;
    headers["Referer"] = `${baseUrl}/portal/students/${appName}`;
  }

  let groups: ICAssignmentGroup[] = [];
  let fetched = false;
  
  const appQuery = appName ? `&appName=${encodeURIComponent(appName)}` : "";

  // ── Endpoint 1: Prism API ────────────────────────────────────────────────
  try {
    const res = await fetch(
      `${baseUrl}/prism/api/portal/grades/assignmentDetail?courseSectionID=${courseId}${appQuery}`,
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

  // ── Endpoint 2: Legacy resources assignment API ──────────────────────────
  if (!fetched) {
    try {
      const res = await fetch(
        `${baseUrl}/resources/portal/assignment?courseSectionID=${courseId}${appQuery}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        groups = parseLegacyAssignments(data);
        if (groups.length > 0) fetched = true;
      }
    } catch {
      // fall through
    }
  }

  // ── Endpoint 3: Dublin Unified detail API ────────────────────────────────
  if (!fetched) {
    try {
      const dbQuery = appName ? `?appName=${encodeURIComponent(appName)}` : "";
      const res = await fetch(
        `${baseUrl}/resources/portal/grades/detail/${courseId}${dbQuery}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        const parsed = parseLegacyAssignments(data);
        if (parsed && parsed.length > 0) {
           groups = parsed;
           fetched = true;
        }
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
  // Legacy IC shape varies by district
  
  // Pattern 1: Dublin Unified structure -> { details: [ { task, categories: [ ... ] } ] }
  if (data?.details && Array.isArray(data.details)) {
    const categoryMap = new Map<string, ICAssignmentGroup>();
    
    data.details.forEach((detail: any) => {
      const cats = detail.categories ?? [];
      cats.forEach((cat: any) => {
        const id = String(cat.groupID ?? cat.id ?? cat.name);
        const assigns = cat.assignments ?? cat.Assignments ?? [];
        
        let group = categoryMap.get(id);
        if (!group) {
          group = {
            id,
            name: cat.name ?? cat.categoryName ?? "Category",
            weight: parseFloat(cat.weight ?? 0) || 0,
            score: null, // Computed implicitly by frontend if missing
            assignments: []
          };
          categoryMap.set(id, group);
        }
        
        assigns.forEach((a: any, j: number) => {
           group!.assignments.push({
             id: String(a?.assignmentID ?? a?.objectSectionID ?? a?.id ?? j),
             name: a?.assignmentName ?? a?.name ?? "Assignment",
             pointsPossible: parseFloat(a?.totalPoints ?? a?.pointsPossible ?? 0),
             score: a?.score != null ? parseFloat(a.score) : null,
             grade: a?.scorePercentage != null ? `${parseFloat(a.scorePercentage).toFixed(2)}%` : (a?.percent != null ? `${parseFloat(a.percent).toFixed(2)}%` : null),
             submittedAt: a?.turnInDate ?? a?.scoreModifiedDate ?? null,
             missing: !!(a?.missing ?? a?.isMissing ?? false),
             late: !!(a?.late ?? a?.isLate ?? false),
             dueAt: a?.dueDate ?? null,
           });
        });
      });
    });
    
    // Sort assignments by dueDate descending within each group
    const groups = Array.from(categoryMap.values());
    groups.forEach(g => {
      g.assignments.sort((a, b) => {
         const dA = a.dueAt ? new Date(a.dueAt).getTime() : 0;
         const dB = b.dueAt ? new Date(b.dueAt).getTime() : 0;
         return dB - dA;
      });
    });
    return groups;
  }

  // Pattern 2: Standard common shape
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
