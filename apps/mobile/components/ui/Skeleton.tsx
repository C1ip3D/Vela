import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

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

export function Spinner({ size = 32, color = "#818CF8" }: { size?: number; color?: string }) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      })
    ).start();
  }, [rotation]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: size * 0.1,
        borderColor: `${color}33`,
        borderTopColor: color,
        transform: [{ rotate: spin }],
      }}
    />
  );
}
