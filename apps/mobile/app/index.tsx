import { Redirect } from "expo-router";
import { View, Image, Animated, Easing } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef } from "react";

export default function Index() {
  const { user, loading } = useAuth();

  const pulse = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1200, useNativeDriver: true, easing: Easing.linear })
    ).start();
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  if (!loading) {
    return <Redirect href={user ? "/(tabs)/dashboard" : "/(auth)/login"} />;
  }

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#03060D" }}>
      {/* Rotating arc ring */}
      <Animated.View
        style={{
          position: "absolute",
          width: 96,
          height: 96,
          borderRadius: 48,
          borderWidth: 2.5,
          borderColor: "transparent",
          borderTopColor: "#818CF8",
          borderRightColor: "#818CF8",
          transform: [{ rotate }],
        }}
      />

      {/* Pulsing logo */}
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Image
          source={require("../assets/logo.png")}
          style={{ width: 52, height: 52 }}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}
