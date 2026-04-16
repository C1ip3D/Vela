import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import {
  ArrowLeft,
  AlertTriangle,
} from "lucide-react-native";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { useCourses } from "@/hooks/useCourses";
import { percentageToLetter } from "@/lib/utils";
import { api } from "@/lib/api";
import { Bone } from "@/components/ui/Skeleton";

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

interface CustomAssignment {
  id: string;
  name: string;
  score: number;
  pointsPossible: number;
}

function calcGroupScore(
  assignments: Assignment[],
  mods: Record<string, WhatIfMod>,
  extras: CustomAssignment[] = []
): number | null {
  const active = assignments.filter((a) => !mods[a.id]?.dropped);
  const scored = active.filter((a) => {
    const mod = mods[a.id];
    const score = mod?.editedScore !== undefined ? mod.editedScore : a.score;
    return score !== null && a.pointsPossible > 0;
  });
  if (scored.length === 0 && extras.length === 0) return null;
  let totalEarned = 0;
  let totalPossible = 0;
  for (const a of scored) {
    const mod = mods[a.id];
    const score = mod?.editedScore !== undefined ? mod.editedScore : a.score!;
    totalEarned += score;
    totalPossible += a.pointsPossible;
  }
  for (const e of extras) {
    totalEarned += e.score;
    totalPossible += e.pointsPossible;
  }
  return totalPossible > 0 ? (totalEarned / totalPossible) * 100 : null;
}

function calcCourseGrade(
  groups: AssignmentGroup[],
  mods: Record<string, WhatIfMod>,
  added: Record<string, CustomAssignment[]> = {}
): number | null {
  const hasWeights = groups.some((g) => g.weight > 0);
  if (hasWeights) {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const g of groups) {
      const score = calcGroupScore(g.assignments, mods, added[g.id] ?? []);
      if (score !== null && g.weight > 0) {
        weightedSum += score * g.weight;
        totalWeight += g.weight;
      }
    }
    return totalWeight > 0 ? weightedSum / totalWeight : null;
  } else {
    const scores: number[] = [];
    for (const g of groups) {
      const score = calcGroupScore(g.assignments, mods, added[g.id] ?? []);
      if (score !== null) scores.push(score);
    }
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  }
}

