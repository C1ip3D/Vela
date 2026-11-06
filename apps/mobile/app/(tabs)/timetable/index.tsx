import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { Spinner } from "@/components/ui/Skeleton";

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

export default function TimetableScreen() {
  const { entries, bells, usingPreset, loading, error, isConnected, reload, saveBells } = useSchedule();
  const [now, setNow] = useState(() => new Date());
  const [picked, setPicked] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const local = getLocalParts(now, bells[0]?.timezone);
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
      <SafeAreaView className="flex-1 bg-space-void items-center justify-center">
        <Spinner size={40} />
      </SafeAreaView>
    );
  }

  if (entries.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-space-void items-center justify-center px-8">
        <Text style={{ fontSize: 18, color: "#E8ECFF", textAlign: "center" }}>
          {isConnected ? "No schedule found yet" : "Connect Infinite Campus to load your schedule"}
        </Text>
        {error ? <Text style={{ color: "#FB7185", marginTop: 8, textAlign: "center" }}>{error}</Text> : null}
        {isConnected ? (
          <TouchableOpacity onPress={reload} style={{ marginTop: 16 }} accessibilityRole="button">
            <Text style={{ color: "#A5B4FC" }}>Try again</Text>
          </TouchableOpacity>
        ) : null}
      </SafeAreaView>
    );
  }

  const dayEntries = entries
    .filter((e) => !e.days?.length || e.days.includes(day))
    .sort((a, b) => periodSort(a.period, b.period))
    // IC can list the same class twice (e.g. one row per term); show it once.
    .filter((e, i, all) => all.findIndex((x) => x.period === e.period && x.courseName === e.courseName && x.room === e.room) === i);

  return (
    <SafeAreaView className="flex-1 bg-space-void">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", marginBottom: 16 }}>
          {WEEKDAYS.map(({ day: d, label }) => (
            <TouchableOpacity
              key={d}
              onPress={() => setPicked(d)}
              accessibilityRole="button"
              accessibilityState={{ selected: d === day }}
              style={{
                marginRight: 8,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: d === day ? "rgba(129,140,248,0.3)" : "#1C2A45",
                backgroundColor: d === day ? "rgba(129,140,248,0.1)" : "transparent",
              }}
            >
              <Text style={{ color: d === day ? "#A5B4FC" : "#8B98B8" }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {status && status.state !== "no-school" ? (
          <Text style={{ color: "#8B98B8", marginBottom: 12 }}>
            {status.state === "in-class" && `In ${status.current!.entry.courseName} · ${status.minutesRemaining} min left`}
            {(status.state === "before" || status.state === "passing") &&
              `Next: ${status.next!.entry.courseName} in ${status.minutesRemaining} min`}
            {status.state === "after" && "School's out for today"}
          </Text>
        ) : null}
        {viewingToday && !isSchoolDay ? <Text style={{ color: "#8B98B8", marginBottom: 12 }}>No school today.</Text> : null}
        {bells.length === 0 ? (
          <Text style={{ color: "#F59E0B", marginBottom: 12 }}>Add your bell times to see when each class meets.</Text>
        ) : null}

        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 12 }}>
          <TouchableOpacity onPress={() => setEditing((v) => !v)} accessibilityRole="button">
            <Text style={{ color: "#A5B4FC" }}>{editing ? "Done" : "Edit bell times"}</Text>
          </TouchableOpacity>
        </View>

        {editing ? (
          <BellEditor
            key={day}
            day={day}
            periods={[...new Set(dayEntries.map((e) => e.period))].sort(periodSort)}
            bells={bells}
            usingPreset={usingPreset}
            onSave={saveBells}
          />
        ) : null}

        {dayEntries.map((e) => {
          const slot = slots.find((s) => s.period === e.period);
          const isNow = status?.current?.entry === e;
          return (
            <View
              key={`${e.period}-${e.courseName}`}
              style={{
                marginBottom: 12,
                padding: 18,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isNow ? "rgba(129,140,248,0.4)" : "#1C2A45",
                backgroundColor: isNow ? "rgba(129,140,248,0.1)" : "rgba(16,24,40,0.5)",
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ flex: 1, fontSize: 18, color: "#E8ECFF", paddingRight: 12 }} numberOfLines={2}>
                  {e.courseName}
                </Text>
                <Text style={{ color: "#8B98B8", fontVariant: ["tabular-nums"] }}>
                  {slot ? `${fmtMin(slot.startMinutes)} – ${fmtMin(slot.endMinutes)}` : "No bell time"}
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: "#4A5578", marginTop: 4 }}>
                Period {e.period}
                {e.room ? ` · Room ${e.room}` : ""}
                {e.teacher ? ` · ${e.teacher}` : ""}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const normalize = (t: string) => (/^([01]?\d|2[0-3]):[0-5]\d$/.test(t.trim()) ? t.trim().padStart(5, "0") : null);

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
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (p: string, k: "start" | "end", v: string) => setDraft((d) => ({ ...d, [p]: { ...d[p], [k]: v } }));

  const save = async () => {
    setMsg(null);
    const times: BellPeriod[] = [];
    for (const p of periods) {
      const { start, end } = draft[p];
      if (!start.trim() && !end.trim()) continue;
      const s = normalize(start);
      const e = normalize(end);
      if (!s || !e || parseClockTime(s)! >= parseClockTime(e)!) {
        setMsg({ text: `Period ${p}: use HH:MM and make end after start`, ok: false });
        return;
      }
      times.push({ period: p, start: s, end: e });
    }
    setSaving(true);
    try {
      await onSave(upsertPeriodTimes(bells, day, times));
      setMsg({ text: "Saved", ok: true });
    } catch {
      setMsg({ text: "Saved on this device only (couldn't reach Vela)", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const input = {
    width: 76,
    borderWidth: 1,
    borderColor: "#1C2A45",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: "#E8ECFF",
    backgroundColor: "#0C1220",
    textAlign: "center" as const,
  };

  return (
    <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#1C2A45", marginBottom: 16 }}>
      <Text style={{ color: "#E8ECFF", fontWeight: "500", marginBottom: 4 }}>
        Bell times{variant ? ` · ${variant.name}` : ""}
      </Text>
      <Text style={{ color: "#4A5578", fontSize: 12, marginBottom: 12 }}>
        {usingPreset
          ? "Prefilled from your school's published schedule. Edit if wrong; applies to every day sharing it."
          : "Infinite Campus doesn't provide period times. Enter 24-hour HH:MM, e.g. 08:30."}
      </Text>
      {periods.map((p) => (
        <View key={p} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ width: 80, color: "#8B98B8" }}>Period {p}</Text>
          <TextInput style={input} value={draft[p].start} onChangeText={(v) => set(p, "start", v)} placeholder="08:30" placeholderTextColor="#4A5578" keyboardType="numbers-and-punctuation" maxLength={5} accessibilityLabel={`Period ${p} start`} />
          <Text style={{ color: "#8B98B8", marginHorizontal: 8 }}>to</Text>
          <TextInput style={input} value={draft[p].end} onChangeText={(v) => set(p, "end", v)} placeholder="09:20" placeholderTextColor="#4A5578" keyboardType="numbers-and-punctuation" maxLength={5} accessibilityLabel={`Period ${p} end`} />
        </View>
      ))}
      {msg ? <Text style={{ color: msg.ok ? "#34D399" : "#FB7185", marginTop: 4 }}>{msg.text}</Text> : null}
      <TouchableOpacity onPress={save} disabled={saving} style={{ marginTop: 12 }} accessibilityRole="button">
        <Text style={{ color: "#A5B4FC" }}>{saving ? "Saving…" : "Save"}</Text>
      </TouchableOpacity>
    </View>
  );
}
