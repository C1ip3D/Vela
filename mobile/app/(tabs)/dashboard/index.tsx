import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useCourses } from "@/hooks/useCourses";
import { gradeColor } from "@/lib/utils";
import { AlertTriangle, BookOpen, Star } from "lucide-react-native";
import { Bone } from "@/components/ui/Skeleton";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatCard } from "@/components/ui/StatCard";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonDashboard() {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      {/* GPA hero skeleton */}
      <View className="rounded-2xl border border-space-border bg-space-elevated p-6 mb-4">
        <Bone w={90} h={10} />
        <View className="flex-row mt-5" style={{ gap: 0 }}>
          <View className="flex-1 gap-3">
            <Bone w={72} h={10} />
            <Bone w={80} h={52} />
          </View>
          <View style={{ width: 1, backgroundColor: "#1C2A45", marginHorizontal: 20 }} />
          <View className="flex-1 gap-3">
            <Bone w={72} h={10} />
            <Bone w={80} h={52} />
          </View>
        </View>
      </View>

      {/* Stats row skeleton */}
      <View className="flex-row gap-3 mb-6">
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-1 rounded-2xl border border-space-border bg-space-surface/50 p-3.5 gap-2" style={{ minHeight: 88 }}>
            <Bone w={16} h={16} />
            <Bone w="60%" h={24} />
            <Bone w="50%" h={9} />
          </View>
        ))}
      </View>

      {/* Section label */}
      <Bone w={120} h={10} />

      {/* Course card skeletons */}
      <View className="mt-3 gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} className="border border-space-border rounded-2xl bg-space-surface/50 p-4 gap-3">
            <View className="flex-row justify-between items-start">
              <Bone w="55%" h={14} />
              <Bone w={32} h={26} />
            </View>
            <Bone w="35%" h={10} />
            <Bone w="100%" h={3} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Grade progress bar ────────────────────────────────────────────────────────

function GradeBar({ grade }: { grade: number }) {
  const color =
    grade >= 90 ? "#34D399" : grade >= 80 ? "#818CF8" : grade >= 70 ? "#F59E0B" : "#F43F5E";
  return (
    <View className="h-1 rounded-full bg-space-border mt-2.5 overflow-hidden">
      <View
        style={{ width: `${Math.min(grade, 100)}%`, backgroundColor: color, height: "100%", borderRadius: 4 }}
      />
    </View>
  );
}

// ── Course card ───────────────────────────────────────────────────────────────

function GradeCard({ course }: { course: any }) {
  const grade = course.currentGrade;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(tabs)/courses/${course.id}`)}
      className="border border-space-border rounded-2xl bg-space-surface/50 mb-4"
      style={{ padding: 22 }}
      activeOpacity={0.65}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* Left: name + code/term + missing */}
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text
            style={{ fontSize: 28, fontWeight: "400", color: "#E8ECFF", lineHeight: 34, marginBottom: 6 }}
            numberOfLines={2}
          >
            {course.name.replace(/\s*\(.*?\)\s*$/, "")}
          </Text>
          <Text style={{ fontSize: 13, color: "#4A5578" }}>
            {course.courseCode} · {course.term}
          </Text>
          {course.missingCount > 0 && (
            <View className="flex-row items-center gap-1.5" style={{ marginTop: 10 }}>
              <AlertTriangle size={13} color="#F59E0B" />
              <Text style={{ fontSize: 13, color: "#FBBF24" }}>{course.missingCount} missing</Text>
            </View>
          )}
        </View>

        {/* Right: percentage vertically centered */}
        <Text
          style={{
            color: "#34D399",
            fontSize: 28,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
          }}
        >
          {grade != null ? `${grade.toFixed(1)}%` : "—"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { courses, loading, gpa } = useCourses();
  const totalMissing = courses.reduce((sum, c) => sum + c.missingCount, 0);
  const avgGrade =
    courses.filter((c) => c.currentGrade != null).length > 0
      ? courses.filter((c) => c.currentGrade != null).reduce((s, c) => s + c.currentGrade!, 0) /
        courses.filter((c) => c.currentGrade != null).length
      : null;

  return (
    <SafeAreaView className="flex-1 bg-space-void">
      {loading ? (
        <SkeletonDashboard />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {/* GPA Hero */}
          <View
            className="rounded-2xl bg-space-elevated mb-4"
            style={{ borderWidth: 1, borderColor: "#253A5E" }}
          >
            {/* Header row */}
            <View className="px-6 pt-5 pb-4">
              <Text className="text-[10px] text-star-faint uppercase tracking-[0.22em]">
                GPA Overview
              </Text>
            </View>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: "#1C2A45", marginHorizontal: 0 }} />

            {/* GPA values */}
            <View className="flex-row px-2 py-5">
              {/* Unweighted */}
              <View className="flex-1 items-center">
                <Text className="text-[10px] text-star-faint uppercase tracking-widest mb-2">
                  Unweighted
                </Text>
                <Text
                  className="font-bold text-vela-300"
                  style={{ fontSize: 52, lineHeight: 56, fontVariant: ["tabular-nums"] }}
                >
                  {gpa.unweighted.toFixed(2)}
                </Text>
                <Text className="text-[10px] text-star-faint mt-1">out of 4.0</Text>
              </View>

              {/* Divider */}
              <View style={{ width: 1, backgroundColor: "#1C2A45" }} />

              {/* Weighted */}
              <View className="flex-1 items-center">
                <Text className="text-[10px] text-star-faint uppercase tracking-widest mb-2">
                  Weighted
                </Text>
                <Text
                  className="font-bold text-emerald-400"
                  style={{ fontSize: 52, lineHeight: 56, fontVariant: ["tabular-nums"] }}
                >
                  {gpa.weighted.toFixed(2)}
                </Text>
                <Text className="text-[10px] text-star-faint mt-1">out of 5.0</Text>
              </View>
            </View>
          </View>

          {/* Stats row */}
          <View className="flex-row gap-3 mb-6">
            <StatCard icon={BookOpen} value={courses.length.toString()} label="Courses" />
            <StatCard
              icon={AlertTriangle}
              value={totalMissing.toString()}
              label="Missing"
              warn={totalMissing > 0}
            />
            <StatCard
              icon={Star}
              value={avgGrade != null ? avgGrade.toFixed(1) + "%" : "—"}
              label="Avg Grade"
            />
          </View>

          {/* Course list */}
          <SectionLabel title="Current Courses" />

          {courses.length === 0 ? (
            <View className="rounded-2xl border border-space-border bg-space-surface/30 p-10 items-center mt-1">
              <BookOpen size={36} color="#4A5578" />
              <Text className="text-sm text-star-dim mt-3 text-center leading-6">
                No courses found.{"\n"}Connect Infinite Campus in Settings.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/settings")}
                className="mt-5 px-5 py-3 rounded-xl bg-vela-400/20 border border-vela-400/30"
              >
                <Text className="text-sm text-vela-300 font-medium">Go to Settings</Text>
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
