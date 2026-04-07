import React from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { router } from "expo-router";
import { useCourses } from "@/hooks/useCourses";
import { useAuth } from "@/contexts/AuthContext";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { gradeColor } from "@/lib/utils";
import { AlertTriangle, BookOpen, Star } from "lucide-react-native";

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
  const { user } = useAuth();
  const { isConnected } = useIC();
  const { courses, loading, gpa } = useCourses();

  const displayName = user?.displayName || "Student";
  const totalMissing = courses.reduce((sum, c) => sum + c.missingCount, 0);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-space-void items-center justify-center">
        <ActivityIndicator color="#818CF8" size="large" />
        <Text className="text-sm text-star-dim mt-3">
          {isConnected ? "Loading from Infinite Campus..." : "Loading courses..."}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-space-void">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-xs text-star-faint uppercase tracking-[0.2em]">Good morning</Text>
          <Text className="text-2xl font-bold text-star-bright mt-0.5">{displayName}</Text>
        </View>

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
    </SafeAreaView>
  );
}
