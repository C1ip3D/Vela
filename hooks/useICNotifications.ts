"use client";
import { useState, useEffect, useCallback } from "react";
import { useIC } from "@/contexts/InfiniteCampusContext";

/**
 * Polls /api/ic/courses and surfaces advisor-style log entries
 * (grade drops, missing assignments) so the TopBar bell has content.
 * Since IC doesn't have a native notification feed, we synthesise
 * notifications from grade data on each load.
 */
export function useICNotifications() {
  const { session, isConnected } = useIC();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!isConnected || !session) {
      setLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/ic/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authToken: session.authToken, baseUrl: session.baseUrl }),
      });

      if (!res.ok) { setLogs([]); return; }

      const data = await res.json();
      const courses: any[] = data.courses ?? [];

      // Build notification entries from missing assignments
      const synthesised = courses
        .filter((c) => c.missingCount > 0)
        .map((c, i) => ({
          id: `missing-${c.id}-${i}`,
          isRead: false,
          logType: "MISSING_ASSIGNMENT_ALERT",
          severity: c.missingCount >= 3 ? "WARNING" : "INFO",
          title: `${c.missingCount} missing assignment${c.missingCount > 1 ? "s" : ""} in ${c.name}`,
          body: { courseName: c.name, missingCount: c.missingCount },
          createdAt: new Date().toISOString(),
        }));

      setLogs(synthesised);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [session, isConnected]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadLogs = logs.filter((l) => !l.isRead);
  return { logs, unreadLogs, loading, refetch: fetchNotifications };
}
