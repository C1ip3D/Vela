import {
  fetchAssignments as fetchAssignmentsShared,
  fetchCourses as fetchCoursesShared,
  fetchSchedule as fetchScheduleShared,
} from "@vela/ic-client";
import type { ICAssignmentGroup, ICCourse, ICPeriod } from "@vela/ic-client";
import { getStoredIcSession, toIcSession } from "./icSession";

export type { ICCourse, ICAssignmentGroup, ICPeriod };

async function requireSession() {
  const stored = await getStoredIcSession();
  if (!stored) throw new Error("Not authenticated");
  return toIcSession(stored);
}

export async function fetchCourses(): Promise<ICCourse[]> {
  return fetchCoursesShared(await requireSession());
}

export async function fetchAssignments(courseId: string): Promise<ICAssignmentGroup[]> {
  return fetchAssignmentsShared(await requireSession(), courseId);
}

export async function fetchSchedule(): Promise<ICPeriod[]> {
  return fetchScheduleShared(await requireSession());
}
