import React from "react";
import { Text } from "react-native";
import { gradeColor } from "@/lib/utils";

interface GradeChipProps {
  letter: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZES = {
  sm: { fontSize: 16, fontWeight: "700" as const },
  md: { fontSize: 20, fontWeight: "700" as const },
  lg: { fontSize: 32, fontWeight: "800" as const },
  xl: { fontSize: 52, fontWeight: "800" as const },
};

export function GradeChip({ letter, size = "md" }: GradeChipProps) {
  const color = letter && letter !== "—" ? gradeColor(letter) : "#4A5578";
  const style = SIZES[size];
  return (
    <Text
      style={{
        color,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontVariant: ["tabular-nums"],
      }}
    >
      {letter}
    </Text>
  );
}
