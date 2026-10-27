import { useState, useEffect, useRef } from "react";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { fetchAssignments, withIcReauth } from "@/lib/icApi";

// Module-level cache — persists across navigations within the same app session
const cache = new Map<string, any[]>();

export function useAssignments(courseId: string | undefined) {
  const { session, reauth } = useIC();

  const [groups, setGroups] = useState<any[]>(() => (courseId ? cache.get(courseId) : undefined) ?? []);
  const [loading, setLoading] = useState(() => !courseId || !cache.has(courseId));
  const [error, setError] = useState<string | null>(null);
  // Stable flag: was there cached data when this courseId was first seen?
  const hadCacheRef = useRef<Record<string, boolean>>({});
  if (courseId && !(courseId in hadCacheRef.current)) {
    hadCacheRef.current[courseId] = cache.has(courseId);
  }
  const hadCacheOnMount = courseId ? (hadCacheRef.current[courseId] ?? false) : false;

  useEffect(() => {
    if (!courseId) return;

    // Immediately swap to this course's cached data (or clear if not cached)
    const nowCached = cache.get(courseId);
    setGroups(nowCached ?? []);
    setLoading(!nowCached);
    setError(null);

    if (!session) {
      setLoading(false);
      return;
    }

    let cancelled = false;


    (async () => {
      if (nowCached) {
        console.log(`[Assignments] cache hit for ${courseId}, fetching fresh in background`);
      } else {
        console.log(`[Assignments] cache miss for ${courseId}, fetching...`);
      }
      setError(null);

      try {
        // Straight from IC on the device — no backend round-trip.
        const groups: any[] = await withIcReauth(session, reauth, (s) => fetchAssignments(courseId, s));

        if (cancelled) return;
        cache.set(courseId, groups);
        setGroups(groups);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Failed to load assignments");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [courseId, session, reauth]);

  return { groups, setGroups, loading, error, hadCacheOnMount };
}
