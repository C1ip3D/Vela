import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { api } from "@/lib/api";
import { fetchSchedule as fetchIcSchedule, withIcReauth, type ICScheduleEntry } from "@/lib/icApi";
import type { BellPeriod } from "@vela/domain";

const BELLS_KEY = "vela_bell_periods";
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
  const [entries, setEntries] = useState<ICScheduleEntry[]>([]);
  const [bells, setBells] = useState<BellPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);

    // Show the cached copy immediately; refresh from IC below.
    const [cachedEntries, cachedBells] = await Promise.all([
      readJson<ICScheduleEntry[]>(ENTRIES_KEY, []),
      readJson<BellPeriod[]>(BELLS_KEY, []),
    ]);
    setEntries(cachedEntries);
    setBells(cachedBells);
    if (cachedEntries.length > 0) setLoading(false);

    // Bell times are shared with web through the backend; best-effort.
    api
      .get("/api/schedule")
      .then(({ data }) => {
        if (Array.isArray(data?.bells) && data.bells.length > 0) {
          setBells(data.bells);
          AsyncStorage.setItem(BELLS_KEY, JSON.stringify(data.bells)).catch(() => {});
        }
      })
      .catch(() => {});

    if (!isConnected || !session) {
      setLoading(false);
      return;
    }

    try {
      // Straight from IC on the device, so the schedule loads without the backend.
      let usedSession = session;
      const fresh = await withIcReauth(session, reauth, (s) => {
        usedSession = s;
        return fetchIcSchedule(s);
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
      if (cachedEntries.length === 0) {
        setError(e instanceof Error ? e.message : "Could not load schedule");
      }
    } finally {
      setLoading(false);
    }
  }, [session, isConnected, reauth]);

  useEffect(() => {
    if (isInitializing) return;
    load();
  }, [isInitializing, load]);

  const saveBells = useCallback(async (next: BellPeriod[]) => {
    setBells(next);
    await AsyncStorage.setItem(BELLS_KEY, JSON.stringify(next));
    // Throws on failure so the editor can say it only saved locally.
    await api.put("/api/schedule/bell", { bells: next });
  }, []);

  return { entries, bells, loading, error, isConnected, reload: load, saveBells };
}
