import {
  buildIcHeaders,
  icAppQuery,
  fetchAssignments as fetchAssignmentsShared,
  fetchCourses as fetchCoursesShared,
  fetchResponsiveSchedule as fetchResponsiveScheduleShared,
  searchIcDistricts,
} from "@vela/ic-client";
import type {
  ICAssignmentGroup,
  ICCourse,
  IcDistrictSearchResult,
  ICResponsiveOffering,
  ICResponsiveSession,
} from "@vela/ic-client";
import { getStoredIcSession, toIcSession, type StoredIcSession } from "./icSession";

export type { ICCourse, ICAssignmentGroup, IcDistrictSearchResult, ICResponsiveOffering, ICResponsiveSession };

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

export async function fetchResponsiveSchedule(session?: StoredIcSession): Promise<ICResponsiveSession[]> {
  return fetchResponsiveScheduleShared(await requireSession(session));
}

export async function searchDistricts(query: string, stateCode: string): Promise<IcDistrictSearchResult[]> {
  return searchIcDistricts(query, stateCode);
}

const IC_PROBE_TIMEOUT_MS = 8000;

/** Resolves to `fallback` instead of hanging when `promise` takes longer than `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IC_PROBE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function isIcReachable(baseUrl: string): Promise<boolean> {
  try {
    await fetchWithTimeout(baseUrl, { method: "HEAD" });
    return true;
  } catch {
    return false;
  }
}

export type IcAuthState = "valid" | "expired" | "unknown";

/**
 * Asks IC directly whether this session's cookies are still logged in, so a
 * 5xx, timeout or rate limit ("unknown") is never mistaken for an expired
 * session and used as a reason to log the user out.
 */
export async function probeIcAuth(session: StoredIcSession): Promise<IcAuthState> {
  const ic = toIcSession(session);
  try {
    const res = await fetchWithTimeout(`${ic.baseUrl}/prism/api/portal/person${icAppQuery(ic)}`, {
      headers: buildIcHeaders(ic),
    });
    if (res.status === 401 || res.status === 403) return "expired";
    // IC usually answers an expired session by redirecting to its HTML
    // login page (which fetch follows) rather than with a 401.
    if (/\/portal\/students\/|login/i.test(res.url) && !/\/prism\/api\//i.test(res.url)) return "expired";
    if (res.ok) {
      return (res.headers.get("content-type") ?? "").includes("json") ? "valid" : "expired";
    }
    return "unknown";
  } catch {
    return "unknown";
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
