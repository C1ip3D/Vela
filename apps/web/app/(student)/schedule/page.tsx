"use client";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Clock } from "lucide-react";
import { buildDay, currentAndNext, guessDayType, timeToMinutes, type BellPeriod } from "@vela/domain";
import { useSchedule } from "@/hooks/useSchedule";
import { cn } from "@/lib/utils";

const periodSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export default function SchedulePage() {
  const { entries, bells, loading, syncing, error, isConnected, syncFromIC, saveBells } = useSchedule();
  const [now, setNow] = useState(() => new Date());
  const [dayType, setDayType] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const dayTypes = useMemo(() => [...new Set(entries.map((e) => e.dayType))], [entries]);
  const activeDayType = dayType ?? guessDayType(now, dayTypes) ?? dayTypes[0] ?? null;

  // Only show classes whose term covers today.
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const activeEntries = useMemo(
    () => entries.filter((e) => (!e.startDate || e.startDate <= today) && (!e.endDate || e.endDate >= today)),
    [entries, today]
  );

  const slots = useMemo(
    () => (activeDayType ? buildDay(activeDayType, bells, activeEntries) : []),
    [activeDayType, bells, activeEntries]
  );
  const nowMin = now.getHours() * 60 + now.getMinutes();
  // Only highlight a live period when the viewed day type is today's.
  const isToday = activeDayType !== null && activeDayType === guessDayType(now, dayTypes);
  const current = isToday ? currentAndNext(slots, nowMin).current : null;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#818CF8]/30 border-t-[#818CF8]" />
          <p className="text-sm text-[#8B98B8]">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div className="space-y-4">
          <p className="text-lg text-[#E8ECFF]">
            {isConnected ? (syncing ? "Loading your schedule…" : "No schedule found yet") : "Connect Infinite Campus to load your schedule"}
          </p>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          {isConnected && !syncing && (
            <button onClick={syncFromIC} className="rounded-lg border border-[#818CF8]/30 bg-[#818CF8]/10 px-4 py-2 text-sm text-[#A5B4FC] hover:bg-[#818CF8]/20">
              Sync from Infinite Campus
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {dayTypes.map((d) => (
              <button
                key={d}
                onClick={() => setDayType(d)}
                aria-pressed={d === activeDayType}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  d === activeDayType
                    ? "border-[#818CF8]/30 bg-[#818CF8]/10 text-[#A5B4FC]"
                    : "border-[#1C2A45]/60 text-[#8B98B8] hover:text-[#D4DAF0]"
                )}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing((v) => !v)} aria-expanded={editing} className="flex items-center gap-1.5 rounded-lg border border-[#1C2A45]/60 px-3 py-1.5 text-sm text-[#8B98B8] hover:text-[#D4DAF0]">
              <Clock size={14} /> {editing ? "Done" : "Bell times"}
            </button>
            {isConnected && (
              <button onClick={syncFromIC} disabled={syncing} className="flex items-center gap-1.5 rounded-lg border border-[#1C2A45]/60 px-3 py-1.5 text-sm text-[#8B98B8] hover:text-[#D4DAF0] disabled:opacity-50">
                <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> Sync
              </button>
            )}
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}

        {editing && activeDayType && (
          <BellEditor
            key={activeDayType}
            dayType={activeDayType}
            periods={[...new Set(activeEntries.filter((e) => e.dayType === activeDayType).map((e) => e.period))].sort(periodSort)}
            bells={bells}
            onSave={saveBells}
          />
        )}

        <div className="flex flex-col gap-3">
          {activeEntries
            .filter((e) => e.dayType === activeDayType)
            .sort((a, b) => periodSort(a.period, b.period))
            .map((e) => {
              const slot = slots.find((s) => s.period === e.period);
              const isNow = current?.period === e.period && current.cls?.courseName === e.courseName;
              return (
                <div
                  key={`${e.sectionId}-${e.period}`}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-6 py-5 backdrop-blur-sm",
                    isNow ? "border-[#818CF8]/40 bg-[#818CF8]/10" : "border-[#1C2A45]/60 bg-[#101828]/50"
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-lg font-medium text-[#E8ECFF]">{e.courseName}</p>
                    <p className="text-sm text-[#4A5578]">
                      Period {e.period}
                      {e.room ? ` · Room ${e.room}` : ""}
                      {e.teacher ? ` · ${e.teacher}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-sm text-[#8B98B8]">
                    {slot ? `${slot.start}–${slot.end}` : "Set bell time"}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

function BellEditor({
  dayType,
  periods,
  bells,
  onSave,
}: {
  dayType: string;
  periods: string[];
  bells: BellPeriod[];
  onSave: (next: BellPeriod[]) => Promise<void>;
}) {
  const initial = () =>
    Object.fromEntries(
      periods.map((p) => {
        const b = bells.find((x) => x.dayType === dayType && x.period === p);
        return [p, { start: b?.start ?? "", end: b?.end ?? "" }];
      })
    );
  const [draft, setDraft] = useState<Record<string, { start: string; end: string }>>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setErr(null);
    setSaved(false);
    const mine: BellPeriod[] = [];
    for (const p of periods) {
      const { start, end } = draft[p] ?? { start: "", end: "" };
      if (!start && !end) continue;
      if (!start || !end || timeToMinutes(start) >= timeToMinutes(end)) {
        setErr(`Period ${p}: end must be after start`);
        return;
      }
      mine.push({ dayType, period: p, start, end });
    }
    setSaving(true);
    try {
      await onSave([...bells.filter((b) => b.dayType !== dayType), ...mine]);
      setSaved(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#1C2A45]/60 bg-[#101828]/50 p-5">
      <p className="mb-1 text-sm font-medium text-[#E8ECFF]">Bell times · {dayType}</p>
      <p className="mb-4 text-xs text-[#4A5578]">Infinite Campus doesn&apos;t provide period times, so enter them from your school&apos;s bell schedule.</p>
      <div className="flex flex-col gap-2">
        {periods.map((p) => (
          <div key={p} className="flex items-center gap-3 text-sm text-[#8B98B8]">
            <span className="w-20">Period {p}</span>
            <input type="time" aria-label={`Period ${p} start`} value={draft[p]?.start ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [p]: { ...d[p], start: e.target.value } }))} className="rounded border border-[#1C2A45] bg-[#0C1220] px-2 py-1 text-[#E8ECFF]" />
            <span>to</span>
            <input type="time" aria-label={`Period ${p} end`} value={draft[p]?.end ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [p]: { ...d[p], end: e.target.value } }))} className="rounded border border-[#1C2A45] bg-[#0C1220] px-2 py-1 text-[#E8ECFF]" />
          </div>
        ))}
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-rose-400">{err}</p>}
      <button onClick={save} disabled={saving} className="mt-4 rounded-lg border border-[#818CF8]/30 bg-[#818CF8]/10 px-4 py-1.5 text-sm text-[#A5B4FC] hover:bg-[#818CF8]/20 disabled:opacity-50">
        {saving ? "Saving…" : "Save"}
      </button>
      {saved && <span className="ml-3 text-sm text-emerald-400">Saved</span>}
    </div>
  );
}