function SkeletonCourseDetail() {
  return (
    <ScrollView
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Grade card skeleton */}
      <View className="rounded-2xl border border-space-border bg-space-elevated p-5 mb-5 gap-3">
        <Bone w={90} h={10} />
        <Bone w={64} h={52} />
        <Bone w={50} h={12} />
      </View>

      {/* Group skeletons */}
      {[0, 1, 2].map((i) => (
        <View key={i} className="border border-space-border rounded-2xl mb-3 overflow-hidden">
          <View className="bg-space-elevated px-4 py-4 flex-row justify-between items-center">
            <View className="gap-1.5">
              <Bone w={120} h={13} />
              <Bone w={80} h={10} />
            </View>
            <Bone w={44} h={13} />
          </View>
          {i === 0 && (
            <View className="px-4 py-4 gap-4">
              {[0, 1, 2, 3].map((j) => (
                <View key={j} className="flex-row justify-between items-center">
                  <View className="flex-1 gap-1.5 mr-3">
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

function formatDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

function deltaColor(delta: number): string {
  return delta >= 0 ? "#34D399" : "#F87171";
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
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const dotsRef = useRef<View>(null);
  const isDropped = mod.dropped;
  const effectiveScore = mod.editedScore !== undefined ? mod.editedScore : assignment.score;
  const pct =
    effectiveScore != null && assignment.pointsPossible > 0
      ? (effectiveScore / assignment.pointsPossible) * 100
      : null;
  const originalPct =
    assignment.score != null && assignment.pointsPossible > 0
      ? (assignment.score / assignment.pointsPossible) * 100
      : null;
  const scoreDelta =
    mod.editedScore !== undefined && originalPct != null && pct != null
      ? pct - originalPct
      : null;

  const openMenu = () => {
    dotsRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      setMenuPos({ x: pageX - 150, y: pageY + height + 4 });
      setMenuVisible(true);
    });
  };


  return (
    <View
      style={{
        paddingVertical: 18,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(28,42,69,0.4)",
        opacity: isDropped ? 0.4 : 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* Left: name + due date + missing */}
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "400", color: "#E8ECFF", lineHeight: 24, marginBottom: 4 }} numberOfLines={2}>
            {assignment.name}
          </Text>
          {assignment.dueAt && (
            <Text style={{ fontSize: 12, color: "#4A5578" }}>
              Due {new Date(assignment.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </Text>
          )}
          {assignment.missing && !isDropped && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
              <AlertTriangle size={11} color="#F59E0B" />
              <Text style={{ fontSize: 12, color: "#FBBF24" }}>Missing</Text>
            </View>
          )}
        </View>

        {/* Right: score + 3-dot menu */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {/* Score display */}
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: "#34D399", fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
              {effectiveScore != null ? `${effectiveScore}/${assignment.pointsPossible}` : "—"}
            </Text>
            <Text style={{ fontSize: 12, color: "#4A5578", marginTop: 2 }}>
              {pct != null ? `${pct.toFixed(1)}%` : ""}
            </Text>
            {scoreDelta != null && (
              <Text style={{ fontSize: 11, color: deltaColor(scoreDelta), marginTop: 1, fontWeight: "600" }}>
                {formatDelta(scoreDelta)}
              </Text>
            )}
          </View>

          {/* 3-dot button */}
          <TouchableOpacity ref={dotsRef} onPress={openMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
            <Text style={{ color: "#8B98B8", fontSize: 22, lineHeight: 22 }}>⋮</Text>
          </TouchableOpacity>

          {/* Popover */}
          <Modal visible={menuVisible} transparent animationType="none" onRequestClose={() => setMenuVisible(false)}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setMenuVisible(false)}>
              <View style={{
                position: "absolute",
                left: menuPos.x,
                top: menuPos.y,
                backgroundColor: "#162032",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#1C2A45",
                minWidth: 160,
                overflow: "hidden",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 16,
                elevation: 10,
              }}>
                {[
                  { label: "Edit Score", color: "#E8ECFF" },
                  { label: isDropped ? "Restore Assignment" : "Drop Assignment", color: "#F87171" },
                  { label: "Reset", color: "#E8ECFF" },
                ].map((item, i, arr) => (
                  <TouchableOpacity
                    key={item.label}
                    onPress={() => {
                      setMenuVisible(false);
                      if (i === 0) { setInputVal(effectiveScore != null ? effectiveScore.toString() : ""); setEditSheetVisible(true); }
                      else if (i === 1) { onDrop(); }
                      else if (i === 2) { onReset(); }
                    }}
                    style={{
                      paddingHorizontal: 18,
                      paddingVertical: 14,
                      borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                      borderBottomColor: "#1C2A45",
                    }}
                  >
                    <Text style={{ fontSize: 15, color: item.color }}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Edit Score bottom sheet */}
          <Modal visible={editSheetVisible} transparent animationType="slide" onRequestClose={() => setEditSheetVisible(false)}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ flex: 1, justifyContent: "flex-end" }}
              >
              <TouchableOpacity
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
                activeOpacity={1}
                onPress={() => setEditSheetVisible(false)}
                />
              <View style={{
                backgroundColor: "#0C1220",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderTopWidth: 1,
                borderColor: "#1C2A45",
                paddingTop: 20,
                paddingBottom: 40,
                alignItems: "center",
              }}>
                {/* Handle */}
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#1C2A45", marginBottom: 20 }} />

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  scrollEnabled={false}
                  style={{ width: "100%" }}
                  contentContainerStyle={{ paddingHorizontal: 24 }}
                >
                  <Text style={{ fontSize: 18, fontWeight: "600", color: "#E8ECFF", marginBottom: 20, textAlign: "center" }}>Edit Score</Text>

                  {/* Input row */}
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24 }}>
                    <TextInput
                      value={inputVal}
                      onChangeText={setInputVal}
                      keyboardType="decimal-pad"
                      autoFocus
                      style={{
                        width: 110,
                        height: 52,
                        borderWidth: 1,
                        borderColor: "#818CF8",
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        color: "#E8ECFF",
                        fontSize: 20,
                        backgroundColor: "#162032",
                        textAlign: "center",
                      }}
                    />
                    <Text style={{ fontSize: 20, color: "#4A5578" }}>/ {assignment.pointsPossible}</Text>
                  </View>

                  {/* Save button */}
                  <TouchableOpacity
                    onPressIn={() => {
                      const v = parseFloat(inputVal);
                      if (!isNaN(v) && v >= 0 && v <= assignment.pointsPossible) onEdit(v);
                      Keyboard.dismiss();
                      setEditSheetVisible(false);
                    }}
                    style={{
                      height: 52,
                      borderRadius: 14,
                      backgroundColor: "#818CF8",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "600", color: "white" }}>Save</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </View>
      </View>
    </View>
  );
}

function CustomAssignmentRow({
  ca,
  onEdit,
  onDelete,
}: {
  ca: CustomAssignment;
  onEdit: (score: number, pointsPossible: number) => void;
  onDelete: () => void;
}) {
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [inputScore, setInputScore] = useState("");
  const [inputPossible, setInputPossible] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const dotsRef = useRef<View>(null);

  const pct = ca.pointsPossible > 0 ? (ca.score / ca.pointsPossible) * 100 : null;

  const openMenu = () => {
    dotsRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      setMenuPos({ x: pageX - 150, y: pageY + height + 4 });
      setMenuVisible(true);
    });
  };

  return (
    <View style={{
      paddingVertical: 18,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(28,42,69,0.4)",
    }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "400", color: "#E8ECFF", lineHeight: 24, marginBottom: 4 }} numberOfLines={2}>
            {ca.name || "New Assignment"}
          </Text>
          <Text style={{ fontSize: 11, color: "#818CF8" }}>Added</Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: "#34D399", fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
              {ca.score}/{ca.pointsPossible}
            </Text>
            <Text style={{ fontSize: 12, color: "#4A5578", marginTop: 2 }}>
              {pct != null ? `${pct.toFixed(1)}%` : ""}
            </Text>
          </View>

          <TouchableOpacity ref={dotsRef} onPress={openMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
            <Text style={{ color: "#8B98B8", fontSize: 22, lineHeight: 22 }}>⋮</Text>
          </TouchableOpacity>

          {/* Popover */}
          <Modal visible={menuVisible} transparent animationType="none" onRequestClose={() => setMenuVisible(false)}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setMenuVisible(false)}>
              <View style={{
                position: "absolute",
                left: menuPos.x,
                top: menuPos.y,
                backgroundColor: "#162032",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#1C2A45",
                minWidth: 160,
                overflow: "hidden",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 16,
                elevation: 10,
              }}>
                {[
                  { label: "Edit Score", color: "#E8ECFF" },
                  { label: "Delete", color: "#F87171" },
                ].map((item, i, arr) => (
                  <TouchableOpacity
                    key={item.label}
                    onPress={() => {
                      setMenuVisible(false);
                      if (i === 0) {
                        setInputScore(ca.score.toString());
                        setInputPossible(ca.pointsPossible.toString());
                        setEditSheetVisible(true);
                      } else if (i === 1) {
                        onDelete();
                      }
                    }}
                    style={{
                      paddingHorizontal: 18,
                      paddingVertical: 14,
                      borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                      borderBottomColor: "#1C2A45",
                    }}
                  >
                    <Text style={{ fontSize: 15, color: item.color }}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Edit sheet */}
          <Modal visible={editSheetVisible} transparent animationType="slide" onRequestClose={() => setEditSheetVisible(false)}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ flex: 1, justifyContent: "flex-end" }}
            >
              <TouchableOpacity
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
                activeOpacity={1}
                onPress={() => setEditSheetVisible(false)}
              />
              <View style={{
                backgroundColor: "#0C1220",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderTopWidth: 1,
                borderColor: "#1C2A45",
                paddingTop: 20,
                paddingBottom: 40,
                alignItems: "center",
              }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#1C2A45", marginBottom: 20 }} />
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  scrollEnabled={false}
                  style={{ width: "100%" }}
                  contentContainerStyle={{ paddingHorizontal: 24 }}
                >
                  <Text style={{ fontSize: 18, fontWeight: "600", color: "#E8ECFF", marginBottom: 20, textAlign: "center" }}>Edit Score</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24 }}>
                    <TextInput
                      value={inputScore}
                      onChangeText={setInputScore}
                      keyboardType="decimal-pad"
                      autoFocus
                      style={{
                        width: 110,
                        height: 52,
                        borderWidth: 1,
                        borderColor: "#818CF8",
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        color: "#E8ECFF",
                        fontSize: 20,
                        backgroundColor: "#162032",
                        textAlign: "center",
                      }}
                    />
                    <Text style={{ fontSize: 20, color: "#4A5578" }}>/</Text>
                    <TextInput
                      value={inputPossible}
                      onChangeText={setInputPossible}
                      keyboardType="decimal-pad"
                      style={{
                        width: 110,
                        height: 52,
                        borderWidth: 1,
                        borderColor: "#818CF8",
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        color: "#E8ECFF",
                        fontSize: 20,
                        backgroundColor: "#162032",
                        textAlign: "center",
                      }}
                    />
                  </View>
                  <TouchableOpacity
                    onPressIn={() => {
                      const s = parseFloat(inputScore);
                      const p = parseFloat(inputPossible);
                      if (!isNaN(s) && !isNaN(p) && p > 0 && s >= 0) onEdit(s, p);
                      Keyboard.dismiss();
                      setEditSheetVisible(false);
                    }}
                    style={{
                      height: 52,
                      borderRadius: 14,
                      backgroundColor: "#818CF8",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "600", color: "white" }}>Save</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </View>
      </View>
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
  const [addedAssignments, setAddedAssignments] = useState<Record<string, CustomAssignment[]>>({});
  const [addSheetGroupId, setAddSheetGroupId] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [addScore, setAddScore] = useState("");
  const [addPossible, setAddPossible] = useState("");
  const [groupMenuVisible, setGroupMenuVisible] = useState(false);
  const [groupMenuPos, setGroupMenuPos] = useState({ x: 0, y: 0 });
  const [groupMenuId, setGroupMenuId] = useState<string | null>(null);
  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  const [headerMenuPos, setHeaderMenuPos] = useState({ x: 0, y: 0 });
  const headerDotsRef = useRef<View>(null);
  const [finalCalcVisible, setFinalCalcVisible] = useState(false);
  const [finalWeight, setFinalWeight] = useState("");
  const [targetGrade, setTargetGrade] = useState("");

  useEffect(() => {
    setMods({});
    setAddedAssignments({});
  }, [courseId]);

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
    setMods((prev) => ({ ...prev, [assignmentId]: { ...prev[assignmentId], ...mod } }));
  };

  const resetMod = (assignmentId: string) => {
    setMods((prev) => {
      const next = { ...prev };
      delete next[assignmentId];
      return next;
    });
  };

  const resetAll = () => { setMods({}); setAddedAssignments({}); };

  const resetCategory = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      setMods((prev) => {
        const next = { ...prev };
        group.assignments.forEach((a) => delete next[a.id]);
        return next;
      });
    }
    setAddedAssignments((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  };

  const addCustomAssignment = (groupId: string, ca: CustomAssignment) => {
    setAddedAssignments((prev) => ({ ...prev, [groupId]: [ca, ...(prev[groupId] ?? [])] }));
  };

  const removeCustomAssignment = (groupId: string, id: string) => {
    setAddedAssignments((prev) => ({ ...prev, [groupId]: (prev[groupId] ?? []).filter((a) => a.id !== id) }));
  };

  const editCustomAssignment = (groupId: string, id: string, score: number, pointsPossible: number) => {
    setAddedAssignments((prev) => ({
      ...prev,
      [groupId]: (prev[groupId] ?? []).map((a) => a.id === id ? { ...a, score, pointsPossible } : a),
    }));
  };

  const openHeaderMenu = () => {
    headerDotsRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      setHeaderMenuPos({ x: pageX - 180, y: pageY + height + 4 });
      setHeaderMenuVisible(true);
    });
  };

  const projectedGrade = calcCourseGrade(groups, mods, addedAssignments);
  const baseGrade = calcCourseGrade(groups, {});
  const originalGrade = course?.currentGrade ?? null;
  const hasAnyChanges = Object.keys(mods).length > 0 || Object.values(addedAssignments).some((a) => a.length > 0);

  const currentGradeForCalc = projectedGrade ?? baseGrade ?? originalGrade;
  const finalWeightNum = parseFloat(finalWeight);
  const targetGradeNum = parseFloat(targetGrade);
  const finalWeightFrac = finalWeightNum / 100;
  const requiredFinal =
    !isNaN(finalWeightNum) && !isNaN(targetGradeNum) && finalWeightNum > 0 && finalWeightNum < 100 && currentGradeForCalc != null
      ? (targetGradeNum - currentGradeForCalc * (1 - finalWeightFrac)) / finalWeightFrac
      : null;
  const finalResultColor = requiredFinal == null ? "#4A5578" : requiredFinal > 100 ? "#F87171" : "#34D399";
  const finalResultText = requiredFinal == null ? "—" : `${requiredFinal.toFixed(1)}%`;

  return (
    <SafeAreaView className="flex-1 bg-space-void">
      {/* Header */}
      <View
        className="flex-row items-center px-4 pt-3 pb-3"
        style={{ borderBottomWidth: 1, borderBottomColor: "#1C2A45" }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3"
          style={{ padding: 8 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={22} color="#8B98B8" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-base font-semibold text-star-bright" numberOfLines={1}>
            {course?.name ?? "Course"}
          </Text>
          <Text className="text-xs text-star-faint mt-0.5">{course?.courseCode}</Text>
        </View>
      </View>

      {loading ? (
        <SkeletonCourseDetail />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Grade display — matches dashboard course card style */}
          <View
            className="rounded-2xl border border-space-border bg-space-surface/50 mb-5"
            style={{ padding: 22 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {/* Left: course name + code */}
              <View style={{ flex: 1, paddingRight: 16 }}>
                <Text
                  style={{ fontSize: 28, fontWeight: "400", color: "#E8ECFF", lineHeight: 34, marginBottom: 6 }}
                  numberOfLines={2}
                >
                  {course?.name?.replace(/\s*\(.*?\)\s*$/, "") ?? "Course"}
                </Text>
                <Text style={{ fontSize: 13, color: "#4A5578" }}>
                  {course?.courseCode}
                </Text>
              </View>

              {/* Right: percentage + 3-dot */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 28, fontWeight: "700", color: "#34D399", fontVariant: ["tabular-nums"] }}>
                    {hasAnyChanges && projectedGrade != null
                      ? `${projectedGrade.toFixed(1)}%`
                      : originalGrade != null
                        ? `${originalGrade.toFixed(1)}%`
                        : "—"}
                  </Text>
                  {hasAnyChanges && projectedGrade != null && baseGrade != null && projectedGrade !== baseGrade && (
                    <Text style={{ fontSize: 13, color: deltaColor(projectedGrade - baseGrade), marginTop: 3, fontWeight: "600" }}>
                      {formatDelta(projectedGrade - baseGrade)}
                    </Text>
                  )}
                </View>

                {/* 3-dot menu */}
                <TouchableOpacity
                  ref={headerDotsRef}
                  onPress={openHeaderMenu}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ paddingHorizontal: 6, paddingVertical: 4, marginTop: 2 }}
                >
                  <Text style={{ color: "#8B98B8", fontSize: 22, lineHeight: 22 }}>⋮</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {error && (
            <View className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 mb-4">
              <Text className="text-sm text-red-400">{error}</Text>
            </View>
          )}

          {/* Assignment groups */}
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.id);
            const groupExtras = addedAssignments[group.id] ?? [];
            const groupScore = calcGroupScore(group.assignments, mods, groupExtras);
            const originalGroupScore = calcGroupScore(group.assignments, {});
            const hasGroupMods = group.assignments.some((a) => mods[a.id] !== undefined) || groupExtras.length > 0;
            const groupDelta =
              hasGroupMods && groupScore != null && originalGroupScore != null
                ? groupScore - originalGroupScore
                : null;

            return (
              <View key={group.id} className="border border-space-border rounded-2xl mb-3 overflow-hidden">
                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#0F1829" }}>
                  {/* Left: tap to expand/collapse */}
                  <TouchableOpacity
                    onPress={() =>
                      setExpandedGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.id)) next.delete(group.id);
                        else next.add(group.id);
                        return next;
                      })
                    }
                    style={{ flex: 1, paddingLeft: 20, paddingVertical: 20, paddingRight: 8 }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 22, fontWeight: "400", color: "#E8ECFF", lineHeight: 28 }}>
                      {group.name}
                    </Text>
                    {group.weight > 0 && (
                      <Text style={{ fontSize: 12, color: "#4A5578", marginTop: 4 }}>
                        {group.weight}% of grade
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Right: score + 3-dot */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 16 }}>
                    {groupScore != null && (
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 22, fontWeight: "700", color: "#34D399", fontVariant: ["tabular-nums"] }}>
                          {groupScore.toFixed(1)}%
                        </Text>
                        {groupDelta != null && groupDelta !== 0 && (
                          <Text style={{ fontSize: 11, color: deltaColor(groupDelta), fontWeight: "600", marginTop: 1 }}>
                            {formatDelta(groupDelta)}
                          </Text>
                        )}
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={(e) => {
                        setGroupMenuPos({ x: e.nativeEvent.pageX - 190, y: e.nativeEvent.pageY + 8 });
                        setGroupMenuId(group.id);
                        setGroupMenuVisible(true);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ paddingHorizontal: 6, paddingVertical: 4 }}
                    >
                      <Text style={{ color: "#8B98B8", fontSize: 22, lineHeight: 22 }}>⋮</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {isExpanded && (
                  <View className="px-4 bg-space-surface/30">
                    {group.assignments.length === 0 && groupExtras.length === 0 ? (
                      <Text className="text-xs text-star-faint py-5 text-center">
                        No assignments
                      </Text>
                    ) : (
                      <>
                        {/* Custom assignments at the top */}
                        {groupExtras.map((ca) => (
                          <CustomAssignmentRow
                            key={ca.id}
                            ca={ca}
                            onEdit={(score, pointsPossible) => editCustomAssignment(group.id, ca.id, score, pointsPossible)}
                            onDelete={() => removeCustomAssignment(group.id, ca.id)}
                          />
                        ))}
                        {group.assignments.map((a) => (
                          <AssignmentRow
                            key={a.id}
                            assignment={a}
                            mod={mods[a.id] ?? {}}
                            onEdit={(score) => setMod(a.id, { editedScore: score, dropped: false })}
                            onDrop={() => setMod(a.id, { dropped: !mods[a.id]?.dropped })}
                            onReset={() => resetMod(a.id)}
                          />
                        ))}
                      </>
                    )}

                  </View>
                )}
              </View>
            );
          })}

          {groups.length === 0 && !loading && !error && (
            <View className="items-center py-12">
              <Text className="text-sm text-star-faint">No assignment data available.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Group 3-dot popover */}
      <Modal visible={groupMenuVisible} transparent animationType="none" onRequestClose={() => setGroupMenuVisible(false)}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setGroupMenuVisible(false)}>
          <View style={{
            position: "absolute",
            left: groupMenuPos.x,
            top: groupMenuPos.y,
            backgroundColor: "#162032",
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#1C2A45",
            minWidth: 190,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 16,
            elevation: 10,
          }}>
            {[
              { label: "Add Assignment", color: "#E8ECFF" },
              { label: "Reset Category", color: "#F87171" },
            ].map((item, i, arr) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => {
                  setGroupMenuVisible(false);
                  if (i === 0 && groupMenuId) {
                    const existing = addedAssignments[groupMenuId] ?? [];
                    let n = 1;
                    while (existing.some((a) => a.name === `New Assignment #${n}`)) n++;
                    setAddName(`New Assignment #${n}`);
                    setAddScore("");
                    setAddPossible("");
                    setAddSheetGroupId(groupMenuId);
                  } else if (i === 1 && groupMenuId) {
                    resetCategory(groupMenuId);
                  }
                }}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 14,
                  borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                  borderBottomColor: "#1C2A45",
                }}
              >
                <Text style={{ fontSize: 15, color: item.color }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Header 3-dot popover */}
      <Modal visible={headerMenuVisible} transparent animationType="none" onRequestClose={() => setHeaderMenuVisible(false)}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setHeaderMenuVisible(false)}>
          <View style={{
            position: "absolute",
            left: headerMenuPos.x,
            top: headerMenuPos.y,
            backgroundColor: "#162032",
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#1C2A45",
            minWidth: 200,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 16,
            elevation: 10,
          }}>
            {[
              { label: "Final Grade Calculator", color: "#E8ECFF" },
              { label: "Reset Everything", color: "#F87171" },
            ].map((item, i, arr) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => {
                  setHeaderMenuVisible(false);
                  if (i === 0) setFinalCalcVisible(true);
                  else if (i === 1) resetAll();
                }}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 14,
                  borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                  borderBottomColor: "#1C2A45",
                }}
              >
                <Text style={{ fontSize: 15, color: item.color }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Assignment sheet */}
      <Modal
        visible={addSheetGroupId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setAddSheetGroupId(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <TouchableOpacity
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
            activeOpacity={1}
            onPress={() => setAddSheetGroupId(null)}
          />
          <View style={{
            backgroundColor: "#0C1220",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            borderColor: "#1C2A45",
            paddingTop: 20,
            paddingBottom: 40,
            alignItems: "center",
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#1C2A45", marginBottom: 20 }} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              scrollEnabled={false}
              style={{ width: "100%" }}
              contentContainerStyle={{ paddingHorizontal: 24 }}
            >
              <Text style={{ fontSize: 18, fontWeight: "600", color: "#E8ECFF", marginBottom: 24, textAlign: "center" }}>
                Add Assignment
              </Text>

              <Text style={{ fontSize: 13, color: "#4A5578", marginBottom: 8 }}>Name (optional)</Text>
              <TextInput
                value={addName}
                onChangeText={setAddName}
                placeholder="e.g. Unit 9 Test"
                placeholderTextColor="#2A3A56"
                style={{
                  width: "100%",
                  height: 52,
                  borderWidth: 1,
                  borderColor: "#818CF8",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  color: "#E8ECFF",
                  fontSize: 16,
                  backgroundColor: "#162032",
                  marginBottom: 20,
                }}
              />

              <Text style={{ fontSize: 13, color: "#4A5578", marginBottom: 8 }}>Score</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 28 }}>
                <TextInput
                  value={addScore}
                  onChangeText={setAddScore}
                  keyboardType="decimal-pad"
                  placeholder="earned"
                  placeholderTextColor="#2A3A56"
                  style={{
                    flex: 1,
                    height: 52,
                    borderWidth: 1,
                    borderColor: "#818CF8",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    color: "#E8ECFF",
                    fontSize: 18,
                    backgroundColor: "#162032",
                    textAlign: "center",
                  }}
                />
                <Text style={{ fontSize: 20, color: "#4A5578" }}>/</Text>
                <TextInput
                  value={addPossible}
                  onChangeText={setAddPossible}
                  keyboardType="decimal-pad"
                  placeholder="possible"
                  placeholderTextColor="#2A3A56"
                  style={{
                    flex: 1,
                    height: 52,
                    borderWidth: 1,
                    borderColor: "#818CF8",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    color: "#E8ECFF",
                    fontSize: 18,
                    backgroundColor: "#162032",
                    textAlign: "center",
                  }}
                />
              </View>

              <TouchableOpacity
                onPressIn={() => {
                  const score = parseFloat(addScore);
                  const possible = parseFloat(addPossible);
                  if (!isNaN(score) && !isNaN(possible) && possible > 0 && score >= 0 && addSheetGroupId) {
                    addCustomAssignment(addSheetGroupId, {
                      id: `custom-${Date.now()}`,
                      name: addName.trim(),
                      score,
                      pointsPossible: possible,
                    });
                    Keyboard.dismiss();
                    setAddSheetGroupId(null);
                  }
                }}
                style={{
                  height: 52,
                  borderRadius: 14,
                  backgroundColor: "#818CF8",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "white" }}>Add</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Final Grade Calculator */}
      <Modal visible={finalCalcVisible} transparent animationType="slide" onRequestClose={() => setFinalCalcVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <TouchableOpacity
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
            activeOpacity={1}
            onPress={() => setFinalCalcVisible(false)}
          />
          <View style={{
            backgroundColor: "#0C1220",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            borderColor: "#1C2A45",
            paddingTop: 20,
            paddingBottom: 40,
            alignItems: "center",
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#1C2A45", marginBottom: 20 }} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              scrollEnabled={false}
              style={{ width: "100%" }}
              contentContainerStyle={{ paddingHorizontal: 24 }}
            >
              <Text style={{ fontSize: 18, fontWeight: "600", color: "#E8ECFF", marginBottom: 24, textAlign: "center" }}>
                Final Grade Calculator
              </Text>

              <Text style={{ fontSize: 13, color: "#4A5578", marginBottom: 8 }}>Final exam weight</Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
                <TextInput
                  value={finalWeight}
                  onChangeText={setFinalWeight}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 20"
                  placeholderTextColor="#2A3A56"
                  style={{
                    flex: 1,
                    height: 52,
                    borderWidth: 1,
                    borderColor: "#818CF8",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    color: "#E8ECFF",
                    fontSize: 18,
                    backgroundColor: "#162032",
                  }}
                />
                <Text style={{ fontSize: 18, color: "#4A5578", marginLeft: 10 }}>%</Text>
              </View>

              <Text style={{ fontSize: 13, color: "#4A5578", marginBottom: 8 }}>Target final grade</Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 28 }}>
                <TextInput
                  value={targetGrade}
                  onChangeText={setTargetGrade}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 90"
                  placeholderTextColor="#2A3A56"
                  style={{
                    flex: 1,
                    height: 52,
                    borderWidth: 1,
                    borderColor: "#818CF8",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    color: "#E8ECFF",
                    fontSize: 18,
                    backgroundColor: "#162032",
                  }}
                />
                <Text style={{ fontSize: 18, color: "#4A5578", marginLeft: 10 }}>%</Text>
              </View>

              <View style={{
                backgroundColor: "#162032",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "#1C2A45",
                padding: 20,
                alignItems: "center",
              }}>
                <Text style={{ fontSize: 13, color: "#4A5578", marginBottom: 8 }}>You need on the final</Text>
                <Text style={{ fontSize: 45, fontWeight: "700", color: finalResultColor, fontVariant: ["tabular-nums"] }}>
                  {finalResultText}
                </Text>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
