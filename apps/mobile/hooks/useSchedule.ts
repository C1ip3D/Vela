import { useState, useEffect, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { defaultsForHostname, getLocalParts } from "@vela/domain";
import type { BellSchedule, ScheduleEntry } from "@vela/types";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { api } from "@/lib/api";
import { fetchSchedule as fetchIcSchedule, withIcReauth } from "@/lib/icApi";

const CUSTOM_BELLS_KEY = "vela_custom_bells";
const ENTRIES_KEY = "vela_schedule_entries";

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useSchedule() {
  const { session, isConnected, isInitializing, reauth } = useIC();
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [customBells, setCustomBells] = useState<BellSchedule[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const defaults = useMemo(() => {
    try {
      return defaultsForHostname(session ? new URL(session.baseUrl).hostname : null);
    } catch {
      return null;
    }
  }, [session]);
  // The student's own bells win; otherwise their district's preset; otherwise none.
  const bells = customBells ?? defaults?.bells ?? [];

  const load = useCallback(async () => {
    setError(null);

    const [cachedEntries, cachedBells] = await Promise.all([
      readJson<ScheduleEntry[]>(ENTRIES_KEY, []),
      readJson<BellSchedule[] | null>(CUSTOM_BELLS_KEY, null),
    ]);
    setEntries(cachedEntries);
    setCustomBells(cachedBells);
    if (cachedEntries.length > 0) setLoading(false);

    // Custom bells are shared with web through the backend; best-effort.
    api
      .get("/api/schedule")
      .then(({ data }) => {
        if (data?.bellsSource === "custom" && Array.isArray(data.bells)) {
          setCustomBells(data.bells);
          AsyncStorage.setItem(CUSTOM_BELLS_KEY, JSON.stringify(data.bells)).catch(() => {});
        }
      })
      .catch(() => {});

    if (!isConnected || !session || !defaults) {
      setLoading(false);
      if (isConnected && !defaults && cachedEntries.length === 0) {
        setError("Schedules aren't supported for your district yet.");
      }
      return;
    }

    try {
      // Straight from IC on the device, so the schedule loads without the backend.
      let usedSession = session;
      const fresh = await withIcReauth(session, reauth, (s) => {
        usedSession = s;
        return fetchIcSchedule(
          { today: getLocalParts(new Date(), defaults.timezone).dateKey, dayTypeDays: defaults.dayTypeDays },
          s
        );
      });
      if (fresh.length > 0) {
        setEntries(fresh);
        AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(fresh)).catch(() => {});
        // Best-effort: let web see the same schedule.
        api
          .post("/api/ic/schedule", {
            authToken: usedSession.authToken,
            baseUrl: usedSession.baseUrl,
            appName: usedSession.appName,
            districtName: usedSession.districtName,
            stateCode: usedSession.stateCode,
          })
          .catch(() => {});
      }
    } catch (e) {
      if (cachedEntries.length === 0) setError(e instanceof Error ? e.message : "Could not load schedule");
    } finally {
      setLoading(false);
    }
  }, [session, isConnected, reauth, defaults]);

  useEffect(() => {
    if (isInitializing) return;
    load();
  }, [isInitializing, load]);

  const saveBells = useCallback(async (next: BellSchedule[]) => {
    setCustomBells(next);
    await AsyncStorage.setItem(CUSTOM_BELLS_KEY, JSON.stringify(next));
    // Throws on failure so the editor can say it only saved locally.
    await api.put("/api/schedule/bell", { bells: next });
  }, []);

  return { entries, bells, usingPreset: customBells === null && !!defaults, loading, error, isConnected, reload: load, saveBells };
}
