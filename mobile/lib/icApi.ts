// v2
import { getSession, icFetch, icFetchWithSession, appQuery, VelaSession } from "./icClient";
export type { VelaSession };
import {
  ICCourse,
  ICAssignmentGroup,
  parseCoursesResilient,
  parsePrismAssignments,
  parseLegacyAssignments,
  extractAssignmentsFromGrades,
  filterToCurrentSemester,
} from "./icParsers";

export type { ICCourse, ICAssignmentGroup };

// ── Fetch courses / grades ────────────────────────────────────────────────────

export async function fetchCourses(): Promise<ICCourse[]> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const q = appQuery(session);

  // Endpoint 1: prism API
  try {
    const res = await icFetch(`/prism/api/portal/grades${q}`);
    if (res.ok) {
      const data = await res.json();
      const parsed = parseCoursesResilient(data);
      if (parsed.length > 0) return parsed;
    }
  } catch {}

  // Endpoint 2: legacy resources/portal/grades
  try {
    const res = await icFetch(`/resources/portal/grades${q}`);
    if (res.ok) {
      const data = await res.json();
      const parsed = parseCoursesResilient(data);
      if (parsed.length > 0) return parsed;
    }
  } catch {}

  // Endpoint 3: /api/portal/students -> /api/portal/students/{id}/grades
  try {
    const studentsRes = await icFetch(`/api/portal/students${q}`);
    if (studentsRes.ok) {
      const studentsData = await studentsRes.json();
      const studentsList = Array.isArray(studentsData) ? studentsData : (studentsData.data ?? []);
      const courses: ICCourse[] = [];
      for (const student of studentsList) {
        const personId = student.personID ?? student.personId ?? student.id;
        if (personId) {
          const gradesRes = await icFetch(`/api/portal/students/${personId}/grades${q}`);
          if (gradesRes.ok) {
            const data = await gradesRes.json();
            const parsed = parseCoursesResilient(data);
            courses.push(...parsed);
          }
        }
      }
      if (courses.length > 0) return courses;
    } else if (studentsRes.status === 400) {
      const errText = await studentsRes.text();
      if (errText.includes("conflicting app name values")) {
        try {
          const errJson = JSON.parse(errText);
          const recoveredAppName = errJson.appName;
          if (recoveredAppName) {
            const retryQ = `?appName=${encodeURIComponent(recoveredAppName)}`;
            const retrySession: VelaSession = { ...session, appName: recoveredAppName };
            const retryRes = await icFetchWithSession(retrySession, `/api/portal/students${retryQ}`);
            if (retryRes.ok) {
              const studentsData = await retryRes.json();
              const studentsList = Array.isArray(studentsData) ? studentsData : (studentsData.data ?? []);
              const courses: ICCourse[] = [];
              for (const student of studentsList) {
                const personId = student.personID ?? student.personId ?? student.id;
                if (personId) {
                  const gradesRes = await icFetchWithSession(retrySession, `/api/portal/students/${personId}/grades${retryQ}`);
                  if (gradesRes.ok) {
                    const data = await gradesRes.json();
                    courses.push(...parseCoursesResilient(data));
                  }
                }
              }
              if (courses.length > 0) return courses;
            }
          }
        } catch {}
      }
    }
  } catch {}

  throw new Error("Session expired or unable to fetch grades. Please log in again.");
}

// ── Fetch assignment detail for a course ──────────────────────────────────────

