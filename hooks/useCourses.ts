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
    const boost = c.courseType === "AP" ? 1.0 : c.courseType === "HONORS" ? 0.84 : 0;
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

export function useCourses() {
  const { session, isConnected } = useIC();
  const [courses, setCourses] = useState<NormalizedCourse[]>([]);
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
      const res = await fetch("/api/ic/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken && { Authorization: `Bearer ${idToken}` }),
        },
        body: JSON.stringify({
          authToken: session.authToken,
          baseUrl: session.baseUrl,
          appName: session.appName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to load courses");
        setCourses([]);
        return;
      }

      const normalized: NormalizedCourse[] = (data.courses as any[]).map((c) => ({
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
      }));

      setCourses(normalized);
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

  return { courses, gradedCourses, loading, error, gpa, refetch: fetchCourses };
}
