import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarCheck, ChevronDown, ChevronUp, Lock, MapPin, Search, User, X } from "lucide-react-native";
import { useResponsiveSchedule } from "@/hooks/useResponsiveSchedule";
import type { ICResponsiveOffering, ICResponsiveSession } from "@/lib/icApi";
import { Spinner } from "@/components/ui/Skeleton";
import { FadeSlide } from "@/components/ui/FadeSlide";

const INITIAL_OFFERING_COUNT = 8;
const LOAD_MORE_COUNT = 10;

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
      <Text style={{ fontSize: 13, fontWeight: "600", color: open ? "#34D399" : "#8B98B8" }}>
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
          <User size={14} color="#4A5578" />
          <Text className="text-sm text-star-faint">{offering.teacher}</Text>
        </View>
      ) : null}
      {offering.room ? (
        <View className="flex-row items-center gap-1">
          <MapPin size={14} color="#4A5578" />
          <Text className="text-sm text-star-faint">{offering.room}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The student's current session: first in the list, larger, with a bright border. Renders nothing when no session is picked. */
function CurrentPick({ offering }: { offering: ICResponsiveOffering | null }) {
  const [open, setOpen] = useState(false);

  if (!offering) return null;

  return (
    <View
      className="rounded-2xl p-4 mb-3"
      style={{ backgroundColor: "rgba(129,140,248,0.1)", borderWidth: 2, borderColor: "#818CF8" }}
    >
      <View className="flex-row items-start">
        <View className="flex-1 pr-3">
          <Text className="text-xl font-semibold text-star-bright" numberOfLines={open ? undefined : 2}>
            {offering.name}
          </Text>
          <OfferingMeta offering={offering} />
        </View>
        {offering.description ? (
          <TouchableOpacity onPress={() => setOpen((v) => !v)} hitSlop={12} activeOpacity={0.6}>
            {open ? <ChevronUp size={18} color="#A5B4FC" /> : <ChevronDown size={18} color="#A5B4FC" />}
          </TouchableOpacity>
        ) : null}
      </View>
      {open && offering.description ? (
        <Text className="text-sm text-star-dim mt-2.5 leading-6">{offering.description}</Text>
      ) : null}
      {offering.teacherAssigned ? (
        <View className="flex-row items-start gap-1.5 mt-3">
          <Lock size={14} color="#F59E0B" style={{ marginTop: 2 }} />
          <Text className="text-sm flex-1" style={{ color: "#FBBF24" }}>
            Placed here by a teacher{offering.teacherReason ? `: ${offering.teacherReason}` : ""}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

type Action = { busy: boolean; disabled: boolean; onPress: () => void } | null;

/** Tapping the row signs up / switches; the chevron (when there is a description) expands it. */
function OfferingRow({ offering, action }: { offering: ICResponsiveOffering; action: Action }) {
  const [open, setOpen] = useState(false);
  const hasMore = !!offering.description;

  return (
    <TouchableOpacity
      onPress={action?.onPress}
      disabled={!action || action.disabled}
      activeOpacity={0.6}
      className="rounded-xl px-3.5 py-3 mb-2"
      style={{
        // Tappable rows read as buttons (tinted, bordered); the rest stay flat.
        backgroundColor: action ? "rgba(129,140,248,0.07)" : "transparent",
        borderWidth: 1,
        borderColor: action ? "rgba(129,140,248,0.28)" : "#1C2A45",
        opacity: action?.disabled && !action.busy ? 0.5 : 1,
      }}
    >
      <View className="flex-row items-start">
        <View className="flex-1 pr-3">
          <Text className="text-base font-medium text-star-white" numberOfLines={open ? undefined : 1}>
            {offering.name}
          </Text>
          <OfferingMeta offering={offering} />
        </View>
        <View className="items-end">
          <View className="flex-row items-center gap-1.5">
            {action?.busy ? <ActivityIndicator size="small" color="#A5B4FC" /> : null}
            <Text
              style={{ fontSize: 14, fontWeight: "600", color: seatsColor(offering.seatsLeft), fontVariant: ["tabular-nums"] }}
            >
              {seatsLabel(offering)}
            </Text>
          </View>
          {hasMore ? (
            <TouchableOpacity onPress={() => setOpen((v) => !v)} hitSlop={12} activeOpacity={0.6} className="mt-1.5">
              {open ? <ChevronUp size={16} color="#8B98B8" /> : <ChevronDown size={16} color="#8B98B8" />}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {open && offering.description ? (
        <Text className="text-sm text-star-dim mt-2 leading-6">{offering.description}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

/** The day's title doubles as the day switcher: tap it to drop down the other days. */
function DayHeader({
  sessions,
  selected,
  onSelect,
}: {
  sessions: ICResponsiveSession[];
  selected: ICResponsiveSession;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const switchable = sessions.length > 1;
  const day = formatDay(selected.startDate);

  return (
    <View className="mb-4">
      <TouchableOpacity
        onPress={() => switchable && setOpen((v) => !v)}
        activeOpacity={switchable ? 0.6 : 1}
        className="flex-row items-center justify-between"
      >
        <View className="flex-1 pr-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-xl font-semibold text-star-bright shrink">{sessionTitle(selected.name)}</Text>
            {switchable ? (
              open ? <ChevronUp size={20} color="#A5B4FC" /> : <ChevronDown size={20} color="#A5B4FC" />
            ) : null}
          </View>
          {day ? <Text className="text-sm text-star-faint mt-0.5">{day}</Text> : null}
        </View>
        {selected.isOpen ? null : <StatusPill open={false} />}
      </TouchableOpacity>

      {open ? (
        <View className="mt-3 rounded-xl overflow-hidden" style={{ borderWidth: 1, borderColor: "#1C2A45" }}>
          {sessions.map((s, i) => {
            const active = s.id === selected.id;
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => {
                  onSelect(s.id);
                  setOpen(false);
                }}
                activeOpacity={0.6}
                className="px-4 py-3 flex-row items-center justify-between"
                style={{
                  backgroundColor: active ? "rgba(129,140,248,0.1)" : "transparent",
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: "#1C2A45",
                }}
              >
                <Text className="text-base" style={{ color: active ? "#A5B4FC" : "#E8ECF8", fontWeight: active ? "600" : "400" }}>
                  {sessionTitle(s.name)}
                </Text>
                <Text className="text-sm text-star-faint">{formatDay(s.startDate)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function SessionCard({
  session,
  onSelect,
  skip,
}: {
  session: ICResponsiveSession;
  skip: boolean;
  onSelect: (session: ICResponsiveSession, offeringId: string) => Promise<void>;
}) {
  const [shown, setShown] = useState(INITIAL_OFFERING_COUNT);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Stagger only the rows present when the day first appears; rows revealed
  // later (search results, "show all") just fade in without waiting in line.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 900);
    return () => clearTimeout(t);
  }, []);
  const stagger = (i: number) => (settled ? 0 : 40 + Math.min(i, 12) * 55);
  // A teacher placement can't be changed by the student.
  const locked = !!session.selectedOffering?.teacherAssigned;

  const confirmSelect = (offering: ICResponsiveOffering) => {
    const verb = session.selectedOffering ? "Switch to" : "Sign up for";
    Alert.alert(
      `${verb} "${offering.name}"?`,
      `${sessionTitle(session.name)}${formatDay(session.startDate) ? ` · ${formatDay(session.startDate)}` : ""}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: session.selectedOffering ? "Switch" : "Sign up",
          onPress: async () => {
            setBusyId(offering.id);
            try {
              await onSelect(session, offering.id);
            } catch (err) {
              Alert.alert("Couldn't update", err instanceof Error ? err.message : "Something went wrong.");
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const actionFor = (o: ICResponsiveOffering): Action => {
    if (!session.isOpen || locked) return null;
    if (o.seatsLeft === 0) return null;
    return {
      busy: busyId === o.id,
      disabled: busyId !== null,
      onPress: () => confirmSelect(o),
    };
  };
  // Open offerings first (most seats at the top), full ones after, and never
  // repeat the student's own pick.
  const others = session.offerings
    .filter((o) => !o.isSelected)
    .sort((a, b) => (b.seatsLeft ?? -1) - (a.seatsLeft ?? -1));
  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;
  const matches = searching
    ? others.filter((o) =>
        [o.name, o.teacher, o.room, o.description].some((f) => f?.toLowerCase().includes(needle))
      )
    : others;
  // A search shows every match; the "show all" fold only applies to the full list.
  const visible = searching ? matches : matches.slice(0, shown);
  const remaining = others.length - shown;

  const pickBlock = (
    <FadeSlide delay={stagger(1)} skip={skip}>
      <CurrentPick offering={session.selectedOffering} />
    </FadeSlide>
  );

  return (
    <View className="mb-4">
      {others.length === 0 ? pickBlock : null}

      {others.length > 0 ? (
        <View className="mt-4">
          <View
            className="flex-row items-center gap-2 rounded-xl px-3 mb-3"
            style={{ backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "#1C2A45", height: 40 }}
          >
            <Search size={15} color="#4A5578" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, teacher or room"
              placeholderTextColor="#4A5578"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="never"
              style={{ flex: 1, color: "#E8ECF8", fontSize: 16, paddingVertical: 0 }}
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={10} activeOpacity={0.6}>
                <X size={15} color="#8B98B8" />
              </TouchableOpacity>
            ) : null}
          </View>
          {searching ? (
            <Text className="text-sm text-star-faint mb-1.5">
              {matches.length} of {others.length} sessions match
            </Text>
          ) : null}
          {session.isOpen && !locked ? (
            <Text className="text-sm mb-2.5" style={{ color: "#A5B4FC" }}>
              Tap a session to {session.selectedOffering ? "switch to it" : "sign up"}
            </Text>
          ) : null}
          {pickBlock}
          {searching && matches.length === 0 ? (
            <Text className="text-base text-star-dim py-4 text-center">No sessions match "{query.trim()}".</Text>
          ) : null}
          {visible.map((o, i) => (
            <FadeSlide key={o.id} delay={stagger(i + 2)} skip={skip} distance={14}>
              <OfferingRow offering={o} action={actionFor(o)} />
            </FadeSlide>
          ))}
          {!searching && others.length > INITIAL_OFFERING_COUNT ? (
            <TouchableOpacity
              onPress={() => setShown(remaining > 0 ? shown + LOAD_MORE_COUNT : INITIAL_OFFERING_COUNT)}
              className="flex-row items-center justify-center gap-1 py-2"
              activeOpacity={0.6}
            >
              <Text className="text-sm font-medium text-vela-300">
                {remaining > 0 ? `Show ${Math.min(LOAD_MORE_COUNT, remaining)} more` : "Show less"}
              </Text>
              {remaining > 0 ? <ChevronDown size={14} color="#A5B4FC" /> : <ChevronUp size={14} color="#A5B4FC" />}
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const { sessions: allSessions, loading, error, refetch, select } = useResponsiveSchedule();
  const skipAnim = useRef(!loading).current;
  // Only the very first load shows the full-screen spinner; after that the
  // ScrollView (and its pull-to-refresh) stays mounted, even when empty.
  const hasLoaded = useRef(false);
  if (!loading) hasLoaded.current = true;
  const today = todayIso();
  const sessions = allSessions.filter((s) => !s.endDate || s.endDate >= today);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const selected = sessions.find((s) => s.id === pickedId) ?? sessions[0];

  return (
    <SafeAreaView className="flex-1 bg-space-void">
      {loading && !hasLoaded.current ? (
        <View className="flex-1 items-center justify-center">
          <Spinner size={40} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 48, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => refetch()} tintColor="#818CF8" />
          }
        >
          {error ? (
            <View className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
              <Text className="text-base text-red-400">{error}</Text>
            </View>
          ) : null}

          {sessions.length === 0 && !error ? (
            <View className="flex-1 items-center justify-center px-6">
              <CalendarCheck size={44} color="#4A5578" />
              <Text className="text-base text-star-dim text-center mt-4 leading-6">
                No upcoming responsive schedule sessions.{"\n"}Your school may not use Responsive Scheduling.
              </Text>
            </View>
          ) : (
            <>
              {selected ? <DayHeader sessions={sessions} selected={selected} onSelect={setPickedId} /> : null}
              {selected ? (
                <SessionCard key={selected.id} session={selected} onSelect={select} skip={skipAnim} />
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
