"use client";
import { useState, useEffect, useCallback } from "react";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { auth } from "@/lib/firebase";
import type { BellPeriod, ScheduleClass } from "@vela/domain";

export interface ScheduleEntryDto extends ScheduleClass {
  sectionId: string;
  termName: string | null;
  startDate: string | null;
  endDate: string | null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const idToken = await auth.currentUser?.getIdToken();
  return {
    "Content-Type": "application/json",
    ...(idToken && { Authorization: `Bearer ${idToken}` }),
  };
}

export function useSchedule() {
  const { session, isConnected } = useIC();
  const [entries, setEntries] = useState<ScheduleEntryDto[]>([]);
  const [bells, setBells] = useState<BellPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule", { headers: await authHeaders() });
      if (!res.ok) throw new Error("Could not load schedule");
      const data = await res.json();
      setEntries(data.entries);
      setBells(data.bells);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load schedule");
    }
  }, []);

  const syncFromIC = useCallback(async () => {
    if (!session) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/ic/schedule", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          authToken: session.authToken,
          baseUrl: session.baseUrl,
          appName: session.appName,
          districtName: session.districtName,
          stateCode: session.stateCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [session, load]);

  const saveBells = useCallback(
    async (next: BellPeriod[]) => {
      const res = await fetch("/api/schedule/bell", {
        method: "PUT",
        headers: await authHeaders(),
        body: JSON.stringify({ bells: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not save bell times");
      setBells(next);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // First visit with IC connected and nothing stored yet: pull automatically.
  useEffect(() => {
    if (loading || !isConnected || entries.length > 0) return;
    const t = setTimeout(() => void syncFromIC(), 0);
    return () => clearTimeout(t);
    // Only re-run when load/connection state flips, not on every sync result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isConnected]);

  return { entries, bells, loading, syncing, error, isConnected, syncFromIC, saveBells };
}
