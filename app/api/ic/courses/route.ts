import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/ic/courses
 *
 * Fetches the student's active courses and current grades from Infinite Campus
 * using the short-lived ICSID session token obtained from /api/ic/auth.
 *
 * Body: { authToken: string, baseUrl: string }
 *
 * IC Portal grades endpoint (undocumented):
 *   GET <base>/resources/portal/grades
 *   or
 *   GET <base>/prism/api/portal/grades
 */

interface ICCourse {
  id: string;
  name: string;
  courseCode: string;
  term: string;
  courseType: string;
  currentGrade: number | null;
  letterGrade: string | null;
  missingCount: number;
  teacher: string | null;
  period: string | null;
}

export async function POST(req: NextRequest) {
  let body: { authToken?: string; baseUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { authToken, baseUrl } = body;
  if (!authToken || !baseUrl) {
    return NextResponse.json({ error: "authToken and baseUrl are required" }, { status: 400 });
  }

  const cookieStr = authToken.includes("=") ? authToken : `ICSID=${authToken}`;

  const headers = {
    Cookie: cookieStr,
    Accept: "application/json",
    "User-Agent": "InfiniteCampus/1.0",
  };

  // Try the main IC Portal grades API
  let courses: ICCourse[] = [];
  let fetched = false;

  // Endpoint 1: prism API (newer IC versions)
  console.log(`[IC Debug] Attempting to fetch prism API at: ${baseUrl}/prism/api/portal/grades`);
  console.log(`[IC Debug] Using authToken: ${authToken.substring(0, 10)}... (length: ${authToken.length})`);
  
  try {
    const gradesRes = await fetch(`${baseUrl}/prism/api/portal/grades`, { headers });
    console.log(`[IC Debug] Prism API Status: ${gradesRes.status}`);
    
    if (gradesRes.ok) {
      const rawText = await gradesRes.text();
      console.log(`[IC Debug] Prism raw response text length: ${rawText.length}. Sample: ${rawText.substring(0, 500)}`);
      
      try {
        const data = JSON.parse(rawText);
        const parsed = parseResilient(data, baseUrl);
        console.log(`[IC Debug] Prism parser found ${parsed.length} courses!`);
        if (parsed.length > 0) {
          courses = parsed;
          fetched = true;
        }
      } catch (parseErr) {
        console.error("[IC Debug] Failed to parse Prism JSON", parseErr);
      }
    } else {
      console.log(`[IC Debug] Prism API returned non-ok status: ${gradesRes.status}`);
      const errText = await gradesRes.text();
      console.log(`[IC Debug] Prism Error Body: ${errText.substring(0, 500)}`);
    }
  } catch (e) {
    console.error(`[IC Debug] Prism API network error:`, e);
  }

  // Endpoint 2: legacy resources/portal/grades
  if (!fetched) {
    console.log(`[IC Debug] Prism failed or returned 0 courses. Falling back to Legacy API at: ${baseUrl}/resources/portal/grades`);
    try {
      const gradesRes = await fetch(`${baseUrl}/resources/portal/grades`, { headers });
      console.log(`[IC Debug] Legacy API Status: ${gradesRes.status}`);
      
      if (gradesRes.ok) {
        const rawText = await gradesRes.text();
        console.log(`[IC Debug] Legacy raw response text length: ${rawText.length}. Sample: ${rawText.substring(0, 500)}`);
        
        try {
          const data = JSON.parse(rawText);
          const parsed = parseResilient(data, baseUrl);
          console.log(`[IC Debug] Legacy parser found ${parsed.length} courses!`);
          if (parsed.length > 0) {
            courses = parsed;
            fetched = true;
          }
        } catch (parseErr) {
           console.error("[IC Debug] Failed to parse Legacy JSON", parseErr);
        }
      } else {
        console.log(`[IC Debug] Legacy API returned non-ok status: ${gradesRes.status}`);
        const errText = await gradesRes.text();
        console.log(`[IC Debug] Legacy Error Body: ${errText.substring(0, 500)}`);
      }
    } catch (e) {
      console.error(`[IC Debug] Legacy API network error:`, e);
    }
  }

  if (!fetched && courses.length === 0) {
    return NextResponse.json(
      { error: "Session expired or unable to fetch grades. Please log in again." },
      { status: 401 }
    );
  }

  return NextResponse.json({ courses });
}

// ── Resilient Recursive Parser ──────────────────────────────────────────────────

function detectCourseType(name: string): string {
  const u = name.toUpperCase();
  if (u.includes("AP ") || u.includes("ADVANCED PLACEMENT")) return "AP";
  if (u.includes("HONORS") || u.includes("HON ") || u.includes("(H)") || u.includes("(HP)")) return "HONORS";
  return "STANDARD";
}

function extractCoursesRecursive(obj: any, found: any[] = []) {
  if (!obj || typeof obj !== "object") return found;

  // Detect if this object represents a course
  const isCourse =
    typeof obj.courseName === "string" ||
    typeof obj.courseNumber === "string" ||
    (typeof obj.name === "string" && (obj.teacherDisplay || obj.roomID || obj.sectionID));

  if (isCourse) {
    found.push(obj);
  } else {
    if (Array.isArray(obj)) {
      for (const item of obj) extractCoursesRecursive(item, found);
    } else {
      for (const key of Object.keys(obj)) extractCoursesRecursive(obj[key], found);
    }
  }
  return found;
}

function parseResilient(data: any, baseUrl: string): ICCourse[] {
  const rawCourses = extractCoursesRecursive(data);
  const coursesMap = new Map<string, ICCourse>();

  for (const cs of rawCourses) {
    const name = cs.courseName ?? cs.name ?? "Unknown Course";
    const code = cs.courseNumber ?? cs.code ?? cs.number ?? "";
    const id = String(cs.courseSectionID ?? cs.sectionID ?? cs.id ?? code ?? Math.random());

    // Recursively hunt for a grade score within this course object
    let currentGrade: number | null = null;
    let letterGrade: string | null = null;
    let missingCount = 0;

    // Helper to find scores recursively inside the course section, because different districts nest them differently
    function findGrades(node: any) {
      if (!node || typeof node !== "object") return;
      
      const score = node.score ?? node.percent ?? node.grade?.percent ?? node.currentGrade?.percent;
      const letter = node.gradeCalculated ?? node.grade?.letter ?? node.letter ?? node.currentGrade?.letter;
      const missing = node.missingCount ?? node.missing ?? 0;

      if (score != null && !isNaN(Number(score))) {
        // keep the highest or most recent valid score
        currentGrade = parseFloat(score);
        if (letter) letterGrade = letter;
      }
      if (missing) missingCount += missing;

      // don't recurse if we found a score block to avoid double counting, unless it's an array of periods
      if (Array.isArray(node)) {
        for (const item of node) findGrades(item);
      } else if (typeof node === "object") {
        for (const key of Object.keys(node)) {
          if (key === "postingPeriods" || key === "terms" || key === "gradingTasks" || Array.isArray(node[key])) {
             findGrades(node[key]);
          }
        }
      }
    }

    findGrades(cs);

    // Merge duplicate course sections (e.g. term 1, term 2) by picking the one with grades, or updating existing
    const existing = coursesMap.get(id);
    if (!existing || (!existing.currentGrade && currentGrade)) {
      coursesMap.set(id, {
        id,
        name,
        courseCode: code,
        term: cs.calendarName ?? cs.termName ?? cs.term ?? extractTerm(baseUrl),
        courseType: detectCourseType(name),
        currentGrade,
        letterGrade,
        missingCount,
        teacher: cs.teacherDisplay ?? cs.teacher ?? null,
        period: cs.sectionNumber ?? cs.period ?? null,
      });
    } else if (existing) {
       // Accrue missing assignments if the course is duplicate across terms
       existing.missingCount += missingCount;
       if (!existing.currentGrade && currentGrade) {
          existing.currentGrade = currentGrade;
          existing.letterGrade = letterGrade;
       }
    }
  }

  return Array.from(coursesMap.values());
}

function extractTerm(baseUrl: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // Academic year: Aug–Jul
  const startYear = month >= 8 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}
