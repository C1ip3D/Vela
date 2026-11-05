import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { buildDay, currentAndNext, guessDayType, timeToMinutes, type BellPeriod } from "@vela/domain";
import { useSchedule } from "@/hooks/useSchedule";
import { Spinner } from "@/components/ui/Skeleton";

const periodSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const pad = (n: number) => String(n).padStart(2, "0");
const normalize = (t: string) => (HHMM.test(t.trim()) ? t.trim().padStart(5, "0") : null);

export default function ScheduleScreen() {
  const { entries, bells, loading, error, isConnected, reload, saveBells } = useSchedule();
  const [now, setNow] = useState(() => new Date());
  const [picked, setPicked] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const dayTypes = useMemo(() => [...new Set(entries.map((e) => e.dayType))], [entries]);
  const guessed = guessDayType(now, dayTypes);
  const activeDayType = picked ?? guessed ?? dayTypes[0] ?? null;

  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const activeEntries = useMemo(
    () => entries.filter((e) => (!e.startDate || e.startDate <= today) && (!e.endDate || e.endDate >= today)),
    [entries, today]
  );
  const dayEntries = activeEntries
    .filter((e) => e.dayType === activeDayType)
    .sort((a, b) => periodSort(a.period, b.period));

  const slots = useMemo(
    () => (activeDayType ? buildDay(activeDayType, bells, activeEntries) : []),
    [activeDayType, bells, activeEntries]
  );
  const isToday = activeDayType !== null && activeDayType === guessed;
  const current = isToday ? currentAndNext(slots, now.getHours() * 60 + now.getMinutes()).current : null;

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
          <TouchableOpacity onPress={reload} style={{ marginTop: 16 }}>
            <Text style={{ color: "#A5B4FC" }}>Try again</Text>
          </TouchableOpacity>
        ) : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-space-void">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {dayTypes.map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => setPicked(d)}
              accessibilityRole="button"
              accessibilityState={{ selected: d === activeDayType }}
              style={{
                marginRight: 8,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: d === activeDayType ? "rgba(129,140,248,0.3)" : "#1C2A45",
                backgroundColor: d === activeDayType ? "rgba(129,140,248,0.1)" : "transparent",
              }}
            >
              <Text style={{ color: d === activeDayType ? "#A5B4FC" : "#8B98B8" }}>{d}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 12 }}>
          <TouchableOpacity onPress={() => setEditing((v) => !v)} accessibilityRole="button">
            <Text style={{ color: "#A5B4FC" }}>{editing ? "Done" : "Edit bell times"}</Text>
          </TouchableOpacity>
        </View>

        {editing && activeDayType ? (
          <BellEditor
            key={activeDayType}
            dayType={activeDayType}
            periods={[...new Set(dayEntries.map((e) => e.period))]}
            bells={bells}
            onSave={saveBells}
          />
        ) : null}

        {dayEntries.map((e) => {
          const slot = slots.find((s) => s.period === e.period);
          const isNow = current?.period === e.period && current.cls?.courseName === e.courseName;
          return (
            <View
              key={`${e.sectionId}-${e.period}`}
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
                  {slot ? `${slot.start}–${slot.end}` : "Set time"}
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
  const sorted = [...periods].sort(periodSort);
  const [draft, setDraft] = useState<Record<string, { start: string; end: string }>>(() =>
    Object.fromEntries(
      sorted.map((p) => {
        const b = bells.find((x) => x.dayType === dayType && x.period === p);
        return [p, { start: b?.start ?? "", end: b?.end ?? "" }];
      })
    )
  );
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (p: string, k: "start" | "end", v: string) =>
    setDraft((d) => ({ ...d, [p]: { ...d[p], [k]: v } }));

  const save = async () => {
    setMsg(null);
    const mine: BellPeriod[] = [];
    for (const p of sorted) {
      const { start, end } = draft[p];
      if (!start.trim() && !end.trim()) continue;
      const s = normalize(start);
      const e = normalize(end);
      if (!s || !e || timeToMinutes(s) >= timeToMinutes(e)) {
        setMsg({ text: `Period ${p}: use HH:MM and make end after start`, ok: false });
        return;
      }
      mine.push({ dayType, period: p, start: s, end: e });
    }
    setSaving(true);
    try {
      await onSave([...bells.filter((b) => b.dayType !== dayType), ...mine]);
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
      <Text style={{ color: "#E8ECFF", fontWeight: "500", marginBottom: 4 }}>Bell times · {dayType}</Text>
      <Text style={{ color: "#4A5578", fontSize: 12, marginBottom: 12 }}>
        Infinite Campus doesn&apos;t provide period times. Enter 24-hour HH:MM, e.g. 08:30.
      </Text>
      {sorted.map((p) => (
        <View key={p} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ width: 80, color: "#8B98B8" }}>Period {p}</Text>
          <TextInput
            style={input}
            value={draft[p].start}
            onChangeText={(v) => set(p, "start", v)}
            placeholder="08:30"
            placeholderTextColor="#4A5578"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            accessibilityLabel={`Period ${p} start`}
          />
          <Text style={{ color: "#8B98B8", marginHorizontal: 8 }}>to</Text>
          <TextInput
            style={input}
            value={draft[p].end}
            onChangeText={(v) => set(p, "end", v)}
            placeholder="09:20"
            placeholderTextColor="#4A5578"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            accessibilityLabel={`Period ${p} end`}
          />
        </View>
      ))}
      {msg ? <Text style={{ color: msg.ok ? "#34D399" : "#FB7185", marginTop: 4 }}>{msg.text}</Text> : null}
      <TouchableOpacity onPress={save} disabled={saving} style={{ marginTop: 12 }} accessibilityRole="button">
        <Text style={{ color: "#A5B4FC" }}>{saving ? "Saving…" : "Save"}</Text>
      </TouchableOpacity>
    </View>
  );
}
