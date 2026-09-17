import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GraduationCap, ChevronUp, ChevronDown, Sparkles, AlertTriangle } from "lucide-react-native";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { api } from "@/lib/api";
import { rankCourses, FinalsRanked, FinalsInput, DUSD_DEFAULT_FINAL_WEIGHT } from "@/lib/engines/finals";
import { Bone, Spinner } from "@/components/ui/Skeleton";
import { percentageToLetter, gradeColor } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssignmentGroup {
  id: string;
  name: string;
  weight: number;
  score: number | null;
}

interface StudyOrderItem {
  course: string;
  hours: number;
  reason: string;
}

interface KeplerResult {
  studyOrder: StudyOrderItem[];
  summary: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_DAYS = 3;
const DEFAULT_HOURS_PER_DAY = 6;
const FETCH_TIMEOUT_MS = 10_000;

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, color: "#4A5578", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity
          onPress={() => onChange(Math.max(min, value - 1))}
          style={{
            width: 32, height: 32, borderRadius: 8,
            borderWidth: 1, borderColor: "#1C2A45",
            alignItems: "center", justifyContent: "center",
          }}
          activeOpacity={0.65}
        >
          <ChevronDown size={16} color="#818CF8" />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: "700", color: "#E8ECFF", minWidth: 40, textAlign: "center" }}>
          {value}
          <Text style={{ fontSize: 13, color: "#4A5578", fontWeight: "400" }}> {unit}</Text>
        </Text>
        <TouchableOpacity
          onPress={() => onChange(Math.min(max, value + 1))}
          style={{
            width: 32, height: 32, borderRadius: 8,
            borderWidth: 1, borderColor: "#1C2A45",
            alignItems: "center", justifyContent: "center",
          }}
          activeOpacity={0.65}
        >
          <ChevronUp size={16} color="#818CF8" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Ranked course card ────────────────────────────────────────────────────────

