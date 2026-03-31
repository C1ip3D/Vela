"use client";
import { useState, useEffect, useCallback } from "react";
import { useClassroom } from "@/contexts/ClassroomContext";
import { getMockClassroomCourses } from "@/lib/classroom/client";
import type { NormalizedCourse } from "./useCanvasCourses";

// ── Weight template shape (stored in localStorage per course) ──────────────
export interface WeightTemplate {
  id: string;
  name: string;
  weight: number;  // fraction 0–1
  dropLowest: number;
}

const WEIGHTS_STORAGE_PREFIX = "vela_classroom_weights_";

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

/** Read weight templates stored for a Classroom course from localStorage. */
export function getLocalWeightTemplates(courseId: string): WeightTemplate[] {
  try {
    const raw = localStorage.getItem(`${WEIGHTS_STORAGE_PREFIX}${courseId}`);
    if (!raw) return [];
    return JSON.parse(raw) as WeightTemplate[];
  } catch {
    return [];
  }
}

/** Persist weight templates for a Classroom course to localStorage. */
export function saveLocalWeightTemplates(
  courseId: string,
  templates: WeightTemplate[]
): void {
  localStorage.setItem(
    `${WEIGHTS_STORAGE_PREFIX}${courseId}`,
    JSON.stringify(templates)
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export interface ClassroomNormalizedCourse extends NormalizedCourse {
  source: "CLASSROOM";
  hasWeights: boolean;
}

export function useClassroomCourses() {
  const { classroomToken, isConnected } = useClassroom();
  const [courses, setCourses] = useState<ClassroomNormalizedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingLive, setUsingLive] = useState(false);

  const fetchCourses = useCallback(async () => {
    if (!isConnected || !classroomToken) {
      // Not connected — show nothing
      setCourses([]);
      setUsingLive(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/classroom/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: classroomToken }),
      });

      if (!res.ok) throw new Error("Failed to fetch courses from Google Classroom");

      const data = await res.json();

      // Enrich each course with weight template info from localStorage
      const normalized: ClassroomNormalizedCourse[] = data.courses.map(
        (c: ClassroomNormalizedCourse) => {
          const templates = getLocalWeightTemplates(c.id);
          return {
            ...c,
            source: "CLASSROOM" as const,
            hasWeights: templates.length > 0,
          };
        }
      );

      if (normalized.length === 0) {
        const mock = getMockClassroomCourses() as ClassroomNormalizedCourse[];
        setCourses(mock);
        setUsingLive(false);
      } else {
        setCourses(normalized);
        setUsingLive(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setCourses([]);
      setUsingLive(false);
    } finally {
      setLoading(false);
    }
  }, [classroomToken, isConnected]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  return { courses, loading, error, usingLive, refetch: fetchCourses };
}
