import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";

export function usePulse() {
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

export function Bone({ w, h }: { w?: number | `${number}%`; h?: number }) {
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
