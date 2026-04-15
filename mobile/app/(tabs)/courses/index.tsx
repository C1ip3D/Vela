import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useCourses } from "@/hooks/useCourses";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { gradeColor } from "@/lib/utils";
import { AlertTriangle, ChevronRight, BookOpen } from "lucide-react-native";
import { GradeChip } from "@/components/ui/GradeChip";

const COURSE_TYPE_COLORS: Record<string, string> = {
  AP: "#F43F5E",
  HONORS: "#818CF8",
  DUAL_ENROLLMENT: "#14B8A6",
  ADVANCED: "#F59E0B",
  STANDARD: "#4A5578",
};

function CourseTypeBadge({ type }: { type: string }) {
  const color = COURSE_TYPE_COLORS[type] ?? "#4A5578";
  const label =
    type === "DUAL_ENROLLMENT" ? "DE" : type === "STANDARD" ? "STD" : type;
  return (
    <View
      style={{
        borderColor: color,
        backgroundColor: color + "20",
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 7,
        paddingVertical: 3,
      }}
    >
      <Text style={{ color, fontSize: 10, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export default function CoursesScreen() {
  const { isConnected } = useIC();
  const { courses, loading, error } = useCourses();

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-space-void items-center justify-center">
        <ActivityIndicator color="#818CF8" size="large" />
        <Text className="text-sm text-star-dim mt-3">Loading grades...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-space-void">
      {/* Header */}
      <View className="px-5 pt-5 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: "#1C2A45" }}>
        <Text className="text-2xl font-bold text-star-bright">My Grades</Text>
        {isConnected && (
          <Text className="text-xs text-star-faint mt-1">Synced from Infinite Campus</Text>
        )}
      </View>

      {error ? (
        <View className="mx-5 mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <Text className="text-sm text-red-400">{error}</Text>
        </View>
      ) : null}

      {courses.length === 0 && !loading ? (
        <View className="flex-1 items-center justify-center px-10">
          <BookOpen size={44} color="#4A5578" />
          <Text className="text-sm text-star-dim text-center mt-4 leading-6">
            No courses found.{"\n"}Connect Infinite Campus in Settings.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/settings")}
            className="mt-5 px-6 py-3 rounded-xl bg-vela-400/20 border border-vela-400/30"
          >
            <Text className="text-sm text-vela-300 font-medium">Go to Settings</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 20, paddingTop: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: course }) => {
            const letter = course.letterGrade ?? "—";
            const color = course.letterGrade ? gradeColor(letter) : "#4A5578";

            return (
              <TouchableOpacity
                onPress={() => router.push(`/(tabs)/courses/${course.id}`)}
                className="border border-space-border rounded-2xl bg-space-surface/50 p-4 mb-3"
                activeOpacity={0.65}
              >
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-1 pr-3">
                    <Text
                      className="text-[15px] font-semibold text-star-bright"
                      numberOfLines={1}
                    >
                      {course.name}
                    </Text>
                    <Text className="text-xs text-star-faint mt-1">
                      {course.courseCode} · Period {course.period ?? "—"} · {course.term}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <GradeChip letter={letter} size="md" />
                    <ChevronRight size={16} color="#4A5578" />
                  </View>
                </View>

                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <CourseTypeBadge type={course.courseType} />
                    {course.missingCount > 0 && (
                      <View className="flex-row items-center gap-1">
                        <AlertTriangle size={11} color="#F59E0B" />
                        <Text className="text-xs text-amber-400">
                          {course.missingCount} missing
                        </Text>
                      </View>
                    )}
                  </View>

                  {course.currentGrade != null && (
                    <Text
                      className="text-xs text-star-dim"
                      style={{ fontVariant: ["tabular-nums"] }}
                    >
                      {course.currentGrade.toFixed(1)}%
                    </Text>
                  )}
                </View>

                {course.currentGrade != null && (
                  <View className="h-1 rounded-full bg-space-border mt-3 overflow-hidden">
                    <View
                      style={{
                        width: `${Math.min(course.currentGrade, 100)}%`,
                        backgroundColor: color,
                        height: "100%",
                        borderRadius: 4,
                      }}
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
