import { useState, useEffect } from "react";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { fetchAssignments } from "@/lib/icApi";
import { NormalizedCourse } from "@/hooks/useCourses";

export interface FlatAssignment {
  id: string;
  name: string;
  courseName: string;
  courseId: string;
  dueDate: string;
}

let cache: FlatAssignment[] | null = null;

export function useAllAssignments(courses: NormalizedCourse[]) {
  const { isConnected } = useIC();
  const [assignments, setAssignments] = useState<FlatAssignment[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    if (!isConnected || courses.length === 0) {
      setLoading(false);
      return;
    }

    if (cache !== null) {
      setAssignments(cache);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const flat: FlatAssignment[] = [];
        const seen = new Set<string>();

        for (const course of courses) {
          if (cancelled) return;
          try {
            const groups = await fetchAssignments(course.id);
            for (const group of groups) {
              for (const a of group.assignments) {
                if (!a.dueAt || seen.has(a.id)) continue;
                seen.add(a.id);
                flat.push({ id: a.id, name: a.name, courseName: course.name, courseId: course.id, dueDate: a.dueAt });
              }
            }
          } catch {
            // one course's assignments failing shouldn't block the rest
          }
        }
        if (!cancelled) {
          cache = flat;
          setAssignments(flat);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isConnected, courses.length]);

  return { assignments, loading };
}
