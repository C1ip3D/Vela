import React from "react";
import { Text } from "react-native";

export function SectionLabel({ title }: { title: string }) {
  return (
    <Text className="text-xs uppercase tracking-[0.2em] text-star-faint mb-3 mt-1">
      {title}
    </Text>
  );
}
