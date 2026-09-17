import React from "react";
import { View, ViewStyle } from "react-native";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  className?: string;
}

export function Card({ children, style, className }: CardProps) {
  return (
    <View
      className={`rounded-2xl border border-space-border bg-space-surface/50 p-4 ${className ?? ""}`}
      style={style}
    >
      {children}
    </View>
  );
}
