import {
  fetchAssignments as fetchAssignmentsShared,
  fetchCourses as fetchCoursesShared,
  searchIcDistricts,
} from "@vela/ic-client";
import type { ICAssignmentGroup, ICCourse, IcDistrictSearchResult } from "@vela/ic-client";
import { getStoredIcSession, toIcSession, type StoredIcSession } from "./icSession";

export type { ICCourse, ICAssignmentGroup, IcDistrictSearchResult };

// All of these call Infinite Campus straight from the device — no Vela
// backend involved, so grades keep loading even when the backend is down.

async function requireSession(session?: StoredIcSession) {
  const stored = session ?? (await getStoredIcSession());
  if (!stored) throw new Error("Not authenticated");
  return toIcSession(stored);
}

export async function fetchCourses(session?: StoredIcSession): Promise<ICCourse[]> {
  return fetchCoursesShared(await requireSession(session));
}

export async function fetchAssignments(
  courseId: string,
  session?: StoredIcSession
): Promise<ICAssignmentGroup[]> {
  return fetchAssignmentsShared(await requireSession(session), courseId);
}

export async function searchDistricts(query: string, stateCode: string): Promise<IcDistrictSearchResult[]> {
  return searchIcDistricts(query, stateCode);
}

async function isIcReachable(baseUrl: string): Promise<boolean> {
  try {
    await fetch(baseUrl, { method: "HEAD" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Runs `fn` against the session, and on failure retries once with whatever
 * `reauth` returns. @vela/ic-client folds network errors into the same
 * "session expired" error as a real 401, so this first checks IC is
 * reachable at all — otherwise being offline would make reauth clear a
 * perfectly valid session and log the user out.
 */
export async function withIcReauth<T>(
  session: StoredIcSession,
  reauth: () => Promise<StoredIcSession | null>,
  fn: (s: StoredIcSession) => Promise<T>
): Promise<T> {
  try {
    return await fn(session);
  } catch (err) {
    if (!(await isIcReachable(session.baseUrl))) throw err;
    const fresh = await reauth();
    if (!fresh) throw err;
    return fn(fresh);
  }
}
