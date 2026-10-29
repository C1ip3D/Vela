import { useState, useEffect, useCallback, useRef } from "react";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { api } from "@/lib/api";
import { fetchCourses as fetchIcCourses, withIcReauth } from "@/lib/icApi";
import { calculateGpa, percentageToLetter } from "@vela/domain";

export interface NormalizedCourse {
  id: string;
  name: string;
  courseCode: string;
  term: string;
  courseType: string;
  currentGrade: number | null;
  letterGrade: string | null;
  missingCount: number;
  teacher?: string | null;
  period?: string | null;
}

const scoreToLetter = percentageToLetter;

function computeGpa(courses: NormalizedCourse[]) {
  const graded = courses.filter((c) => c.currentGrade != null);
  if (graded.length === 0) return { weighted: 0, unweighted: 0 };

  const result = calculateGpa(
    graded.map((c) => ({
      courseId: c.id,
      courseName: c.name,
      percentage: c.currentGrade!,
      courseType: c.courseType,
      creditHours: 1,
    }))
  );
  return { weighted: result.weighted, unweighted: result.unweighted };
}

export function useCourses() {
  const { session, isConnected, isInitializing, reauth } = useIC();
  const [courses, setCourses] = useState<NormalizedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Refetch when *who* is signed in changes, not every time reauth swaps in
  // fresh cookies for the same student (the in-flight fetch already retried
  // with them via withIcReauth).
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const sessionKey = session ? `${session.baseUrl}|${session.personId ?? ""}` : null;

  const fetchCourses = useCallback(async (currentSession = sessionRef.current) => {
    if (!isConnected || !currentSession) {
      setCourses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Straight from IC on the device, so grades load without the backend.
      let usedSession = currentSession;
      const icCourses = await withIcReauth(currentSession, reauth, (s) => {
        usedSession = s;
        return fetchIcCourses(s);
      });

      // Best-effort: let the backend snapshot grades into the DB (history,
      // advisor feed). Failure here never affects what the app shows.
      api
        .post("/api/ic/courses", {
          authToken: usedSession.authToken,
          baseUrl: usedSession.baseUrl,
          appName: usedSession.appName,
          personId: usedSession.personId,
          districtName: usedSession.districtName,
          stateCode: usedSession.stateCode,
        })
        .catch(() => {});

      const normalized: NormalizedCourse[] = icCourses.map((c) => ({
        id: c.id,
        name: c.name,
        courseCode: c.courseCode,
        term: c.term,
        courseType: c.courseType,
        currentGrade: c.currentGrade,
        letterGrade:
          c.letterGrade ??
          (c.currentGrade != null ? scoreToLetter(c.currentGrade) : null),
        missingCount: c.missingCount ?? 0,
        teacher: c.teacher ?? null,
        period: c.period ?? null,
      }));

      setCourses(normalized);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setCourses([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, isConnected, reauth]);

  useEffect(() => {
    // Wait until SecureStore has been read before deciding whether to fetch
    if (isInitializing) return;
    fetchCourses();
  }, [fetchCourses, isInitializing]);

  const gradedCourses = courses.filter((c) => c.currentGrade != null);
  const gpa = computeGpa(gradedCourses);

  return { courses, gradedCourses, loading, error, gpa, refetch: fetchCourses };
}
