import { useState, useEffect, useCallback, useRef } from "react";
import { useIC } from "@/contexts/InfiniteCampusContext";
import {
  fetchResponsiveSchedule,
  selectResponsiveOffering,
  withIcReauth,
  type ICResponsiveSession,
} from "@/lib/icApi";

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

  /** Signs up for an offering, then reloads so seat counts and "your pick" are IC's truth. Throws IC's message on refusal. */
  const select = useCallback(
    async (target: ICResponsiveSession, offeringId: string) => {
      const current = sessionRef.current;
      if (!current) throw new Error("Not connected to Infinite Campus.");
      const personId = target.personId ?? current.personId;
      if (!personId || !target.calendarId) throw new Error("Missing schedule details. Pull to refresh and try again.");
      const payload = { personId, calendarId: target.calendarId, responsiveSessionId: target.id, offeringId };
      try {
        await selectResponsiveOffering(payload, current);
      } catch (err) {
        // Only an expired login is worth a re-login + retry; IC's own refusals (full, closed) aren't.
        if (!(err instanceof Error) || !err.message.startsWith("Session expired")) throw err;
        const fresh = await reauth();
        if (!fresh) throw err;
        await selectResponsiveOffering(payload, fresh);
      }
      await fetchSessions();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fetchSessions, reauth]
  );

  useEffect(() => {
    if (isInitializing) return;
    fetchSessions();
  }, [fetchSessions, isInitializing]);

  return { sessions, loading, error, refetch: fetchSessions, select };
}
