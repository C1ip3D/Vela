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

  // IC requires XSRF-TOKEN as both a cookie and X-XSRF-TOKEN header on all requests
  const xsrfToken = cookieStr
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith("XSRF-TOKEN="))
    ?.split("=")[1] ?? "";

  const headers: Record<string, string> = {
    Cookie: cookieStr,
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    ...(xsrfToken && { "X-XSRF-TOKEN": xsrfToken }),
  };
  if (appName) {
    headers["appName"] = appName;
    headers["X-Campus-AppName"] = appName;
    headers["Referer"] = `${baseUrl}/portal/students/${appName}`;
  }

  let groups: ICAssignmentGroup[] = [];
  // Track whether we got any successful (non-auth) response from IC.
  // If true, return 200 even if we found 0 assignments (no data ≠ auth error).
  let gotSuccessfulResponse = false;

  const appQuery = appName ? `&appName=${encodeURIComponent(appName)}` : "";

  console.log(`[Assignments] courseId=${courseId} baseUrl=${baseUrl} appName=${appName}`);

  // ── Endpoint 1: Prism API ────────────────────────────────────────────────
  try {
    const url = `${baseUrl}/prism/api/portal/grades/assignmentDetail?courseSectionID=${courseId}${appQuery}`;
    const res = await fetch(url, { headers });
    console.log(`[Assignments] Prism status=${res.status}`);
    if (res.ok) {
      gotSuccessfulResponse = true;
      const data = await res.json();
      const parsed = parsePrismAssignments(data);
      if (parsed.length > 0) { groups = parsed; }
    } else {
      const t = await res.text();
      console.log(`[Assignments] Prism body: ${t.substring(0, 200)}`);
    }
  } catch (e) {
    console.log(`[Assignments] Prism error: ${e}`);
  }

  // ── Endpoint 2: Legacy resources assignment API ──────────────────────────
  if (groups.length === 0) {
    try {
      const url = `${baseUrl}/resources/portal/assignment?courseSectionID=${courseId}${appQuery}`;
      const res = await fetch(url, { headers });
      console.log(`[Assignments] Legacy status=${res.status}`);
      if (res.ok) {
        gotSuccessfulResponse = true;
        const data = await res.json();
        const parsed = parseLegacyAssignments(data);
        console.log(`[Assignments] Legacy parsed ${parsed.length} groups`);
        if (parsed.length > 0) groups = parsed;
      } else {
        const t = await res.text();
        console.log(`[Assignments] Legacy body: ${t.substring(0, 200)}`);
      }
    } catch (e) {
      console.log(`[Assignments] Legacy error: ${e}`);
    }
  }

  // ── Endpoint 3: Dublin USD detail API (try sectionID + alternate IDs) ────
  // We'll also collect alternate IDs from the grades payload for retry
  let rosterID: string | null = null;
  let altID: string | null = null;

  // First fetch grades to find alternate IDs for this course
  const gradesQuery = appName ? `?appName=${encodeURIComponent(appName)}` : "";
  let gradesData: any = null;
  try {
    const gradesRes = await fetch(`${baseUrl}/resources/portal/grades${gradesQuery}`, { headers });
    console.log(`[Assignments] GradesFetch status=${gradesRes.status}`);
    if (gradesRes.ok) {
      gotSuccessfulResponse = true;
      gradesData = await gradesRes.json();
      const allCourses: any[] = (gradesData ?? []).flatMap((e: any) =>
        (e?.terms ?? []).flatMap((t: any) => t?.courses ?? [])
      );
      const match = allCourses.find((c: any) =>
        String(c?.sectionID) === courseId || String(c?._id) === courseId || String(c?.rosterID) === courseId
      );
      if (match) {
        rosterID = match.rosterID != null ? String(match.rosterID) : null;
        altID = match._id != null ? String(match._id) : null;
        if (match.gradingTasks?.length > 0) {
          console.log(`[Assignments] gradingTask[0] keys: ${Object.keys(match.gradingTasks[0]).join(", ")}`);
        }
      }
    }
  } catch (e) {
    console.log(`[Assignments] GradesFetch error: ${e}`);
  }

  // Try detail endpoint with sectionID, rosterID, and _id
  const detailIds = [...new Set([courseId, rosterID, altID].filter(Boolean))] as string[];
  for (const id of detailIds) {
    if (groups.length > 0) break;
    try {
      const dbQuery = appName ? `?appName=${encodeURIComponent(appName)}` : "";
      const url = `${baseUrl}/resources/portal/grades/detail/${id}${dbQuery}`;
      const res = await fetch(url, { headers });
      console.log(`[Assignments] Detail(${id}) status=${res.status}`);
      if (res.ok) {
        gotSuccessfulResponse = true;
        const data = await res.json();
        const parsed = parseLegacyAssignments(data);
        console.log(`[Assignments] Detail(${id}) parsed ${parsed.length} groups`);
        if (parsed.length > 0) {
          groups = parsed;
        } else {
          console.log(`[Assignments] Detail(${id}) raw: ${JSON.stringify(data).substring(0, 300)}`);
        }
      }
    } catch (e) {
      console.log(`[Assignments] Detail(${id}) error: ${e}`);
    }
  }

  // ── Endpoint 4: Extract from grades payload already fetched above ─────────
  if (groups.length === 0 && gradesData) {
    const extracted = extractAssignmentsFromGrades(gradesData, courseId);
    console.log(`[Assignments] GradesFallback extracted ${extracted.length} groups`);
    if (extracted.length > 0) groups = extracted;
  }


  // Return 401 only if we never got any successful response from IC (token fully expired).
  // If IC responded but had no assignment data, return 200 with empty groups — the grade
  // is still shown and no error banner appears.
  if (!gotSuccessfulResponse) {
    return NextResponse.json(
      { error: "Session expired or could not reach Infinite Campus. Please reconnect in Settings." },
      { status: 401 }
    );
  }

  return NextResponse.json({ groups, source: groups.length > 0 ? "ic" : "none" });
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

