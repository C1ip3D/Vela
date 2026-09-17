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

let cache: FlatAssignment[] | null = null; // v2

export function useAllAssignments(courses: NormalizedCourse[]) {
  const { isConnected } = useIC();
  const [assignments, setAssignments] = useState<FlatAssignment[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  console.log("[useAllAssignments] render — courses:", courses.length, "cache:", cache?.length ?? "null", "connected:", isConnected);

  useEffect(() => {
    console.log("[useAllAssignments] effect — courses:", courses.length, "cache:", cache?.length ?? "null");

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
        console.log("[useAllAssignments] starting fetch loop");
        const flat: FlatAssignment[] = [];
        const seen = new Set<string>();

        for (const course of courses) {
          if (cancelled) return;
          try {
            const groups = await fetchAssignments(course.id);
            console.log(`[useAllAssignments] ${course.name}: ${groups.length} groups`);
            for (const group of groups) {
              for (const a of group.assignments) {
                if (!a.dueAt || seen.has(a.id)) continue;
                seen.add(a.id);
                flat.push({ id: a.id, name: a.name, courseName: course.name, courseId: course.id, dueDate: a.dueAt });
              }
            }
          } catch (e) { console.log(`[useAllAssignments] ${course.name} threw:`, e); }
        }
        console.log("[useAllAssignments] done, total:", flat.length);
        if (!cancelled) {
          cache = flat;
          setAssignments(flat);
        }
      } catch (e) {
        console.error("[useAllAssignments] outer error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isConnected, courses.length]);

  return { assignments, loading };
}
