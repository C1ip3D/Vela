import React, { useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarCheck, ChevronDown, ChevronUp, Lock, MapPin, User } from "lucide-react-native";
import { useResponsiveSchedule } from "@/hooks/useResponsiveSchedule";
import { useIC } from "@/contexts/InfiniteCampusContext";
import type { ICResponsiveOffering, ICResponsiveSession } from "@/lib/icApi";
import { Spinner } from "@/components/ui/Skeleton";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { FadeSlide } from "@/components/ui/FadeSlide";

const COLLAPSED_OFFERING_COUNT = 4;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** "Thursday ACCESS; Thu 10/29/2026" → "Thursday ACCESS" (the date is shown separately). */
function sessionTitle(name: string) {
  return name.split(";")[0].trim() || name;
}

function formatDay(date: string | null) {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function seatsColor(seatsLeft: number | null) {
  if (seatsLeft == null) return "#8B98B8";
  if (seatsLeft === 0) return "#F43F5E";
  if (seatsLeft <= 3) return "#F59E0B";
  return "#34D399";
}

function seatsLabel(o: ICResponsiveOffering) {
  if (o.seatsLeft == null) return "—";
  if (o.seatsLeft === 0) return "Full";
  return `${o.seatsLeft} left`;
}

// ── Pieces ────────────────────────────────────────────────────────────────────

function StatusPill({ open }: { open: boolean }) {
  return (
    <View
      className="rounded-full px-2.5 py-1"
      style={{
        backgroundColor: open ? "rgba(52,211,153,0.12)" : "rgba(139,152,184,0.12)",
        borderWidth: 1,
        borderColor: open ? "rgba(52,211,153,0.3)" : "rgba(139,152,184,0.25)",
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "600", color: open ? "#34D399" : "#8B98B8" }}>
        {open ? "Sign-ups open" : "Closed"}
      </Text>
    </View>
  );
}

function OfferingMeta({ offering }: { offering: ICResponsiveOffering }) {
  return (
    <View className="flex-row items-center flex-wrap gap-x-3 gap-y-1 mt-1">
      {offering.teacher ? (
        <View className="flex-row items-center gap-1">
          <User size={12} color="#4A5578" />
          <Text className="text-xs text-star-faint">{offering.teacher}</Text>
        </View>
      ) : null}
      {offering.room ? (
        <View className="flex-row items-center gap-1">
          <MapPin size={12} color="#4A5578" />
          <Text className="text-xs text-star-faint">{offering.room}</Text>
        </View>
      ) : null}
    </View>
  );
}

function CurrentPick({ offering }: { offering: ICResponsiveOffering | null }) {
  if (!offering) {
    return (
      <View className="rounded-xl border border-dashed border-space-border-lit p-3.5">
        <Text className="text-sm text-star-dim">Not signed up for this period yet.</Text>
      </View>
    );
  }

  return (
    <View
      className="rounded-xl p-3.5"
      style={{ backgroundColor: "rgba(129,140,248,0.08)", borderWidth: 1, borderColor: "rgba(129,140,248,0.3)" }}
    >
      <Text className="text-[11px] uppercase tracking-[0.15em] text-vela-300 mb-1">Your pick</Text>
      <Text className="text-base font-semibold text-star-bright">{offering.name}</Text>
      <OfferingMeta offering={offering} />
      {offering.teacherAssigned ? (
        <View className="flex-row items-start gap-1.5 mt-2.5">
          <Lock size={12} color="#F59E0B" style={{ marginTop: 2 }} />
          <Text className="text-xs flex-1" style={{ color: "#FBBF24" }}>
            Placed here by a teacher{offering.teacherReason ? `: ${offering.teacherReason}` : ""}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function OfferingRow({ offering }: { offering: ICResponsiveOffering }) {
  return (
    <View className="flex-row items-start py-3" style={{ borderTopWidth: 1, borderTopColor: "#1C2A45" }}>
      <View className="flex-1 pr-3">
        <Text className="text-sm font-medium text-star-white" numberOfLines={2}>
          {offering.name}
        </Text>
        <OfferingMeta offering={offering} />
        {offering.description ? (
          <Text className="text-xs text-star-dim mt-1.5 leading-5" numberOfLines={3}>
            {offering.description}
          </Text>
        ) : null}
      </View>
      <Text
        style={{ fontSize: 12, fontWeight: "600", color: seatsColor(offering.seatsLeft), fontVariant: ["tabular-nums"] }}
      >
        {seatsLabel(offering)}
      </Text>
    </View>
  );
}

function SessionCard({ session }: { session: ICResponsiveSession }) {
  const [expanded, setExpanded] = useState(false);
  // Open offerings first (most seats at the top), full ones after, and never
  // repeat the student's own pick.
  const others = session.offerings
    .filter((o) => !o.isSelected)
    .sort((a, b) => (b.seatsLeft ?? -1) - (a.seatsLeft ?? -1));
  const withSeats = others.filter((o) => o.seatsLeft == null || o.seatsLeft > 0).length;
  const visible = expanded ? others : others.slice(0, COLLAPSED_OFFERING_COUNT);
  const day = formatDay(session.startDate);

  return (
    <View className="rounded-2xl border border-space-border bg-space-surface/50 p-4 mb-4">
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 pr-3">
          <Text className="text-lg font-semibold text-star-bright">{sessionTitle(session.name)}</Text>
          {day ? <Text className="text-xs text-star-faint mt-0.5">{day}</Text> : null}
        </View>
        <StatusPill open={session.isOpen} />
      </View>

      <CurrentPick offering={session.selectedOffering} />

      {others.length > 0 ? (
        <View className="mt-4">
          <Text className="text-xs text-star-faint mb-1">
            {withSeats} of {others.length} other sessions have seats
          </Text>
          {visible.map((o) => (
            <OfferingRow key={o.id} offering={o} />
          ))}
          {others.length > COLLAPSED_OFFERING_COUNT ? (
            <TouchableOpacity
              onPress={() => setExpanded((v) => !v)}
              className="flex-row items-center justify-center gap-1 pt-3"
              style={{ borderTopWidth: 1, borderTopColor: "#1C2A45" }}
              activeOpacity={0.6}
            >
              <Text className="text-xs font-medium text-vela-300">
                {expanded ? "Show less" : `Show all ${others.length}`}
              </Text>
              {expanded ? <ChevronUp size={14} color="#A5B4FC" /> : <ChevronDown size={14} color="#A5B4FC" />}
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const { isConnected } = useIC();
  const { sessions: allSessions, loading, error, refetch } = useResponsiveSchedule();
  const skipAnim = useRef(!loading).current;
  // Only the very first load shows the full-screen spinner; after that the
  // ScrollView (and its pull-to-refresh) stays mounted, even when empty.
  const hasLoaded = useRef(false);
  if (!loading) hasLoaded.current = true;
  const today = todayIso();
  const sessions = allSessions.filter((s) => !s.endDate || s.endDate >= today);

  return (
    <SafeAreaView className="flex-1 bg-space-void">
      <View className="px-5 pt-5 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: "#1C2A45" }}>
        <Text className="text-2xl font-bold text-star-bright">Flex Periods</Text>
        {isConnected && (
          <Text className="text-xs text-star-faint mt-1">
            Responsive Scheduling from Infinite Campus · sign up there
          </Text>
        )}
      </View>

      {loading && !hasLoaded.current ? (
        <View className="flex-1 items-center justify-center">
          <Spinner size={40} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingTop: 16, paddingBottom: 48, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => refetch()} tintColor="#818CF8" />
          }
        >
          {error ? (
            <View className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
              <Text className="text-sm text-red-400">{error}</Text>
            </View>
          ) : null}

          {sessions.length === 0 && !error ? (
            <View className="flex-1 items-center justify-center px-6">
              <CalendarCheck size={44} color="#4A5578" />
              <Text className="text-sm text-star-dim text-center mt-4 leading-6">
                No upcoming flex periods.{"\n"}Your school may not use Responsive Scheduling.
              </Text>
            </View>
          ) : (
            <>
              {sessions.length > 0 ? <SectionLabel title="Upcoming" /> : null}
              {sessions.map((s, i) => (
                <FadeSlide key={s.id} delay={60 + i * 75} skip={skipAnim}>
                  <SessionCard session={s} />
                </FadeSlide>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
