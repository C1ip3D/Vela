import { useState, useEffect, useCallback } from "react";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { api } from "@/lib/api";
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

  const fetchCourses = useCallback(async (currentSession = session) => {
    if (!isConnected || !currentSession) {
      setCourses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const doFetch = async (s: typeof currentSession) => {
      const res = await api.post("/api/ic/courses", {
        authToken: s!.authToken,
        baseUrl: s!.baseUrl,
        appName: s!.appName,
      });
      return res.data;
    };

    try {
      let data: any;
      try {
        data = await doFetch(currentSession);
      } catch (err: any) {
        // Auto-reauth on 401 then retry once with the fresh session
        if (err?.response?.status === 401) {
          const newSession = await reauth();
          if (newSession) {
            data = await doFetch(newSession);
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }

      const normalized: NormalizedCourse[] = (data.courses as any[]).map((c) => ({
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
  }, [session, isConnected, reauth]);

  useEffect(() => {
    // Wait until SecureStore has been read before deciding whether to fetch
    if (isInitializing) return;
    fetchCourses();
  }, [fetchCourses, isInitializing]);

  const gradedCourses = courses.filter((c) => c.currentGrade != null);
  const gpa = computeGpa(gradedCourses);

  return { courses, gradedCourses, loading, error, gpa, refetch: fetchCourses };
}
