import { NextRequest, NextResponse } from "next/server";
import { extractUid } from "@vela/auth";
import { syncICCoursesToDB, getCachedCourses } from "@/lib/syncIC";

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

interface ICAssignment {
  key: string;
  name: string;
  score: number | null;
  maxScore: number | null;
  dueDate?: string;
}

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
  assignments: ICAssignment[];
}

export async function POST(req: NextRequest) {
  let body: { authToken?: string; baseUrl?: string; appName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { authToken, baseUrl, appName } = body;
  if (!authToken || !baseUrl) {
    return NextResponse.json({ error: "authToken and baseUrl are required" }, { status: 400 });
  }

  const uid = extractUid(req.headers.get("authorization"));
  if (uid) {
    const cached = await getCachedCourses(uid);
    if (cached) {
      console.log(`[IC Courses] Serving ${cached.courses.length} courses from DB cache for uid=${uid} (stale=${cached.isStale})`);
      if (cached.isStale) {
        // Return immediately, refresh in the background
        const response = NextResponse.json({ courses: cached.courses, source: "cache" });
        // Fire-and-forget background sync — extract auth info needed for syncICCoursesToDB
        (async () => {
          try {
            let email = "";
            let displayName = "";
            try {
              const payload = req.headers.get("authorization")!.slice(7).split(".")[1];
              const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
              email = parsed.email ?? "";
              displayName = parsed.name ?? parsed.email ?? "";
            } catch {}
            const cookieStr = authToken.includes("=") ? authToken : `ICSID=${authToken}`;
            const xsrfToken = cookieStr.split(";").map((p) => p.trim()).find((p) => p.startsWith("XSRF-TOKEN="))?.split("=")[1] ?? "";
            const hdrs: Record<string, string> = {
              Cookie: cookieStr,
              Accept: "application/json",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
              ...(xsrfToken && { "X-XSRF-TOKEN": xsrfToken }),
            };
            if (appName) {
              hdrs["appName"] = appName;
              hdrs["X-Campus-AppName"] = appName;
              hdrs["Referer"] = `${baseUrl}/portal/students/${appName}`;
            }
            const appQ = appName ? `?appName=${encodeURIComponent(appName)}` : "";
            const res = await fetch(`${baseUrl}/resources/portal/grades${appQ}`, { headers: hdrs });
            if (res.ok) {
              const data = JSON.parse(await res.text());
              const courses = parseResilient(data, baseUrl);
              if (courses.length > 0) {
                await syncICCoursesToDB(uid, email, displayName, courses);
                console.log(`[IC Courses] Background sync complete: ${courses.length} courses for uid=${uid}`);
              }
            }
          } catch (e) {
            console.error("[IC Courses] Background sync error:", e);
          }
        })();
        return response;
      }
      return NextResponse.json({ courses: cached.courses, source: "cache" });
    }
  }

  // authToken is already a full cookie jar string (merged init + verify cookies)
  const cookieStr = authToken.includes("=") ? authToken : `ICSID=${authToken}`;

  // Extract XSRF-TOKEN value — IC requires it as both a cookie AND an X-XSRF-TOKEN header
  // on all AJAX requests, even GETs. Without it the server returns 401 despite a valid JSESSIONID.
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
  console.log(`[IC Debug] XSRF-TOKEN present: ${!!xsrfToken}`);

  // Try the main IC Portal grades API
  let courses: ICCourse[] = [];
  let fetched = false;

  const appQuery = appName ? `?appName=${encodeURIComponent(appName)}` : "";

  // Endpoint 1: prism API (newer IC versions)
  console.log(`[IC Debug] Attempting prism API: ${baseUrl}/prism/api/portal/grades${appQuery}`);
  console.log(`[IC Debug] Cookie jar keys: ${authToken.split(";").map(p => p.split("=")[0].trim()).join(", ")}`);

  try {
    const gradesRes = await fetch(`${baseUrl}/prism/api/portal/grades${appQuery}`, { headers });
    console.log(`[IC Debug] Prism status: ${gradesRes.status}`);

    if (gradesRes.ok) {
      const rawText = await gradesRes.text();
      console.log(`[IC Debug] Prism response (${rawText.length} chars): ${rawText.substring(0, 800)}`);
      try {
        const data = JSON.parse(rawText);
        const parsed = parseResilient(data, baseUrl);
        console.log(`[IC Debug] Prism parsed ${parsed.length} courses`);
        if (parsed.length > 0) {
          courses = parsed;
          fetched = true;
        }
      } catch (parseErr) {
        console.error("[IC Debug] Prism JSON parse error:", parseErr);
      }
    } else {
      const errText = await gradesRes.text();
      console.log(`[IC Debug] Prism error body: ${errText.substring(0, 500)}`);
    }
  } catch (e) {
    console.error(`[IC Debug] Prism network error:`, e);
  }

  // Endpoint 2: legacy resources/portal/grades
  if (!fetched) {
    console.log(`[IC Debug] Prism failed or returned 0 courses. Falling back to Legacy API at: ${baseUrl}/resources/portal/grades${appQuery}`);
    try {
      const gradesRes = await fetch(`${baseUrl}/resources/portal/grades${appQuery}`, { headers });
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

  // Endpoint 3: Modern API /api/portal/students -> /api/portal/students/[id]/grades
  if (!fetched) {
    console.log(`[IC Debug] Legacy failed. Trying Modern API at: ${baseUrl}/api/portal/students${appQuery}`);
    try {
      const studentsRes = await fetch(`${baseUrl}/api/portal/students${appQuery}`, { headers });
      console.log(`[IC Debug] Modern Students API Status: ${studentsRes.status}`);
      if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        const studentsList = Array.isArray(studentsData) ? studentsData : (studentsData.data || []);
        console.log(`[IC Debug] Found ${studentsList.length} students in modern API.`);
        
        for (const student of studentsList) {
          const personId = student.personID || student.personId || student.id;
          if (personId) {
             const gradesUrl = `${baseUrl}/api/portal/students/${personId}/grades${appQuery}`;
             console.log(`[IC Debug] Fetching grades for ${personId}: ${gradesUrl}`);
             const sGradesRes = await fetch(gradesUrl, { headers });
             if (sGradesRes.ok) {
               const sGradesRaw = await sGradesRes.text();
               const parsed = parseResilient(JSON.parse(sGradesRaw), baseUrl);
               if (parsed.length > 0) {
                 courses.push(...parsed);
                 fetched = true;
               }
             } else {
               console.log(`[IC Debug] Modern grades returned non-ok: ${sGradesRes.status}`);
             }
          }
        }
      } else {
        console.log(`[IC Debug] Modern Students API returned non-ok: ${studentsRes.status}`);
        const errText = await studentsRes.text();
        console.log(`[IC Debug] Modern Students Error: ${errText.substring(0, 500)}`);
        
        // SELF-HEALING: If it throws conflicting app name values, the IC backend literally tells us the correct appName in the error JSON!
        if (studentsRes.status === 400 && errText.includes("conflicting app name values")) {
           try {
             const errJson = JSON.parse(errText);
             const recoveredAppName = errJson.appName;
             if (recoveredAppName) {
               console.log(`[IC Debug] Recovered correct appName from error: ${recoveredAppName}. Retrying with Cookie Injection...`);
               const retryAppQuery = `?appName=${encodeURIComponent(recoveredAppName)}`;
               const retryHeaders = { ...headers, Cookie: `${headers.Cookie}; appName=${recoveredAppName}` };
               const retryRes = await fetch(`${baseUrl}/api/portal/students${retryAppQuery}`, { headers: retryHeaders });
               
               if (retryRes.ok) {
                 const studentsData = await retryRes.json();
                 const studentsList = Array.isArray(studentsData) ? studentsData : (studentsData.data || []);
                 console.log(`[IC Debug] Retry successful! Found ${studentsList.length} students.`);
                 
                 for (const student of studentsList) {
                   const personId = student.personID || student.personId || student.id;
                   if (personId) {
                      const gradesUrl = `${baseUrl}/api/portal/students/${personId}/grades${retryAppQuery}`;
                      const sGradesRes = await fetch(gradesUrl, { headers: retryHeaders });
                      if (sGradesRes.ok) {
                        const sGradesRaw = await sGradesRes.text();
                        const parsed = parseResilient(JSON.parse(sGradesRaw), baseUrl);
                        if (parsed.length > 0) {
                          courses.push(...parsed);
                          fetched = true;
                        }
                      }
                   }
                 }
               } else {
                 console.log(`[IC Debug] Retry Failed! Status: ${retryRes.status}`);
                 console.log(`[IC Debug] Retry Body: ${await retryRes.text()}`);
               }
             }
           } catch(e) {
             console.log("[IC Debug] Self-healing failed:", e);
           }
        }
      }
    } catch (e) {
      console.error(`[IC Debug] Modern API network error:`, e);
    }
  }

  if (!fetched && courses.length === 0) {
    return NextResponse.json(
      { error: "Session expired or unable to fetch grades. Please log in again." },
      { status: 401 }
    );
  }

  console.log(`[IC Courses] Pre-sync check: uid=${uid}, courses=${courses.length}`);
  // Persist to DB in the background (don't block the response)
  if (uid && courses.length > 0) {
    // Extract email/displayName from the JWT payload for user upsert
    let email = "";
    let displayName = "";
    try {
      const payload = req.headers.get("authorization")!.slice(7).split(".")[1];
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      email = parsed.email ?? "";
      displayName = parsed.name ?? parsed.email ?? "";
    } catch {}

    await syncICCoursesToDB(uid, email, displayName, courses).catch((e: unknown) =>
      console.error("[IC Courses] DB sync error:", e)
    );
  }

  return NextResponse.json({ courses, source: "ic" });
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
    const assignmentsMap = new Map<string, ICAssignment>();

    // Helper to find scores recursively inside the course section, because different districts nest them differently
    function findGrades(node: any) {
      if (!node || typeof node !== "object") return;

      const score = node.score ?? node.percent ?? node.grade?.percent ?? node.currentGrade?.percent ?? node.progressPercent ?? node.progressScore;
      const letter = node.gradeCalculated ?? node.grade?.letter ?? node.letter ?? node.currentGrade?.letter ?? node.progressGrade;
      if (score != null && !isNaN(Number(score))) {
        currentGrade = parseFloat(score);
        if (letter) letterGrade = letter;
      }

      // Extract individual assignments from known field names
      const assignmentList = node.assignments ?? node.tasks ?? node.gradebookEntries ?? node.items;
      if (Array.isArray(assignmentList)) {
        for (const a of assignmentList) {
          const aName = a.assignmentName ?? a.name ?? a.title ?? "";
          if (!aName) continue;
          const aDue = a.dueDate ?? a.due ?? null;
          const aKey = String(a.assignmentID ?? a.id ?? `${id}_${aName}_${aDue ?? ""}`);
          const aScore = a.score != null && !isNaN(Number(a.score)) ? parseFloat(a.score) : null;
          const aMax = a.totalPoints ?? a.pointsPossible ?? a.maxScore ?? null;
          const isMissing =
            !!(a.missing ?? a.isMissing) ||
            (typeof a.turnInStatus === "string" && a.turnInStatus.toUpperCase() === "MISSING") ||
            (typeof a.status === "string" && a.status.toUpperCase() === "MISSING") ||
            a.scoreMarkingCode === "M" ||
            (Array.isArray(a.flags) && a.flags.some((f: unknown) => typeof f === "string" && f.toUpperCase() === "MISSING"));
          if (isMissing) missingCount += 1;
          assignmentsMap.set(aKey, {
            key: aKey,
            name: aName,
            score: aScore,
            maxScore: aMax != null && !isNaN(Number(aMax)) ? parseFloat(aMax) : null,
            dueDate: aDue ? String(aDue) : undefined,
          });
        }
      }

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

    const assignments = Array.from(assignmentsMap.values());

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
        teacher: cs.teacherDisplay ?? cs.teacher ?? cs.teacherName ?? cs.staffDisplayName ?? cs.instructorName ?? null,
        period: cs.sectionNumber ?? cs.period ?? null,
        assignments,
      });
    } else if (existing) {
       // Accrue missing assignments if the course is duplicate across terms
       existing.missingCount += missingCount;
       if (!existing.currentGrade && currentGrade) {
          existing.currentGrade = currentGrade;
          existing.letterGrade = letterGrade;
       }
       // Merge assignments from duplicate sections
       for (const a of assignments) {
         if (!existing.assignments.some((ea) => ea.key === a.key)) {
           existing.assignments.push(a);
         }
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
