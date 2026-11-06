import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import { getLocalParts, parseClockTime, pickBellSchedule, upsertPeriodTimes } from "@vela/domain";
import type { BellPeriod, BellSchedule } from "@vela/types";
import { useSchedule } from "@/hooks/useSchedule";
import { entriesForDay, periodSort } from "@/lib/scheduleView";

const DAYS = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
];

/** Settings section: pick a weekday and edit that day's period times. */
export function BellTimesSettings() {
  const { entries, bells, usingPreset, saveBells } = useSchedule();
  const today = getLocalParts(new Date(), bells[0]?.timezone).day;
  const [day, setDay] = useState(today >= 1 && today <= 5 ? today : 1);
  const variant = pickBellSchedule(bells, day);
  const startOf = (p: string) => {
    const t = variant?.periods.find((x) => x.period === p)?.start;
    return t ? (parseClockTime(t) ?? Infinity) : Infinity;
  };
  const periods = [...new Set(entriesForDay(entries, day).map((e) => e.period))].sort(
    (a, b) => startOf(a) - startOf(b) || periodSort(a, b)
  );

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ color: "#A5B4FC", fontSize: 13, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
        Bell times
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {DAYS.map((d) => {
          const on = d.day === day;
          return (
            <TouchableOpacity
              key={d.day}
              onPress={() => setDay(d.day)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 12,
                minHeight: 44,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: on ? "rgba(129,140,248,0.5)" : "#1C2A45",
                backgroundColor: on ? "rgba(129,140,248,0.15)" : "transparent",
              }}
            >
              <Text style={{ color: on ? "#E8ECFF" : "#8B98B8" }}>{d.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {periods.length === 0 ? (
        <Text style={{ color: "#8B98B8" }}>Load your schedule on the day tab first.</Text>
      ) : (
        <BellEditor key={day} day={day} periods={periods} bells={bells} usingPreset={usingPreset} onSave={saveBells} />
      )}
    </View>
  );
}

// Accepts "1:17 PM" or 24-hour "13:17"; returns 24-hour "HH:MM" or null.
const normalize = (t: string) => {
  const m = /^(\d{1,2}):([0-5]\d)\s*([ap]m?)?$/i.exec(t.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const mer = m[3]?.toLowerCase();
  if (mer) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (mer[0] === "p" ? 12 : 0);
  } else if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
};
const display = (hhmm: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
};

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
        return [p, { start: bp?.start ? display(bp.start) : "", end: bp?.end ? display(bp.end) : "" }];
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
        setMsg({ text: `Period ${p}: use a time like 1:17 PM and make end after start`, ok: false });
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
    width: 100,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#1C2A45",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
    color: "#E8ECFF",
    backgroundColor: "#0C1220",
    textAlign: "center" as const,
  };

  return (
    <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#1C2A45", marginBottom: 16 }}>
      {variant ? <Text style={{ color: "#E8ECFF", fontWeight: "500", marginBottom: 4 }}>{variant.name}</Text> : null}
      <Text style={{ color: "#8B98B8", fontSize: 12, marginBottom: 12 }}>
        {usingPreset
          ? "Prefilled from your school's published schedule. Edit if wrong; applies to every day sharing it."
          : "Infinite Campus doesn't provide period times. Enter e.g. 8:30 AM."}
      </Text>
      {periods.map((p) => (
        <View key={p} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ width: 80, color: "#8B98B8" }}>{/^\d+$/.test(p) ? `Period ${p}` : p}</Text>
          <TextInput style={input} value={draft[p].start} onChangeText={(v) => set(p, "start", v)} placeholder="8:30 AM" placeholderTextColor="#8B98B8" autoCapitalize="characters" maxLength={8} accessibilityLabel={`Period ${p} start`} />
          <Text style={{ color: "#8B98B8", marginHorizontal: 8 }}>to</Text>
          <TextInput style={input} value={draft[p].end} onChangeText={(v) => set(p, "end", v)} placeholder="9:20 AM" placeholderTextColor="#8B98B8" autoCapitalize="characters" maxLength={8} accessibilityLabel={`Period ${p} end`} />
        </View>
      ))}
      {msg ? <Text style={{ color: msg.ok ? "#34D399" : "#FB7185", marginTop: 4 }}>{msg.text}</Text> : null}
      <TouchableOpacity onPress={save} disabled={saving} style={{ marginTop: 12, minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 12, backgroundColor: "rgba(129,140,248,0.18)", borderWidth: 1, borderColor: "rgba(129,140,248,0.4)" }} accessibilityRole="button">
        <Text style={{ color: "#C7D2FE", fontWeight: "600" }}>{saving ? "Saving…" : "Save"}</Text>
      </TouchableOpacity>
    </View>
  );
}