export async function fetchAssignments(courseId: string): Promise<ICAssignmentGroup[]> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const q = appQuery(session);
  const aq = `&appName=${encodeURIComponent(session.appName)}`;
  let groups: ICAssignmentGroup[] = [];
  let gradesData: any = null;

  // Endpoint 1: prism assignmentDetail
  try {
    const res = await icFetch(`/prism/api/portal/grades/assignmentDetail?courseSectionID=${courseId}${aq}`);
    if (res.ok) {
      const data = await res.json();
      const parsed = parsePrismAssignments(data);
      if (parsed.length > 0) groups = parsed;
    }
  } catch {}

  // Endpoint 2: legacy resources assignment
  if (groups.length === 0) {
    try {
      const res = await icFetch(`/resources/portal/assignment?courseSectionID=${courseId}${aq}`);
      if (res.ok) {
        const data = await res.json();
        const parsed = parseLegacyAssignments(data);
        if (parsed.length > 0) groups = parsed;
      }
    } catch {}
  }

  // Fetch grades payload for alternate IDs and fallback extraction
  let rosterID: string | null = null;
  let altID: string | null = null;
  try {
    const gradesRes = await icFetch(`/resources/portal/grades${q}`);
    if (gradesRes.ok) {
      gradesData = await gradesRes.json();
      const allCourses: any[] = (gradesData ?? []).flatMap((e: any) =>
        (e?.terms ?? []).flatMap((t: any) => t?.courses ?? [])
      );
      const match = allCourses.find(
        (c: any) =>
          String(c?.sectionID) === courseId ||
          String(c?.courseSectionID) === courseId ||
          String(c?._id) === courseId ||
          String(c?.rosterID) === courseId
      );
      if (match) {
        rosterID = match.rosterID != null ? String(match.rosterID) : null;
        altID = match._id != null ? String(match._id) : null;
      }
    }
  } catch {}

  // Endpoint 3: detail endpoint with alternate IDs
  if (groups.length === 0) {
    const detailIds = [...new Set([courseId, rosterID, altID].filter(Boolean))] as string[];
    for (const id of detailIds) {
      if (groups.length > 0) break;
      try {
        const res = await icFetch(`/resources/portal/grades/detail/${id}${q.replace("?", "&") ? q : ""}`);
        if (res.ok) {
          const data = await res.json();
          const parsed = parseLegacyAssignments(data);
          if (parsed.length > 0) groups = parsed;
        }
      } catch {}
    }
  }

  // Endpoint 4: extract from grades payload
  if (groups.length === 0 && gradesData) {
    const extracted = extractAssignmentsFromGrades(gradesData, courseId);
    if (extracted.length > 0) groups = extracted;
  }

  // Endpoint 5: student-specific assignments endpoint
  if (groups.length === 0 && session.personId) {
    const ids = [...new Set([rosterID, altID, courseId].filter(Boolean))] as string[];
    for (const id of ids) {
      if (groups.length > 0) break;
      try {
        const res = await icFetch(`/api/portal/students/${session.personId}/assignments?courseSectionID=${id}${aq}`);
        console.log(`[fetchAssignments:${courseId}] ep5 id=${id} status=${res.status}`);
        if (res.ok) {
          const data = await res.json();
          const parsed = parseLegacyAssignments(data);
          if (parsed.length > 0) groups = parsed;
        }
      } catch {}
    }
  }

  // Endpoint 6: prism student assignments
  if (groups.length === 0 && session.personId) {
    const ids = [...new Set([rosterID, altID, courseId].filter(Boolean))] as string[];
    for (const id of ids) {
      if (groups.length > 0) break;
      try {
        const res = await icFetch(`/prism/api/portal/students/${session.personId}/assignments?courseSectionID=${id}${aq}`);
        console.log(`[fetchAssignments:${courseId}] ep6 id=${id} status=${res.status}`);
        if (res.ok) {
          const data = await res.json();
          const parsed = parsePrismAssignments(data);
          if (parsed.length > 0) groups = parsed;
        }
      } catch {}
    }
  }

  return filterToCurrentSemester(groups);
}

// ── Fetch schedule ────────────────────────────────────────────────────────────

export interface ICPeriod {
  periodNumber: string;
  courseName: string;
  teacher: string | null;
  room: string | null;
  startTime: string | null;
  endTime: string | null;
}

export async function fetchSchedule(): Promise<ICPeriod[]> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const q = appQuery(session);

  // Try prism schedule endpoint
  try {
    const res = await icFetch(`/prism/api/portal/schedule${q}`);
    if (res.ok) {
      const data = await res.json();
      const parsed = parseSchedule(data);
      if (parsed.length > 0) return parsed;
    }
  } catch {}

  // Try student-specific schedule endpoint
  try {
    const res = await icFetch(`/api/portal/students/${session.personId}/schedule${q}`);
    if (res.ok) {
      const data = await res.json();
      const parsed = parseSchedule(data);
      if (parsed.length > 0) return parsed;
    }
  } catch {}

  // Fallback: build from courses (period numbers already returned)
  const courses = await fetchCourses();
  return courses
    .filter((c) => c.period != null)
    .map((c) => ({
      periodNumber: c.period!,
      courseName: c.name,
      teacher: c.teacher,
      room: null,
      startTime: null,
      endTime: null,
    }))
    .sort((a, b) => {
      const pa = parseInt(a.periodNumber) || 0;
      const pb = parseInt(b.periodNumber) || 0;
      return pa - pb;
    });
}

