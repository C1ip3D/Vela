import { useState, useEffect, useCallback } from "react";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { api } from "@/lib/api";

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

function scoreToLetter(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

function letterToGpaPoints(letter: string): number {
  const map: Record<string, number> = {
    "A+": 4.0, A: 4.0, "A-": 4.0,
    "B+": 3.0, B: 3.0, "B-": 3.0,
    "C+": 2.0, C: 2.0, "C-": 2.0,
    "D+": 1.0, D: 1.0, "D-": 1.0,
    F: 0.0,
  };
  return map[letter] ?? 0.0;
}

function computeGpa(courses: NormalizedCourse[]) {
  const graded = courses.filter((c) => c.currentGrade != null);
  if (graded.length === 0) return { weighted: 0, unweighted: 0 };

  let totalU = 0;
  let totalW = 0;
  for (const c of graded) {
    const letter = c.letterGrade || scoreToLetter(c.currentGrade!);
    const base = letterToGpaPoints(letter);
    totalU += base;
    const boost =
      c.courseType === "AP" ? 1.0 : c.courseType === "HONORS" ? 0.84 : 0;
    totalW += base + boost;
  }

  return {
    unweighted: parseFloat((totalU / graded.length).toFixed(2)),
    weighted: parseFloat((totalW / graded.length).toFixed(2)),
  };
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
