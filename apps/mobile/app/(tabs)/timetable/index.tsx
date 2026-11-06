import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getCurrentAndNext,
  getDaySlots,
  getLocalParts,
} from "@vela/domain";
import type { BellSchedule, ScheduleEntry } from "@vela/types";
import { entriesForDay, periodSort } from "@/lib/scheduleView";
import { useSchedule } from "@/hooks/useSchedule";
import { Spinner } from "@/components/ui/Skeleton";

const FULL_DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const fmtMin = (m: number) => {
  const h = Math.floor(m / 60);
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export default function TimetableScreen() {
  const { entries, bells, loading, error, isConnected, reload } = useSchedule();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const local = getLocalParts(now, bells[0]?.timezone);
  const isSchoolDay = local.day >= 1 && local.day <= 5;
  // Today's classes; on a weekend, the next school day (Monday).
  const day = isSchoolDay ? local.day : 1;

  // Live status is always about today, whichever view is showing.
  const todaySlots = isSchoolDay ? getDaySlots(entries, bells, local.day, local.dateKey) : [];
  const status = isSchoolDay ? getCurrentAndNext(todaySlots, local.minutes) : null;

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

  return (
    <SafeAreaView className="flex-1 bg-space-void">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ color: "#A5B4FC", fontSize: 13, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
          {isSchoolDay ? `Today · ${FULL_DAY[day]}` : `Next school day · ${FULL_DAY[day]}`}
        </Text>

        {status && status.state !== "no-school" ? (
          <Text style={{ color: "#8B98B8", marginBottom: 12 }}>
            {status.state === "in-class" && `In ${status.current!.entry.courseName} · ${status.minutesRemaining} min left`}
            {(status.state === "before" || status.state === "passing") &&
              `Next: ${status.next!.entry.courseName} in ${status.minutesRemaining} min`}
            {status.state === "after" && "School's out for today"}
          </Text>
        ) : null}
        {!isSchoolDay ? <Text style={{ color: "#8B98B8", marginBottom: 12 }}>No school today.</Text> : null}
        {bells.length === 0 ? (
          <Text style={{ color: "#F59E0B", marginBottom: 12 }}>Add your bell times in Settings to see when each class meets.</Text>
        ) : null}

        <DayCards day={day} entries={entries} bells={bells} local={local} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DayCards({
  day,
  entries,
  bells,
  local,
}: {
  day: number;
  entries: ScheduleEntry[];
  bells: BellSchedule[];
  local: { day: number; dateKey: string; minutes: number };
}) {
  const isToday = day === local.day;
  // A date-pinned variant (finals, minimum day) only applies to its own date.
  const slots = getDaySlots(entries, bells, day, isToday ? local.dateKey : undefined);
  const current = isToday ? getCurrentAndNext(slots, local.minutes).current : null;
  // Chronological by bell time; classes with no bell time go last, by period.
  const startOf = (e: ScheduleEntry) => slots.find((s) => s.period === e.period)?.startMinutes ?? Infinity;
  const dayEntries = entriesForDay(entries, day).sort(
    (a, b) => startOf(a) - startOf(b) || periodSort(a.period, b.period)
  );
  if (dayEntries.length === 0) return <Text style={{ color: "#8B98B8", marginBottom: 12 }}>No classes</Text>;

  return (
    <>
      {dayEntries.map((e, idx) => {
        const slot = slots.find((s) => s.period === e.period);
        const isNow = current?.entry === e;
        return (
          <View
            key={`${idx}-${e.period}-${e.courseName}-${e.room ?? ""}-${e.teacher ?? ""}`}
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
            <Text style={{ fontSize: 13, color: "#8B98B8", marginTop: 4 }}>
              {/^\d+$/.test(e.period) ? `Period ${e.period}` : e.period}
              {e.room ? ` · Room ${e.room}` : ""}
              {e.teacher ? ` · ${e.teacher}` : ""}
            </Text>
          </View>
        );
      })}
    </>
  );
}
