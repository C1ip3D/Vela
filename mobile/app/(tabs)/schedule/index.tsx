import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPin, User, Clock } from "lucide-react-native";
import { useSchedule, SchedulePeriod } from "@/hooks/useSchedule";
import { Spinner } from "@/components/ui/Skeleton";
import { FadeSlide } from "@/components/ui/FadeSlide";

function PeriodRow({ period, index }: { period: SchedulePeriod; index: number }) {
  const hasTime = !!(period.startTime && period.endTime);

  if (period.isCurrent) {
    return (
      <FadeSlide delay={index * 60}>
        <View
          style={{
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "#4F46E5",
            backgroundColor: "#1E1B4B",
            padding: 20,
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View style={{ backgroundColor: "#4F46E5", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginRight: 10 }}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700", letterSpacing: 1 }}>
                NOW · P{period.periodNumber}
              </Text>
            </View>
            {hasTime && (
              <Text style={{ color: "#818CF8", fontSize: 13 }}>
                {period.startTime} – {period.endTime}
              </Text>
            )}
          </View>
          <Text style={{ color: "#E8ECFF", fontSize: 22, fontWeight: "600", marginBottom: 8 }}>
            {period.courseName}
          </Text>
          <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
            {period.teacher && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <User size={13} color="#818CF8" />
                <Text style={{ color: "#818CF8", fontSize: 13 }}>{period.teacher}</Text>
              </View>
            )}
            {period.room && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <MapPin size={13} color="#818CF8" />
                <Text style={{ color: "#818CF8", fontSize: 13 }}>{period.room}</Text>
              </View>
            )}
          </View>
        </View>
      </FadeSlide>
    );
  }

  const dimmed = !period.isCurrent && !period.isNext;

  return (
    <FadeSlide delay={index * 60}>
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: period.isNext ? "#253A5E" : "#131B2E",
          backgroundColor: period.isNext ? "#0F172A" : "transparent",
          padding: 16,
          marginBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Period number */}
        <View style={{ width: 36, alignItems: "center" }}>
          <Text style={{ color: dimmed ? "#2A3A55" : "#4A5578", fontSize: 18, fontWeight: "700" }}>
            {period.periodNumber}
          </Text>
        </View>

        {/* Divider */}
        <View style={{ width: 1, height: "100%", backgroundColor: period.isNext ? "#1C2A45" : "#131B2E", alignSelf: "stretch" }} />

        {/* Content */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Text style={{ color: dimmed ? "#3A4A65" : "#C7D2FE", fontSize: 16, fontWeight: "500", flex: 1 }} numberOfLines={1}>
              {period.courseName}
            </Text>
            {period.isNext && (
              <View style={{ backgroundColor: "#1E2D4A", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ color: "#818CF8", fontSize: 11, fontWeight: "600" }}>NEXT</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            {hasTime && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Clock size={11} color={dimmed ? "#2A3A55" : "#4A5578"} />
                <Text style={{ color: dimmed ? "#2A3A55" : "#4A5578", fontSize: 12 }}>
                  {period.startTime} – {period.endTime}
                </Text>
              </View>
            )}
            {period.teacher && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <User size={11} color={dimmed ? "#2A3A55" : "#4A5578"} />
                <Text style={{ color: dimmed ? "#2A3A55" : "#4A5578", fontSize: 12 }} numberOfLines={1}>
                  {period.teacher}
                </Text>
              </View>
            )}
            {period.room && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <MapPin size={11} color={dimmed ? "#2A3A55" : "#4A5578"} />
                <Text style={{ color: dimmed ? "#2A3A55" : "#4A5578", fontSize: 12 }}>
                  {period.room}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </FadeSlide>
  );
}

export default function ScheduleScreen() {
  const { periods, loading, error } = useSchedule();
  const current = periods.find((p) => p.isCurrent);

  return (
    <SafeAreaView className="flex-1 bg-space-void">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <FadeSlide delay={0}>
          <Text style={{ color: "#E8ECFF", fontSize: 28, fontWeight: "700", marginBottom: 4 }}>
            Today
          </Text>
          {current ? (
            <Text style={{ color: "#4A5578", fontSize: 14, marginBottom: 24 }}>
              Currently in {current.courseName}
            </Text>
          ) : (
            <Text style={{ color: "#4A5578", fontSize: 14, marginBottom: 24 }}>
              {periods.length > 0 ? "No class right now" : "Schedule"}
            </Text>
          )}
        </FadeSlide>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", paddingTop: 60 }}>
            <Spinner size={36} />
          </View>
        ) : error ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Text style={{ color: "#4A5578", fontSize: 14, textAlign: "center" }}>{error}</Text>
          </View>
        ) : periods.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Text style={{ color: "#4A5578", fontSize: 14, textAlign: "center" }}>
              No schedule available today
            </Text>
          </View>
        ) : (
          periods.map((period, i) => (
            <PeriodRow key={`${period.periodNumber}-${i}`} period={period} index={i} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
