"use client";
import { useState, useEffect, useCallback } from "react";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { auth } from "@/lib/firebase";

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
  if (score >= 89.5) return "A";
  if (score >= 79.5) return "B";
  if (score >= 69.5) return "C";
  if (score >= 59.5) return "D";
  return "F";
}

function letterToGpaPoints(letter: string): number {
  const map: Record<string, number> = {
    A: 4.0,
    B: 3.0,
    C: 2.0,
    D: 1.0,
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
      c.courseType === "AP" || c.courseType === "HONORS" ? 1 : 0;
    totalW += base + boost;
  }

  return {
    unweighted: parseFloat((totalU / graded.length).toFixed(2)),
    weighted: parseFloat((totalW / graded.length).toFixed(2)),
  };
}

function stripDesignation(name: string): string {
  return name.replace(/\s*\((HP|P|H)\)\s*$/i, "").trim();
}

export interface GpaHistoryPoint {
  date: string;
  gpa: number;
  term: number;
}

export function useCourses() {
  const { session, isConnected } = useIC();
  const [courses, setCourses] = useState<NormalizedCourse[]>([]);
  const [gpaHistory, setGpaHistory] = useState<GpaHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    if (!isConnected || !session) {
      setCourses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const authHeaders = {
        "Content-Type": "application/json",
        ...(idToken && { Authorization: `Bearer ${idToken}` }),
      };

      const [coursesRes, historyRes] = await Promise.all([
        fetch("/api/ic/courses", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            authToken: session.authToken,
            baseUrl: session.baseUrl,
            appName: session.appName,
          }),
        }),
        fetch("/api/ic/gpa-history", { headers: authHeaders }),
      ]);

      const data = await coursesRes.json();

      if (!coursesRes.ok) {
        setError(data.error || "Failed to load courses");
        setCourses([]);
        return;
      }

      const normalized: NormalizedCourse[] = (data.courses as any[]).map(
        (c) => ({
          id: c.id,
          name: stripDesignation(c.name),
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
        }),
      );

      setCourses(normalized);

      // Fetch assignments for each course in parallel to compute accurate missingCount.
      // The main grades endpoint doesn't embed assignment details for all districts.
      Promise.all(
        normalized.map(async (course) => {
          try {
            const res = await fetch("/api/ic/assignments", {
              method: "POST",
              headers: authHeaders,
              body: JSON.stringify({
                authToken: session.authToken,
                baseUrl: session.baseUrl,
                appName: session.appName,
                courseId: course.id,
              }),
            });
            if (!res.ok) return { id: course.id, count: 0 };
            const data = await res.json();
            const groups: any[] = data.groups ?? [];
            const count = groups.reduce(
              (sum: number, g: any) => sum + g.assignments.filter((a: any) => a.missing).length,
              0,
            );
            return { id: course.id, count };
          } catch {
            return { id: course.id, count: 0 };
          }
        }),
      ).then((results) => {
        const missingMap = new Map(results.map((r) => [r.id, r.count]));
        setCourses((prev) =>
          prev.map((c) => ({ ...c, missingCount: missingMap.get(c.id) ?? c.missingCount })),
        );
      });

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setGpaHistory(historyData.snapshots ?? []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [session, isConnected]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const gradedCourses = courses.filter((c) => c.currentGrade != null);
  const gpa = computeGpa(gradedCourses);

  return {
    courses,
    gradedCourses,
    loading,
    error,
    gpa,
    gpaHistory,
    refetch: fetchCourses,
  };
}
