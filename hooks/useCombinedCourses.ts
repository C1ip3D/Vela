"use client";
import { useMemo } from "react";
import { useCanvasCourses, NormalizedCourse } from "./useCanvasCourses";
import { useClassroomCourses, ClassroomNormalizedCourse } from "./useClassroomCourses";

export interface CombinedCourse extends NormalizedCourse {
  source: "CANVAS" | "CLASSROOM";
  hasWeights?: boolean;
}

/**
 * Merges Canvas and Classroom course lists into a single sorted array.
 * Canvas courses come first (they have grade data). Classroom courses
 * without weight templates are surfaced last so the user notices the
 * "set up weights" prompt.
 */
export function useCombinedCourses() {
  const canvas = useCanvasCourses();
  const classroom = useClassroomCourses();

  const combined: CombinedCourse[] = useMemo(() => {
    const canvasCourses: CombinedCourse[] = canvas.courses.map((c) => ({
      ...c,
      source: "CANVAS" as const,
    }));

    const classroomCourses: CombinedCourse[] = classroom.courses.map(
      (c: ClassroomNormalizedCourse) => ({
        ...c,
        source: "CLASSROOM" as const,
      })
    );

    // Sort: Canvas first, then Classroom with weights, then Classroom without
    const sorted = [
      ...canvasCourses,
      ...classroomCourses.filter((c) => c.hasWeights),
      ...classroomCourses.filter((c) => !c.hasWeights),
    ];

    return sorted;
  }, [canvas.courses, classroom.courses]);

  const loading = canvas.loading || classroom.loading;
  const error = canvas.error || classroom.error;

  // Compute GPA across both sources
  const gradedCourses = combined.filter((c) => c.currentGrade != null);

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

  let totalUnweighted = 0;
  let totalWeighted = 0;
  for (const c of gradedCourses) {
    if (c.currentGrade == null) continue;
    const letter = c.letterGrade || scoreToLetter(c.currentGrade);
    const base = letterToGpaPoints(letter);
    totalUnweighted += base;
    const boost =
      c.courseType === "AP" ? 1.0 : c.courseType === "HONORS" ? 0.84 : 0;
    totalWeighted += base + boost;
  }

  const count = gradedCourses.length;
  const gpa =
    count === 0
      ? canvas.gpa // fall back to Canvas-only GPA (which uses mock if empty)
      : {
          unweighted: parseFloat((totalUnweighted / count).toFixed(2)),
          weighted: parseFloat((totalWeighted / count).toFixed(2)),
        };

  return {
    courses: combined,
    gradedCourses,
    loading,
    error,
    gpa,
    usingLiveCanvas: canvas.usingLive,
    usingLiveClassroom: classroom.usingLive,
    refetchCanvas: canvas.refetch,
    refetchClassroom: classroom.refetch,
  };
}
