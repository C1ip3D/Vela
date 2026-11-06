"use client";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Clock } from "lucide-react";
import {
  getCurrentAndNext,
  getDaySlots,
  getLocalParts,
  parseClockTime,
  pickBellSchedule,
  upsertPeriodTimes,
} from "@vela/domain";
import type { BellPeriod, BellSchedule } from "@vela/types";
import { useSchedule } from "@/hooks/useSchedule";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
];

const periodSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
const fmtMin = (m: number) => {
  const h = Math.floor(m / 60);
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export default function SchedulePage() {
  const { entries, bells, bellsSource, loading, syncing, error, isConnected, syncFromIC, saveBells } = useSchedule();
  const [now, setNow] = useState(() => new Date());
  const [picked, setPicked] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const tz = bells[0]?.timezone;
  const local = getLocalParts(now, tz);
  const isSchoolDay = local.day >= 1 && local.day <= 5;
  const day = picked ?? (isSchoolDay ? local.day : 1);
  const viewingToday = day === local.day;

  // A date-pinned variant (finals, minimum day) only applies to its own date.
  const slots = useMemo(
    () => getDaySlots(entries, bells, day, viewingToday ? local.dateKey : undefined),
    [entries, bells, day, viewingToday, local.dateKey]
  );
  const status = viewingToday ? getCurrentAndNext(slots, local.minutes) : null;

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
          {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
          {isConnected && !syncing && (
            <button onClick={syncFromIC} className="rounded-lg border border-[#818CF8]/30 bg-[#818CF8]/10 px-4 py-2 text-sm text-[#A5B4FC] hover:bg-[#818CF8]/20">
              Sync from Infinite Campus
            </button>
          )}
        </div>
      </div>
    );
  }

  // Classes meeting this weekday, with times when a bell schedule covers the period.
  const dayEntries = entries
    .filter((e) => !e.days?.length || e.days.includes(day))
    .sort((a, b) => periodSort(a.period, b.period))
    // IC can list the same class twice (e.g. one row per term); show it once.
    .filter((e, i, all) => all.findIndex((x) => x.period === e.period && x.courseName === e.courseName && x.room === e.room) === i);
  const slotFor = (period: string) => slots.find((s) => s.period === period);

  return (
    <div className="flex-1 p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {WEEKDAYS.map(({ day: d, label }) => (
              <button
                key={d}
                onClick={() => setPicked(d)}
                aria-pressed={d === day}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  d === day ? "border-[#818CF8]/30 bg-[#818CF8]/10 text-[#A5B4FC]" : "border-[#1C2A45]/60 text-[#8B98B8] hover:text-[#D4DAF0]"
                )}
              >
                {label}
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

        {status && status.state !== "no-school" && (
          <p className="text-sm text-[#8B98B8]">
            {status.state === "in-class" && `In ${status.current!.entry.courseName} · ${status.minutesRemaining} min left`}
            {(status.state === "before" || status.state === "passing") && `Next: ${status.next!.entry.courseName} in ${status.minutesRemaining} min`}
            {status.state === "after" && "School's out for today"}
          </p>
        )}
        {viewingToday && !isSchoolDay && <p className="text-sm text-[#8B98B8]">No school today.</p>}
        {bells.length === 0 && (
          <p className="text-sm text-amber-400">Add your bell times to see when each class meets.</p>
        )}

        {editing && (
          <BellEditor
            key={day}
            day={day}
            periods={[...new Set(dayEntries.map((e) => e.period))].sort(periodSort)}
            bells={bells}
            usingPreset={bellsSource === "preset"}
            onSave={saveBells}
          />
        )}

        <div className="flex flex-col gap-3">
          {dayEntries.map((e) => {
            const slot = slotFor(e.period);
            const isNow = status?.current?.entry === e;
            return (
              <div
                key={`${e.period}-${e.courseName}`}
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
                  {slot ? `${fmtMin(slot.startMinutes)} – ${fmtMin(slot.endMinutes)}` : "No bell time"}
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
  day,
  periods,
  bells,
  usingPreset,
  onSave,
}: {
  day: number;
  periods: string[];
  bells: BellSchedule[];
  usingPreset: boolean;
  onSave: (next: BellSchedule[]) => Promise<void>;
}) {
  const variant = pickBellSchedule(bells, day);
  const [draft, setDraft] = useState<Record<string, { start: string; end: string }>>(() =>
    Object.fromEntries(
      periods.map((p) => {
        const bp = variant?.periods.find((x) => x.period === p);
        return [p, { start: bp?.start ?? "", end: bp?.end ?? "" }];
      })
    )
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const save = async () => {
    setMsg(null);
    const times: BellPeriod[] = [];
    for (const p of periods) {
      const { start, end } = draft[p];
      if (!start && !end) continue;
      const s = parseClockTime(start);
      const e = parseClockTime(end);
      if (s === null || e === null || e <= s) {
        setMsg({ text: `Period ${p}: end must be after start`, ok: false });
        return;
      }
      times.push({ period: p, start, end });
    }
    setSaving(true);
    try {
      await onSave(upsertPeriodTimes(bells, day, times));
      setMsg({ text: "Saved", ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Could not save", ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#1C2A45]/60 bg-[#101828]/50 p-5">
      <p className="mb-1 text-sm font-medium text-[#E8ECFF]">Bell times{variant ? ` · ${variant.name}` : ""}</p>
      <p className="mb-4 text-xs text-[#4A5578]">
        {usingPreset
          ? "Prefilled from your school's published bell schedule. Edit if it's wrong; this applies to every day sharing this schedule."
          : "Infinite Campus doesn't provide period times, so enter them from your school's bell schedule."}
      </p>
      <div className="flex flex-col gap-2">
        {periods.map((p) => (
          <div key={p} className="flex items-center gap-3 text-sm text-[#8B98B8]">
            <span className="w-20">Period {p}</span>
            <input type="time" aria-label={`Period ${p} start`} value={draft[p].start} onChange={(e) => setDraft((d) => ({ ...d, [p]: { ...d[p], start: e.target.value } }))} className="rounded border border-[#1C2A45] bg-[#0C1220] px-2 py-1 text-[#E8ECFF]" />
            <span>to</span>
            <input type="time" aria-label={`Period ${p} end`} value={draft[p].end} onChange={(e) => setDraft((d) => ({ ...d, [p]: { ...d[p], end: e.target.value } }))} className="rounded border border-[#1C2A45] bg-[#0C1220] px-2 py-1 text-[#E8ECFF]" />
          </div>
        ))}
      </div>
      {msg && <p role="alert" className={cn("mt-3 text-sm", msg.ok ? "text-emerald-400" : "text-rose-400")}>{msg.text}</p>}
      <button onClick={save} disabled={saving} className="mt-4 rounded-lg border border-[#818CF8]/30 bg-[#818CF8]/10 px-4 py-1.5 text-sm text-[#A5B4FC] hover:bg-[#818CF8]/20 disabled:opacity-50">
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
