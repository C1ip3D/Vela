import React from "react";
import { View, Text } from "react-native";
import { LucideIcon } from "lucide-react-native";

interface StatCardProps {
  icon: LucideIcon;
  value: string;
  label: string;
  warn?: boolean;
}

export function StatCard({ icon: Icon, value, label, warn }: StatCardProps) {
  return (
    <View className="flex-1 rounded-2xl border border-space-border bg-space-surface/50 p-3.5" style={{ minHeight: 88 }}>
      <Icon size={20} color={warn ? "#F59E0B" : "#4A5578"} style={{ marginBottom: 6 }} />
      <Text
        className={`text-3xl font-bold ${warn ? "text-amber-400" : "text-star-bright"}`}
        style={{ fontVariant: ["tabular-nums"] }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text className="text-[13px] text-star-faint mt-1 uppercase tracking-wide">{label}</Text>
    </View>
  );
}
