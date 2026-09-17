import { useState, useEffect } from "react";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { fetchSchedule, ICPeriod } from "@/lib/icApi";

function parseTime(timeStr: string | null): Date | null {
  if (!timeStr) return null;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
}

export interface SchedulePeriod extends ICPeriod {
  isCurrent: boolean;
  isNext: boolean;
}

function tagPeriods(raw: ICPeriod[]): SchedulePeriod[] {
  const now = new Date();
  let currentIdx = -1;
  let nextIdx = -1;

  for (let i = 0; i < raw.length; i++) {
    const start = parseTime(raw[i].startTime);
    const end = parseTime(raw[i].endTime);
    if (start && end && now >= start && now <= end) {
      currentIdx = i;
      break;
    }
  }

  if (currentIdx === -1) {
    for (let i = 0; i < raw.length; i++) {
      const start = parseTime(raw[i].startTime);
      if (start && now < start) {
        nextIdx = i;
        break;
      }
    }
  }

  return raw.map((p, i) => ({ ...p, isCurrent: i === currentIdx, isNext: i === nextIdx }));
}

export function useSchedule() {
  const { isConnected, isInitializing } = useIC();
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isInitializing) return;
    if (!isConnected) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchSchedule()
      .then((raw) => setPeriods(tagPeriods(raw)))
      .catch((e) => setError(e.message ?? "Failed to load schedule"))
      .finally(() => setLoading(false));
  }, [isConnected, isInitializing]);

  return { periods, loading, error };
}
