import { useState, useEffect, useCallback, useRef } from "react";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { fetchResponsiveSchedule, withIcReauth, type ICResponsiveSession } from "@/lib/icApi";

export function useResponsiveSchedule() {
  const { session, isConnected, isInitializing, reauth } = useIC();
  const [sessions, setSessions] = useState<ICResponsiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Same as useCourses: refetch when the signed-in student changes, not when
  // reauth swaps in fresh cookies for the same student.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const sessionKey = session ? `${session.baseUrl}|${session.personId ?? ""}` : null;

  const fetchSessions = useCallback(async (currentSession = sessionRef.current) => {
    if (!isConnected || !currentSession) {
      setSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setSessions(await withIcReauth(currentSession, reauth, (s) => fetchResponsiveSchedule(s)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSessions([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, isConnected, reauth]);

  useEffect(() => {
    if (isInitializing) return;
    fetchSessions();
  }, [fetchSessions, isInitializing]);

  return { sessions, loading, error, refetch: fetchSessions };
}
