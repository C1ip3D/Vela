import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

interface FadeSlideProps {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  skip?: boolean;
}

export function FadeSlide({
  children,
  delay = 0,
  distance = 18,
  duration = 480,
  skip = false,
}: FadeSlideProps) {
  const opacity = useRef(new Animated.Value(skip ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(skip ? 0 : distance)).current;

  useEffect(() => {
    if (skip) return;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        useNativeDriver: true,
        tension: 110,
        friction: 14,
      }),
    ]).start();
  }, []);

  if (skip) return <>{children}</>;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}