function CourseRankCard({ course, rank }: { course: FinalsRanked; rank: number }) {
  const letter = percentageToLetter(course.currentGrade);
  const color = gradeColor(letter);
  const maxLetter = percentageToLetter(course.maxAchievableGrade);
  const maxColor = gradeColor(maxLetter);
  const isDefault = course.finalWeightSource === "default";

  return (
    <View
      style={{
        borderWidth: 1, borderColor: "#1C2A45", borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.02)", padding: 18, marginBottom: 12,
      }}
    >
      {/* Rank + name row */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View
          style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: "#0F172A", borderWidth: 1, borderColor: "#253A5E",
            alignItems: "center", justifyContent: "center", marginTop: 2,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#A5B4FC" }}>{rank}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, color: "#E8ECFF", fontWeight: "500", lineHeight: 22 }}>
            {course.name.replace(/\s*\(.*?\)\s*$/, "")}
          </Text>
          <Text style={{ fontSize: 12, color: "#4A5578", marginTop: 3 }}>
            {course.courseType} · {(course.finalWeightPct * 100).toFixed(0)}% final
            {isDefault ? " (DUSD default)" : ""}
          </Text>
        </View>
      </View>

      {/* Grade row */}
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14, gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: "#4A5578", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
            Now
          </Text>
          <Text style={{ fontSize: 24, fontWeight: "700", color, fontVariant: ["tabular-nums"] }}>
            {course.currentGrade.toFixed(1)}%
          </Text>
        </View>
        <Text style={{ fontSize: 18, color: "#253A5E" }}>→</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: "#4A5578", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
            Max (ace final)
          </Text>
          <Text style={{ fontSize: 24, fontWeight: "700", color: maxColor, fontVariant: ["tabular-nums"] }}>
            {course.maxAchievableGrade.toFixed(1)}%
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 11, color: "#4A5578", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
            +Impact
          </Text>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#34D399" }}>
            +{course.maxGradeImprovement.toFixed(1)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Kepler card ───────────────────────────────────────────────────────────────

function KeplerCardSkeleton() {
  return (
    <View
      style={{
        borderWidth: 1, borderColor: "#253A5E", borderRadius: 16,
        backgroundColor: "rgba(165,180,252,0.04)", padding: 20, marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Sparkles size={16} color="#818CF8" />
        <Text style={{ fontSize: 13, color: "#818CF8", fontWeight: "600" }}>Kepler is planning…</Text>
      </View>
      <View style={{ gap: 10 }}>
        <Bone h={12} />
        <Bone w="80%" h={12} />
        <Bone w="90%" h={12} />
        <Bone w="60%" h={12} />
      </View>
    </View>
  );
}

function KeplerCard({ result, totalHours }: { result: KeplerResult; totalHours: number }) {
  if (result.studyOrder.length === 0 && !result.summary) return null;

  return (
    <View
      style={{
        borderWidth: 1, borderColor: "#253A5E", borderRadius: 16,
        backgroundColor: "rgba(165,180,252,0.04)", padding: 20, marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Sparkles size={16} color="#818CF8" />
        <Text style={{ fontSize: 13, color: "#818CF8", fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 }}>
          Kepler · Study Plan
        </Text>
      </View>

      {result.summary ? (
        <Text style={{ fontSize: 14, color: "#94A3B8", lineHeight: 20, marginBottom: 14 }}>
          {result.summary}
        </Text>
      ) : null}

      {result.studyOrder.map((item, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row", alignItems: "flex-start", gap: 12,
            paddingVertical: 10,
            borderTopWidth: i === 0 ? 0 : 1, borderTopColor: "#1C2A45",
          }}
        >
          <View
            style={{
              backgroundColor: "#0F172A", borderWidth: 1, borderColor: "#253A5E",
              borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, minWidth: 44, alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#A5B4FC" }}>{item.hours}h</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, color: "#E8ECFF", fontWeight: "500", marginBottom: 2 }}>
              {item.course}
            </Text>
            <Text style={{ fontSize: 12, color: "#4A5578", lineHeight: 16 }}>
              {item.reason}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function FinalsScreen() {
  const { session, isConnected, isInitializing, reauth, login } = useIC();

  const [days, setDays] = useState(DEFAULT_DAYS);
  const [hoursPerDay, setHoursPerDay] = useState(DEFAULT_HOURS_PER_DAY);

  const [loading, setLoading] = useState(true);
  const [ranked, setRanked] = useState<FinalsRanked[]>([]);
  const [icError, setIcError] = useState<string | null>(null);

  const [keplerLoading, setKeplerLoading] = useState(false);
  const [keplerResult, setKeplerResult] = useState<KeplerResult | null>(null);

  const keplerDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch IC data and rank ────────────────────────────────────────────────

  const loadFinalsData = useCallback(async (currentSession = session) => {
    if (!isConnected || !currentSession) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setIcError(null);
    setRanked([]);
    setKeplerResult(null);

    try {
      // Fetch course list
      let coursesData: any;
      try {
        const res = await api.post("/api/ic/courses", {
          authToken: currentSession.authToken,
          baseUrl: currentSession.baseUrl,
          appName: currentSession.appName,
        });
        coursesData = res.data;
      } catch (err: any) {
        if (err?.response?.status === 401) {
          const newSession = await reauth();
          if (newSession) {
            const res = await api.post("/api/ic/courses", {
              authToken: newSession.authToken,
              baseUrl: newSession.baseUrl,
              appName: newSession.appName,
            });
            coursesData = res.data;
            currentSession = newSession;
          } else {
            setIcError("Session expired. Please reconnect Infinite Campus in Settings.");
            setLoading(false);
            return;
          }
        } else {
          throw err;
        }
      }

      const courses: any[] = coursesData.courses ?? [];

      // Fetch assignment groups for every course in parallel with a 10s timeout
      const withTimeout = (promise: Promise<any>) =>
        Promise.race([
          promise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), FETCH_TIMEOUT_MS)),
        ]);

      const groupResults = await Promise.allSettled(
        courses.map((c: any) =>
          withTimeout(
            api
              .post("/api/ic/assignments", {
                authToken: currentSession!.authToken,
                baseUrl: currentSession!.baseUrl,
                appName: currentSession!.appName,
                courseId: c.id,
              })
              .then((r) => ({ courseId: c.id, groups: r.data.groups ?? [] }))
          )
        )
      );

      const groupsByCourseId: Record<string, AssignmentGroup[]> = {};
      groupResults.forEach((result, i) => {
        const courseId = courses[i].id;
        if (result.status === "fulfilled" && result.value) {
          groupsByCourseId[courseId] = result.value.groups;
        } else {
          groupsByCourseId[courseId] = [];
        }
      });

      const inputs: FinalsInput[] = courses.map((c: any) => ({
        id: c.id,
        name: c.name,
        courseType: c.courseType ?? "STANDARD",
        groups: groupsByCourseId[c.id] ?? [],
      }));

      const result = rankCourses(inputs);
      setRanked(result);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "Could not load grades";
      setIcError(msg);
    } finally {
      setLoading(false);
    }
  }, [session, isConnected, reauth]);

  useEffect(() => {
    if (isInitializing) return;
    loadFinalsData();
  }, [loadFinalsData, isInitializing]);

  // ── Kepler call — fires after ranked list is ready, re-fires on budget change ─

  const fireKepler = useCallback(
    async (courses: FinalsRanked[], d: number, h: number) => {
      if (courses.length === 0) return;
      setKeplerLoading(true);
      setKeplerResult(null);
      try {
        const res = await api.post("/api/advisor/finals", {
          rankedCourses: courses,
          timeBudget: { days: d, hoursPerDay: h },
        });
        setKeplerResult(res.data);
      } catch {
        // fallback: no Kepler card, ranked list still visible
        setKeplerResult(null);
      } finally {
        setKeplerLoading(false);
      }
    },
    []
  );

  // Fire Kepler when ranked list first loads
  useEffect(() => {
    if (ranked.length > 0 && !loading) {
      fireKepler(ranked, days, hoursPerDay);
    }
  }, [ranked, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fire Kepler when budget changes (debounced 600ms)
  const onBudgetChange = useCallback(
    (newDays: number, newHours: number) => {
      if (keplerDebounce.current) clearTimeout(keplerDebounce.current);
      keplerDebounce.current = setTimeout(() => {
        if (ranked.length > 0) fireKepler(ranked, newDays, newHours);
      }, 600);
    },
    [ranked, fireKepler]
  );

  const handleDaysChange = (v: number) => {
    setDays(v);
    onBudgetChange(v, hoursPerDay);
  };

  const handleHoursChange = (v: number) => {
    setHoursPerDay(v);
    onBudgetChange(days, v);
  };

  const totalHours = days * hoursPerDay;

  // ── Not connected ─────────────────────────────────────────────────────────

  if (!isInitializing && !isConnected) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#070B16" }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <GraduationCap size={40} color="#4A5578" />
          <Text style={{ fontSize: 18, color: "#E8ECFF", fontWeight: "600", marginTop: 16, textAlign: "center" }}>
            Connect Infinite Campus
          </Text>
          <Text style={{ fontSize: 14, color: "#4A5578", marginTop: 8, textAlign: "center", lineHeight: 20 }}>
            Finals Study Coach needs your live grades.{"\n"}Log in with your IC credentials in Settings.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070B16" }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <GraduationCap size={22} color="#818CF8" />
          <Text style={{ fontSize: 22, fontWeight: "700", color: "#E8ECFF" }}>
            Finals Study Coach
          </Text>
        </View>

        {/* Time budget */}
        <View
          style={{
            borderWidth: 1, borderColor: "#1C2A45", borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.02)", padding: 20, marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 11, color: "#4A5578", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>
            Study Budget
          </Text>
          <View style={{ flexDirection: "row", gap: 24 }}>
            <Stepper label="Days" value={days} min={1} max={14} unit="d" onChange={handleDaysChange} />
            <Stepper label="Hrs / Day" value={hoursPerDay} min={1} max={12} unit="h" onChange={handleHoursChange} />
          </View>
          <Text style={{ fontSize: 12, color: "#253A5E", marginTop: 12 }}>
            {totalHours} total hours · Kepler will allocate across your finals
          </Text>
        </View>

        {/* Loading state */}
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Spinner size={36} />
            <Text style={{ fontSize: 14, color: "#4A5578", marginTop: 16 }}>
              Loading your grades…
            </Text>
          </View>
        ) : icError ? (
          <View
            style={{
              borderWidth: 1, borderColor: "#F43F5E33", borderRadius: 16,
              backgroundColor: "rgba(244,63,94,0.06)", padding: 20,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <AlertTriangle size={16} color="#F43F5E" />
              <Text style={{ fontSize: 14, color: "#F43F5E", fontWeight: "600" }}>Could not load grades</Text>
            </View>
            <Text style={{ fontSize: 13, color: "#94A3B8" }}>{icError}</Text>
            <TouchableOpacity
              onPress={() => loadFinalsData()}
              style={{
                marginTop: 14, borderWidth: 1, borderColor: "#253A5E", borderRadius: 10,
                paddingVertical: 10, paddingHorizontal: 16, alignSelf: "flex-start",
              }}
              activeOpacity={0.65}
            >
              <Text style={{ fontSize: 13, color: "#818CF8" }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : ranked.length === 0 ? (
          /* Empty state: all grades maxed out or no improvable courses */
          <View
            style={{
              borderWidth: 1, borderColor: "#1C2A45", borderRadius: 16,
              backgroundColor: "rgba(52,211,153,0.04)", padding: 24, alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 32 }}>🎓</Text>
            <Text style={{ fontSize: 17, color: "#34D399", fontWeight: "600", marginTop: 12, textAlign: "center" }}>
              Your grades are locked in
            </Text>
            <Text style={{ fontSize: 14, color: "#4A5578", marginTop: 8, textAlign: "center", lineHeight: 20 }}>
              No final can meaningfully move your grade.{"\n"}You're in great shape.
            </Text>
          </View>
        ) : (
          <>
            {/* Kepler card — loads async */}
            {keplerLoading ? (
              <KeplerCardSkeleton />
            ) : keplerResult && (keplerResult.studyOrder.length > 0 || keplerResult.summary) ? (
              <KeplerCard result={keplerResult} totalHours={totalHours} />
            ) : null}

            {/* Ranked course list */}
            <Text
              style={{
                fontSize: 11, color: "#4A5578", letterSpacing: 1.5,
                textTransform: "uppercase", marginBottom: 12,
              }}
            >
              Priority Ranking · {ranked.length} course{ranked.length !== 1 ? "s" : ""}
            </Text>

            {ranked.map((course, i) => (
              <CourseRankCard key={course.id} course={course} rank={i + 1} />
            ))}

            <Text style={{ fontSize: 12, color: "#253A5E", textAlign: "center", marginTop: 4 }}>
              Based on DUSD 15% default where IC doesn't expose final weight
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
