import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useCourses } from "@/hooks/useCourses";
import { gradeColor } from "@/lib/utils";
import { AlertTriangle, BookOpen, Star } from "lucide-react-native";

// ── Skeleton pulse ────────────────────────────────────────────────────────────

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

function SkeletonDashboard() {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* GPA hero skeleton */}
      <View className="rounded-2xl border border-space-border bg-space-elevated p-5 mb-5">
        <Bone w={80} h={10} />
        <View className="flex-row gap-6 mt-3">
          <View className="gap-2">
            <Bone w={60} h={9} />
            <Bone w={80} h={36} />
          </View>
          <View className="gap-2">
            <Bone w={60} h={9} />
            <Bone w={80} h={36} />
          </View>

        </View>
      </View>

      {/* Stats row skeleton */}
      <View className="flex-row gap-3 mb-6">
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-1 rounded-xl border border-space-border bg-space-surface/50 p-3 gap-2">
            <Bone w={18} h={14} />
            <Bone w="60%" h={22} />
            <Bone w="50%" h={9} />
          </View>
        ))}
      </View>

      {/* Section label */}
      <Bone w={120} h={10} />

      {/* Course card skeletons */}
      <View className="mt-3 gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} className="border border-space-border rounded-xl bg-space-surface/50 p-4 gap-2">
            <View className="flex-row justify-between items-center">
              <Bone w="55%" h={13} />
              <Bone w={28} h={22} />
            </View>
            <Bone w="35%" h={10} />
            <Bone w="20%" h={10} />
            <Bone w="100%" h={4} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Real content ──────────────────────────────────────────────────────────────

function GradeBar({ grade }: { grade: number }) {
  const color =
    grade >= 90
      ? "#34D399"
      : grade >= 80
        ? "#818CF8"
        : grade >= 70
          ? "#F59E0B"
          : "#F43F5E";
  return (
    <View className="h-1 rounded-full bg-space-border mt-2 overflow-hidden">
      <View
        style={{ width: `${Math.min(grade, 100)}%`, backgroundColor: color, height: "100%", borderRadius: 4 }}
      />
    </View>
  );
}

function GradeCard({ course }: { course: any }) {
  const letter = course.letterGrade ?? "—";
  const color = course.letterGrade ? gradeColor(letter) : "#4A5578";

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(tabs)/courses/${course.id}`)}
      className="border border-space-border rounded-xl bg-space-surface/50 p-4 mb-3"
      activeOpacity={0.7}
    >
      <View className="flex-row items-start justify-between mb-1">
        <Text className="text-sm font-semibold text-star-bright flex-1 pr-2" numberOfLines={1}>
          {course.name}
        </Text>
        <Text style={{ color, fontWeight: "700", fontSize: 18, fontVariant: ["tabular-nums"] }}>
          {letter}
        </Text>
      </View>

      <Text className="text-xs text-star-faint mb-1">{course.courseCode} · {course.term}</Text>

      {course.currentGrade != null && (
        <>
          <Text className="text-xs text-star-dim">{course.currentGrade.toFixed(1)}%</Text>
          <GradeBar grade={course.currentGrade} />
        </>
      )}

      {course.missingCount > 0 && (
        <View className="flex-row items-center gap-1 mt-2">
          <AlertTriangle size={11} color="#F59E0B" />
          <Text className="text-xs text-amber-400">{course.missingCount} missing</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const { courses, loading, gpa } = useCourses();

  const totalMissing = courses.reduce((sum, c) => sum + c.missingCount, 0);

  return (
    <SafeAreaView className="flex-1 bg-space-void">
      {loading ? (
        <SkeletonDashboard />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* GPA Hero */}
          <View className="rounded-2xl border border-vela-400/20 bg-space-elevated p-5 mb-5">
            <Text className="text-xs text-star-faint uppercase tracking-[0.2em] mb-3">GPA Overview</Text>
            <View className="flex-row gap-6">
              <View>
                <Text className="text-xs text-star-dim mb-0.5">Unweighted</Text>
                <Text className="text-4xl font-bold text-vela-300" style={{ fontVariant: ["tabular-nums"] }}>
                  {gpa.unweighted.toFixed(2)}
                </Text>
              </View>
              <View>
                <Text className="text-xs text-star-dim mb-0.5">Weighted</Text>
                <Text className="text-4xl font-bold text-emerald-400" style={{ fontVariant: ["tabular-nums"] }}>
                  {gpa.weighted.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          {/* Stats row */}
          <View className="flex-row gap-3 mb-6">
            {[
              { label: "Courses", value: courses.length.toString(), icon: BookOpen },
              {
                label: "Missing",
                value: totalMissing.toString(),
                icon: AlertTriangle,
                warn: totalMissing > 0,
              },
              {
                label: "Avg Grade",
                value:
                  courses.filter((c) => c.currentGrade != null).length > 0
                    ? (
                        courses
                          .filter((c) => c.currentGrade != null)
                          .reduce((s, c) => s + c.currentGrade!, 0) /
                        courses.filter((c) => c.currentGrade != null).length
                      ).toFixed(1) + "%"
                    : "—",
                icon: Star,
              },
            ].map((stat) => (
              <View
                key={stat.label}
                className="flex-1 rounded-xl border border-space-border bg-space-surface/50 p-3"
              >
                <stat.icon
                  size={14}
                  color={stat.warn ? "#F59E0B" : "#4A5578"}
                  style={{ marginBottom: 4 }}
                />
                <Text
                  className={`text-xl font-bold ${stat.warn ? "text-amber-400" : "text-star-bright"}`}
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {stat.value}
                </Text>
                <Text className="text-[10px] text-star-faint mt-0.5">{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Course list */}
          <Text className="text-xs uppercase tracking-[0.2em] text-star-dim mb-3">Current Courses</Text>

          {courses.length === 0 ? (
            <View className="rounded-xl border border-space-border bg-space-surface/30 p-8 items-center">
              <BookOpen size={32} color="#4A5578" />
              <Text className="text-sm text-star-dim mt-3 text-center">
                No courses found.{"\n"}Connect Infinite Campus in Settings.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/settings")}
                className="mt-4 px-4 py-2 rounded-lg bg-vela-400/20 border border-vela-400/30"
              >
                <Text className="text-sm text-vela-300">Go to Settings</Text>
              </TouchableOpacity>
            </View>
          ) : (
            courses.map((course) => <GradeCard key={course.id} course={course} />)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