function parseSchedule(data: any): ICPeriod[] {
  const periods: ICPeriod[] = [];
  const items: any[] = Array.isArray(data) ? data : (data?.data ?? data?.periods ?? data?.schedule ?? []);

  for (const item of items) {
    const periodNumber = String(item?.period ?? item?.periodNumber ?? item?.periodName ?? "");
    if (!periodNumber) continue;
    periods.push({
      periodNumber,
      courseName: item?.courseName ?? item?.name ?? item?.course ?? "Unknown",
      teacher: item?.teacherDisplay ?? item?.teacher ?? item?.teacherName ?? null,
      room: item?.roomName ?? item?.room ?? item?.roomNumber ?? null,
      startTime: item?.startTime ?? item?.start ?? null,
      endTime: item?.endTime ?? item?.end ?? null,
    });
  }

  return periods.sort((a, b) => {
    const pa = parseInt(a.periodNumber) || 0;
    const pb = parseInt(b.periodNumber) || 0;
    return pa - pb;
  });
}

// ── Fetch person info (used during login to get personId) ─────────────────────

function extractPersonFromData(data: any): { personId: string; displayName: string } | null {
  const person = Array.isArray(data) ? data[0] : (data?.data?.[0] ?? data);
  if (!person) return null;
  const personId = String(person?.personID ?? person?.personId ?? person?.id ?? "");
  if (!personId) return null;
  const displayName =
    person?.firstName && person?.lastName
      ? `${person.firstName} ${person.lastName}`
      : person?.displayName ?? person?.name ?? "";
  return { personId, displayName };
}

export async function fetchPersonInfo(session: VelaSession): Promise<{ personId: string; displayName: string } | null> {
  const q = `?appName=${encodeURIComponent(session.appName)}`;

  // Endpoint 1: prism person
  try {
    const res = await icFetchWithSession(session, `/prism/api/portal/person${q}`);
    if (res.ok) {
      const result = extractPersonFromData(await res.json());
      if (result) return result;
    }
  } catch {}

  // Endpoint 2: api/portal/students
  try {
    const res = await icFetchWithSession(session, `/api/portal/students${q}`);
    if (res.ok) {
      const data = await res.json();
      const students = Array.isArray(data) ? data : (data?.data ?? []);
      if (students.length > 0) {
        const result = extractPersonFromData(students[0]);
        if (result) return result;
      }
    }
  } catch {}

  // Endpoint 3: resources/portal/grades — personId often embedded in enrollment data
  try {
    const res = await icFetchWithSession(session, `/resources/portal/grades${q}`);
    if (res.ok) {
      const data = await res.json();
      const enrollment = Array.isArray(data) ? data[0] : data;
      const personId = String(
        enrollment?.personID ?? enrollment?.personId ??
        enrollment?.student?.personID ?? enrollment?.student?.personId ?? ""
      );
      if (personId) {
        const displayName =
          enrollment?.student?.displayName ??
          enrollment?.displayName ??
          enrollment?.student?.name ?? "";
        return { personId, displayName };
      }
    }
  } catch {}

  // Endpoint 4: prism/api/portal/grades — personId in student object
  try {
    const res = await icFetchWithSession(session, `/prism/api/portal/grades${q}`);
    if (res.ok) {
      const data = await res.json();
      const item = Array.isArray(data) ? data[0] : (data?.data?.[0] ?? data);
      const personId = String(item?.personID ?? item?.personId ?? item?.student?.personID ?? "");
      if (personId) {
        const displayName = item?.student?.displayName ?? item?.displayName ?? "";
        return { personId, displayName };
      }
    }
  } catch {}

  return null;
}