/**
 * Extracts assignment groups for a specific course from the full grades payload.
 * Dublin USD returns all courses + assignments in /resources/portal/grades.
 *
 * Grades shape (array of enrollments):
 * [{ enrollmentID, terms: [{ termName, courses: [{ _id, sectionID, rosterID, courseName,
 *    gradingTasks: [{ taskName, taskID, score, weight,
 *      categories: [{ name, groupID, weight, assignments: [...] }]
 *    }] }] }] }]
 *
 * We match the course by sectionID, _id, or rosterID against courseId.
 */
function extractAssignmentsFromGrades(data: any, courseId: string): ICAssignmentGroup[] {
  const enrollments: any[] = Array.isArray(data) ? data : (data?.enrollments ?? data?.data ?? []);

  for (const enrollment of enrollments) {
    const terms: any[] = enrollment?.terms ?? [];
    for (const term of terms) {
      const courses: any[] = term?.courses ?? [];
      for (const course of courses) {
        const sid = String(course?.sectionID ?? "");
        const id = String(course?._id ?? "");
        const rid = String(course?.rosterID ?? "");
        if (sid !== courseId && id !== courseId && rid !== courseId) continue;

        // Found the course — extract assignment groups from gradingTasks or categories
        const groups: ICAssignmentGroup[] = [];

        // Shape A: gradingTasks[].categories[].assignments[]
        const gradingTasks: any[] = course?.gradingTasks ?? course?.GradingTask ?? course?.tasks ?? [];
        for (const task of gradingTasks) {
          const categories: any[] = task?.categories ?? task?.Categories ?? [];
          if (categories.length > 0) {
            for (const cat of categories) {
              const assignments: any[] = cat?.assignments ?? cat?.Assignments ?? [];
              groups.push({
                id: String(cat?.groupID ?? cat?.categoryID ?? cat?.id ?? cat?.name),
                name: cat?.name ?? cat?.categoryName ?? task?.taskName ?? "Category",
                weight: parseFloat(cat?.weight ?? task?.weight ?? 0) || 0,
                score: cat?.score != null ? parseFloat(cat.score) : null,
                assignments: assignments.map((a: any, j: number) => ({
                  id: String(a?.assignmentID ?? a?.objectSectionID ?? a?.id ?? j),
                  name: a?.assignmentName ?? a?.name ?? "Assignment",
                  pointsPossible: parseFloat(a?.totalPoints ?? a?.pointsPossible ?? 0),
                  score: a?.score != null ? parseFloat(a.score) : null,
                  grade: a?.scorePercentage != null
                    ? `${parseFloat(a.scorePercentage).toFixed(2)}%`
                    : a?.percent != null ? `${parseFloat(a.percent).toFixed(2)}%` : null,
                  submittedAt: a?.turnInDate ?? a?.scoreModifiedDate ?? null,
                  missing: !!(a?.missing ?? a?.isMissing ?? false),
                  late: !!(a?.late ?? a?.isLate ?? false),
                  dueAt: a?.dueDate ?? null,
                })),
              });
            }
          } else {
            // Shape B: gradingTasks[].assignments[] (flat, no nested categories)
            const assignments: any[] = task?.assignments ?? task?.Assignments ?? [];
            groups.push({
              id: String(task?.taskID ?? task?.id ?? groups.length),
              name: task?.taskName ?? task?.name ?? "Assignments",
              weight: parseFloat(task?.weight ?? 0) || 0,
              score: task?.score != null ? parseFloat(task.score) : null,
              assignments: assignments.map((a: any, j: number) => ({
                id: String(a?.assignmentID ?? a?.objectSectionID ?? a?.id ?? j),
                name: a?.assignmentName ?? a?.name ?? "Assignment",
                pointsPossible: parseFloat(a?.totalPoints ?? a?.pointsPossible ?? 0),
                score: a?.score != null ? parseFloat(a.score) : null,
                grade: a?.scorePercentage != null
                  ? `${parseFloat(a.scorePercentage).toFixed(2)}%`
                  : a?.percent != null ? `${parseFloat(a.percent).toFixed(2)}%` : null,
                submittedAt: a?.turnInDate ?? a?.scoreModifiedDate ?? null,
                missing: !!(a?.missing ?? a?.isMissing ?? false),
                late: !!(a?.late ?? a?.isLate ?? false),
                dueAt: a?.dueDate ?? null,
              })),
            });
          }
        }

        // Shape C: course-level categories[]
        if (groups.length === 0) {
          const categories: any[] = course?.categories ?? course?.Categories ?? [];
          for (const cat of categories) {
            const assignments: any[] = cat?.assignments ?? cat?.Assignments ?? [];
            groups.push({
              id: String(cat?.groupID ?? cat?.categoryID ?? cat?.id ?? cat?.name),
              name: cat?.name ?? cat?.categoryName ?? "Category",
              weight: parseFloat(cat?.weight ?? 0) || 0,
              score: cat?.score != null ? parseFloat(cat.score) : null,
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
            });
          }
        }

        // Sort assignments within each group newest-first
        groups.forEach(g => {
          g.assignments.sort((a, b) => {
            const dA = a.dueAt ? new Date(a.dueAt).getTime() : 0;
            const dB = b.dueAt ? new Date(b.dueAt).getTime() : 0;
            return dB - dA;
          });
        });

        console.log(`[Assignments] extractAssignmentsFromGrades: course ${courseId}, ${groups.length} groups, total=${groups.reduce((s,g)=>s+g.assignments.length,0)} assignments`);
        return groups;
      }
    }
  }

  console.log(`[Assignments] extractAssignmentsFromGrades: course ${courseId} not found in grades payload`);
  return [];
}
