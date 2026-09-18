import { icAppQuery, icFetch } from "./client";
import {
  extractAssignmentsFromGrades,
  filterToCurrentSemester,
  parseCoursesResilient,
  parseLegacyAssignments,
  parsePrismAssignments,
} from "./parsers";
import type { ICAssignmentGroup, ICCourse, IcSession } from "./types";

/**
 * Fetches the student's active courses and current grades from Infinite
 * Campus, trying endpoints in order until one returns data (different
 * districts and IC versions expose different undocumented APIs).
 */
export async function fetchCourses(session: IcSession): Promise<ICCourse[]> {
  const q = icAppQuery(session);

  // Endpoint 1: prism API (newer IC versions)
  try {
    const res = await icFetch(session, `/prism/api/portal/grades${q}`);
    if (res.ok) {
      const parsed = parseCoursesResilient(await res.json());
      if (parsed.length > 0) return parsed;
    }
  } catch {}

  // Endpoint 2: legacy resources/portal/grades
  try {
    const res = await icFetch(session, `/resources/portal/grades${q}`);
    if (res.ok) {
      const parsed = parseCoursesResilient(await res.json());
      if (parsed.length > 0) return parsed;
    }
  } catch {}

  // Endpoint 3: /api/portal/students -> /api/portal/students/{id}/grades
  try {
    const studentsRes = await icFetch(session, `/api/portal/students${q}`);
    if (studentsRes.ok) {
      const studentsData = await studentsRes.json();
      const studentsList = Array.isArray(studentsData) ? studentsData : (studentsData.data ?? []);
      const courses: ICCourse[] = [];
      for (const student of studentsList) {
        const personId = student.personID ?? student.personId ?? student.id;
        if (personId) {
          const gradesRes = await icFetch(session, `/api/portal/students/${personId}/grades${q}`);
          if (gradesRes.ok) {
            courses.push(...parseCoursesResilient(await gradesRes.json()));
          }
        }
      }
      if (courses.length > 0) return courses;
    } else if (studentsRes.status === 400) {
      // Self-healing: IC sometimes tells us the correct appName in the error body
      const errText = await studentsRes.text();
      if (errText.includes("conflicting app name values")) {
        try {
          const recoveredAppName = JSON.parse(errText).appName;
          if (recoveredAppName) {
            const retrySession: IcSession = { ...session, appName: recoveredAppName };
            const retryQ = icAppQuery(retrySession);
            const retryRes = await icFetch(retrySession, `/api/portal/students${retryQ}`);
            if (retryRes.ok) {
              const studentsData = await retryRes.json();
              const studentsList = Array.isArray(studentsData) ? studentsData : (studentsData.data ?? []);
              const courses: ICCourse[] = [];
              for (const student of studentsList) {
                const personId = student.personID ?? student.personId ?? student.id;
                if (personId) {
                  const gradesRes = await icFetch(retrySession, `/api/portal/students/${personId}/grades${retryQ}`);
                  if (gradesRes.ok) {
                    courses.push(...parseCoursesResilient(await gradesRes.json()));
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

/**
 * Fetches detailed assignment groups (categories) for one course, trying
 * endpoints in order and falling back to extracting from the full grades
 * payload when a dedicated assignments endpoint isn't available.
 */
export async function fetchAssignments(session: IcSession, courseId: string): Promise<ICAssignmentGroup[]> {
  const q = icAppQuery(session);
  const aq = session.appName ? `&appName=${encodeURIComponent(session.appName)}` : "";
  let groups: ICAssignmentGroup[] = [];
  // Tracks whether ANY endpoint returned a successful (non-auth) response, so
  // a caller can distinguish "session expired" from "IC responded but this
  // course genuinely has no assignment data yet".
  let gotSuccessfulResponse = false;

  // Endpoint 1: prism assignmentDetail
  try {
    const res = await icFetch(session, `/prism/api/portal/grades/assignmentDetail?courseSectionID=${courseId}${aq}`);
    if (res.ok) {
      gotSuccessfulResponse = true;
      const parsed = parsePrismAssignments(await res.json());
      if (parsed.length > 0) groups = parsed;
    }
  } catch {}

  // Endpoint 2: legacy resources assignment
  if (groups.length === 0) {
    try {
      const res = await icFetch(session, `/resources/portal/assignment?courseSectionID=${courseId}${aq}`);
      if (res.ok) {
        gotSuccessfulResponse = true;
        const parsed = parseLegacyAssignments(await res.json());
        if (parsed.length > 0) groups = parsed;
      }
    } catch {}
  }

  // Fetch the grades payload once — used for alternate IDs and as a fallback source
  let rosterID: string | null = null;
  let altID: string | null = null;
  let gradesData: any = null;
  try {
    const gradesRes = await icFetch(session, `/resources/portal/grades${q}`);
    if (gradesRes.ok) {
      gotSuccessfulResponse = true;
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
        const res = await icFetch(session, `/resources/portal/grades/detail/${id}${q}`);
        if (res.ok) {
          gotSuccessfulResponse = true;
          const parsed = parseLegacyAssignments(await res.json());
          if (parsed.length > 0) groups = parsed;
        }
      } catch {}
    }
  }

  // Endpoint 4: extract from the grades payload already fetched above
  if (groups.length === 0 && gradesData) {
    const extracted = extractAssignmentsFromGrades(gradesData, courseId);
    if (extracted.length > 0) groups = extracted;
  }

  // Endpoint 5/6: student-specific assignments endpoints (legacy + prism)
  if (groups.length === 0 && session.personId) {
    const ids = [...new Set([rosterID, altID, courseId].filter(Boolean))] as string[];
    for (const id of ids) {
      if (groups.length > 0) break;
      try {
        const res = await icFetch(session, `/api/portal/students/${session.personId}/assignments?courseSectionID=${id}${aq}`);
        if (res.ok) {
          gotSuccessfulResponse = true;
          const parsed = parseLegacyAssignments(await res.json());
          if (parsed.length > 0) groups = parsed;
        }
      } catch {}
    }
    for (const id of ids) {
      if (groups.length > 0) break;
      try {
        const res = await icFetch(session, `/prism/api/portal/students/${session.personId}/assignments?courseSectionID=${id}${aq}`);
        if (res.ok) {
          gotSuccessfulResponse = true;
          const parsed = parsePrismAssignments(await res.json());
          if (parsed.length > 0) groups = parsed;
        }
      } catch {}
    }
  }

  // Only throw if we never got any successful response from IC (token fully
  // expired) — if IC responded but had no assignment data, return an empty
  // array so the caller can still show the grade without an error banner.
  if (!gotSuccessfulResponse) {
    throw new Error("Session expired or could not reach Infinite Campus.");
  }

  return filterToCurrentSemester(groups);
}

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

/** Resolves the IC personId + display name for a freshly authenticated session (used right after login). */
export async function fetchPersonInfo(session: IcSession): Promise<{ personId: string; displayName: string } | null> {
  const q = icAppQuery(session);

  try {
    const res = await icFetch(session, `/prism/api/portal/person${q}`);
    if (res.ok) {
      const result = extractPersonFromData(await res.json());
      if (result) return result;
    }
  } catch {}

  try {
    const res = await icFetch(session, `/api/portal/students${q}`);
    if (res.ok) {
      const data = await res.json();
      const students = Array.isArray(data) ? data : (data?.data ?? []);
      if (students.length > 0) {
        const result = extractPersonFromData(students[0]);
        if (result) return result;
      }
    }
  } catch {}

  try {
    const res = await icFetch(session, `/resources/portal/grades${q}`);
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

  try {
    const res = await icFetch(session, `/prism/api/portal/grades${q}`);
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
