import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  RotateCcw,
  Calculator,
} from "lucide-react-native";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { useCourses } from "@/hooks/useCourses";
import { percentageToLetter, gradeColor } from "@/lib/utils";
import { api } from "@/lib/api";

interface Assignment {
  id: string;
  name: string;
  pointsPossible: number;
  score: number | null;
  grade: string | null;
  submittedAt: string | null;
  missing: boolean;
  late: boolean;
  dueAt: string | null;
}

interface AssignmentGroup {
  id: string;
  name: string;
  weight: number;
  score: number | null;
  assignments: Assignment[];
}

interface WhatIfMod {
  editedScore?: number;
  dropped?: boolean;
}

function calcGroupScore(
  assignments: Assignment[],
  mods: Record<string, WhatIfMod>
): number | null {
  const active = assignments.filter((a) => !mods[a.id]?.dropped);
  const scored = active.filter((a) => {
    const mod = mods[a.id];
    const score = mod?.editedScore !== undefined ? mod.editedScore : a.score;
    return score !== null && a.pointsPossible > 0;
  });
  if (scored.length === 0) return null;
  let totalEarned = 0;
  let totalPossible = 0;
  for (const a of scored) {
    const mod = mods[a.id];
    const score =
      mod?.editedScore !== undefined ? mod.editedScore : a.score!;
    totalEarned += score;
    totalPossible += a.pointsPossible;
  }
  return totalPossible > 0 ? (totalEarned / totalPossible) * 100 : null;
}

function calcCourseGrade(
  groups: AssignmentGroup[],
  mods: Record<string, WhatIfMod>
): number | null {
  const hasWeights = groups.some((g) => g.weight > 0);
  if (hasWeights) {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const g of groups) {
      const score = calcGroupScore(g.assignments, mods);
      if (score !== null && g.weight > 0) {
        weightedSum += score * g.weight;
        totalWeight += g.weight;
      }
    }
    return totalWeight > 0 ? weightedSum / totalWeight : null;
  } else {
    const scores: number[] = [];
    for (const g of groups) {
      const score = calcGroupScore(g.assignments, mods);
      if (score !== null) scores.push(score);
    }
    return scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;
  }
}

function usePulse() {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  return anim;
}

function Bone({ w, h }: { w?: number | `${number}%`; h?: number }) {
  const opacity = usePulse();
  const width: number | `${number}%` = w ?? "100%";
  return (
    <Animated.View
      style={{
        opacity,
        width,
        height: h ?? 12,
        borderRadius: 6,
        backgroundColor: "#1C2A45",
      }}
    />
  );
}

