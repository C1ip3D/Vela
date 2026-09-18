import {
  fetchAssignments as fetchAssignmentsShared,
  fetchCourses as fetchCoursesShared,
} from "@vela/ic-client";
import type { ICAssignmentGroup, ICCourse } from "@vela/ic-client";
import { getStoredIcSession, toIcSession } from "./icSession";

export type { ICCourse, ICAssignmentGroup };

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