function SkeletonCourseDetail() {
  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Grade card skeleton */}
      <View
        style={{ borderRadius: 12, borderWidth: 1, borderColor: "#1C2A45", backgroundColor: "#0F1829", padding: 16, marginBottom: 20, gap: 12 }}
      >
        <Bone w={90} h={10} />
        <Bone w={64} h={48} />
        <Bone w={50} h={12} />
      </View>

      {/* Group skeletons */}
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{ borderRadius: 12, borderWidth: 1, borderColor: "#1C2A45", marginBottom: 12, overflow: "hidden" }}
        >
          <View style={{ backgroundColor: "#0F1829", padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ gap: 6 }}>
              <Bone w={120} h={13} />
              <Bone w={80} h={10} />
            </View>
            <Bone w={44} h={13} />
          </View>
          {i === 0 && (
            <View style={{ padding: 16, gap: 14 }}>
              {[0, 1, 2, 3].map((j) => (
                <View key={j} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1, gap: 5, marginRight: 12 }}>
                    <Bone w="70%" h={12} />
                    <Bone w="35%" h={9} />
                  </View>
                  <Bone w={52} h={13} />
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function AssignmentRow({
  assignment,
  mod,
  onEdit,
  onDrop,
  onReset,
}: {
  assignment: Assignment;
  mod: WhatIfMod;
  onEdit: (score: number) => void;
  onDrop: () => void;
  onReset: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const isDrooped = mod.dropped;
  const effectiveScore =
    mod.editedScore !== undefined ? mod.editedScore : assignment.score;
  const pct =
    effectiveScore != null && assignment.pointsPossible > 0
      ? (effectiveScore / assignment.pointsPossible) * 100
      : null;
  const color = pct != null ? gradeColor(percentageToLetter(pct)) : "#4A5578";
  const isModified = mod.editedScore !== undefined || mod.dropped;

  return (
    <View
      className={`py-2.5 border-b border-space-border/40 ${isDrooped ? "opacity-40" : ""}`}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text
            className="text-sm text-star-white"
            numberOfLines={2}
          >
            {assignment.name}
            {isModified && !isDrooped && (
              <Text className="text-vela-300"> (modified)</Text>
            )}
          </Text>
          {assignment.dueAt && (
            <Text className="text-xs text-star-faint mt-0.5">
              Due {new Date(assignment.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </Text>
          )}
        </View>

        <View className="flex-row items-center gap-2">
          {!isDrooped && (
            <View className="items-end">
              {editing ? (
                <View className="flex-row items-center gap-1">
                  <TextInput
                    value={inputVal}
                    onChangeText={setInputVal}
                    keyboardType="decimal-pad"
                    style={{
                      width: 52,
                      borderWidth: 1,
                      borderColor: "#818CF8",
                      borderRadius: 6,
                      paddingHorizontal: 6,
                      paddingVertical: 3,
                      color: "#E8ECFF",
                      fontSize: 13,
                      textAlign: "right",
                    }}
                    autoFocus
                  />
                  <Text className="text-xs text-star-faint">
                    / {assignment.pointsPossible}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      const v = parseFloat(inputVal);
                      if (!isNaN(v) && v >= 0 && v <= assignment.pointsPossible) {
                        onEdit(v);
                      }
                      setEditing(false);
                    }}
                    className="ml-1"
                  >
                    <Text className="text-vela-300 text-xs font-semibold">OK</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    setInputVal(
                      effectiveScore != null ? effectiveScore.toString() : ""
                    );
                    setEditing(true);
                  }}
                >
                  <Text style={{ color, fontWeight: "600", fontSize: 13 }}>
                    {effectiveScore != null
                      ? `${effectiveScore}/${assignment.pointsPossible}`
                      : "—"}
                  </Text>
                  {pct != null && (
                    <Text className="text-xs text-star-faint text-right">
                      {pct.toFixed(1)}%
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          <View className="flex-col gap-1 ml-1">
            {isModified && (
              <TouchableOpacity onPress={onReset}>
                <RotateCcw size={14} color="#4A5578" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onDrop}>
              <Text className="text-xs text-star-faint">{isDrooped ? "↩" : "✕"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {assignment.missing && !isDrooped && (
        <View className="flex-row items-center gap-1 mt-1">
          <AlertTriangle size={10} color="#F59E0B" />
          <Text className="text-[10px] text-amber-400">Missing</Text>
        </View>
      )}
    </View>
  );
}

export default function CourseDetailScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const { session, reauth } = useIC();
  const { courses } = useCourses();

  const course = courses.find((c) => c.id === courseId);

  const [groups, setGroups] = useState<AssignmentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [mods, setMods] = useState<Record<string, WhatIfMod>>({});
  const [showSimulator, setShowSimulator] = useState(false);

  useEffect(() => {
    if (!session || !courseId) {
      setLoading(false);
      return;
    }

    const fetchAssignments = async (s: typeof session) => {
      const res = await api.post("/api/ic/assignments", {
        authToken: s.authToken,
        baseUrl: s.baseUrl,
        appName: s.appName,
        courseId,
      });
      return res.data;
    };

    (async () => {
      try {
        let data: any;
        try {
          data = await fetchAssignments(session);
        } catch (err: any) {
          if (err?.response?.status === 401) {
            const newSession = await reauth();
            if (newSession) {
              data = await fetchAssignments(newSession);
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        }
        setGroups(data.groups ?? []);
        if (data.groups?.length > 0) {
          setExpandedGroups(new Set([data.groups[0].id]));
        }
      } catch (e: any) {
        setError(e.message ?? "Failed to load assignments");
      } finally {
        setLoading(false);
      }
    })();
  }, [session, courseId, reauth]);

  const setMod = (assignmentId: string, mod: Partial<WhatIfMod>) => {
    setMods((prev) => ({
      ...prev,
      [assignmentId]: { ...prev[assignmentId], ...mod },
    }));
  };

  const resetMod = (assignmentId: string) => {
    setMods((prev) => {
      const next = { ...prev };
      delete next[assignmentId];
      return next;
    });
  };

  const resetAll = () => {
    Alert.alert("Reset Simulator", "Clear all what-if changes?", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: () => setMods({}) },
    ]);
  };

  const projectedGrade = calcCourseGrade(groups, mods);
  const hasChanges = Object.keys(mods).length > 0;
  const originalGrade = course?.currentGrade ?? null;
  const letter = course?.letterGrade ?? (originalGrade != null ? percentageToLetter(originalGrade) : "—");
  const projectedLetter =
    projectedGrade != null ? percentageToLetter(projectedGrade) : null;

  return (
    <SafeAreaView className="flex-1 bg-space-void">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-3 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <ArrowLeft size={22} color="#8B98B8" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-base font-semibold text-star-bright" numberOfLines={1}>
            {course?.name ?? "Course"}
          </Text>
          <Text className="text-xs text-star-faint">{course?.courseCode}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowSimulator(!showSimulator)}
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border border-vela-400/30 bg-vela-400/10"
        >
          <Calculator size={14} color="#818CF8" />
          <Text className="text-xs text-vela-300 font-medium">What-if</Text>
        </TouchableOpacity>
      </View>

      {loading ? <SkeletonCourseDetail /> : <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Grade display */}
        <View className="rounded-xl border border-space-border bg-space-elevated p-4 mb-5">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs text-star-faint uppercase tracking-wider mb-1">
                Current Grade
              </Text>
              <Text
                className="text-5xl font-bold"
                style={{
                  color: course?.letterGrade
                    ? gradeColor(letter)
                    : "#4A5578",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {letter}
              </Text>
              {originalGrade != null && (
                <Text className="text-sm text-star-dim mt-1">
                  {originalGrade.toFixed(1)}%
                </Text>
              )}
            </View>

            {showSimulator && projectedGrade != null && (
              <View className="items-end">
                <Text className="text-xs text-vela-300 uppercase tracking-wider mb-1">
                  Projected
                </Text>
                <Text
                  className="text-5xl font-bold"
                  style={{
                    color: projectedLetter ? gradeColor(projectedLetter) : "#4A5578",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {projectedLetter}
                </Text>
                <Text className="text-sm text-star-dim mt-1">
                  {projectedGrade.toFixed(1)}%
                </Text>
              </View>
            )}
          </View>

          {showSimulator && hasChanges && (
            <TouchableOpacity
              onPress={resetAll}
              className="flex-row items-center gap-1.5 mt-3 self-start"
            >
              <RotateCcw size={13} color="#4A5578" />
              <Text className="text-xs text-star-faint">Reset all changes</Text>
            </TouchableOpacity>
          )}
        </View>

        {error && (
          <View className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 mb-4">
            <Text className="text-sm text-red-400">{error}</Text>
          </View>
        )}

        {/* Assignment groups */}
        {groups.map((group) => {
          const isExpanded = expandedGroups.has(group.id);
          const groupScore = calcGroupScore(group.assignments, mods);

          return (
            <View
              key={group.id}
              className="border border-space-border rounded-xl mb-3 overflow-hidden"
            >
              <TouchableOpacity
                onPress={() =>
                  setExpandedGroups((prev) => {
                    const next = new Set(prev);
                    if (next.has(group.id)) next.delete(group.id);
                    else next.add(group.id);
                    return next;
                  })
                }
                className="flex-row items-center justify-between px-4 py-3 bg-space-elevated"
                activeOpacity={0.7}
              >
                <View>
                  <Text className="text-sm font-semibold text-star-bright">
                    {group.name}
                  </Text>
                  {group.weight > 0 && (
                    <Text className="text-xs text-star-faint">
                      {group.weight}% of grade
                    </Text>
                  )}
                </View>
                <View className="flex-row items-center gap-2">
                  {groupScore != null && (
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: gradeColor(percentageToLetter(groupScore)) }}
                    >
                      {groupScore.toFixed(1)}%
                    </Text>
                  )}
                  {isExpanded ? (
                    <ChevronDown size={16} color="#4A5578" />
                  ) : (
                    <ChevronRight size={16} color="#4A5578" />
                  )}
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View className="px-4 bg-space-surface/30">
                  {group.assignments.length === 0 ? (
                    <Text className="text-xs text-star-faint py-4 text-center">
                      No assignments
                    </Text>
                  ) : (
                    group.assignments.map((a) => (
                      <AssignmentRow
                        key={a.id}
                        assignment={a}
                        mod={mods[a.id] ?? {}}
                        onEdit={(score) =>
                          setMod(a.id, { editedScore: score, dropped: false })
                        }
                        onDrop={() =>
                          setMod(a.id, {
                            dropped: !mods[a.id]?.dropped,
                          })
                        }
                        onReset={() => resetMod(a.id)}
                      />
                    ))
                  )}
                </View>
              )}
            </View>
          );
        })}

        {groups.length === 0 && !loading && !error && (
          <View className="items-center py-10">
            <Text className="text-sm text-star-faint">
              No assignment data available.
            </Text>
          </View>
        )}
      </ScrollView>}
    </SafeAreaView>
  );
}
