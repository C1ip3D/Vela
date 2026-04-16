import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Eye, EyeOff, ArrowRight } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { DistrictSearch, District } from "@/components/forms/DistrictSearch";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const STARS = [
  { x: 0.08, y: 0.05, size: 1.5, delay: 0 },
  { x: 0.22, y: 0.12, size: 2,   delay: 400 },
  { x: 0.65, y: 0.07, size: 1,   delay: 800 },
  { x: 0.82, y: 0.18, size: 2.5, delay: 200 },
  { x: 0.45, y: 0.03, size: 1.5, delay: 1200 },
  { x: 0.91, y: 0.35, size: 1,   delay: 600 },
  { x: 0.05, y: 0.28, size: 2,   delay: 1000 },
  { x: 0.35, y: 0.22, size: 1,   delay: 300 },
  { x: 0.72, y: 0.30, size: 1.5, delay: 900 },
  { x: 0.55, y: 0.40, size: 1,   delay: 1400 },
  { x: 0.15, y: 0.45, size: 2,   delay: 700 },
  { x: 0.88, y: 0.55, size: 1.5, delay: 100 },
  { x: 0.30, y: 0.60, size: 1,   delay: 1600 },
  { x: 0.60, y: 0.65, size: 2,   delay: 500 },
  { x: 0.10, y: 0.70, size: 1.5, delay: 1100 },
  { x: 0.78, y: 0.72, size: 1,   delay: 1800 },
  { x: 0.42, y: 0.78, size: 2,   delay: 250 },
  { x: 0.95, y: 0.80, size: 1.5, delay: 1300 },
  { x: 0.25, y: 0.85, size: 1,   delay: 750 },
  { x: 0.68, y: 0.90, size: 2,   delay: 1700 },
];

function Star({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const opacity = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.2, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x * SCREEN_WIDTH,
        top: y * SCREEN_HEIGHT,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#A5B4FC",
        opacity,
      }}
    />
  );
}

export default function LoginScreen() {
  const { signIn, signUp, user } = useAuth();
  const { login: icLogin, isChecking: icChecking, loginError: icError } = useIC();

  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [icUsername, setIcUsername] = useState("");
  const [icPassword, setIcPassword] = useState("");
  const [showIcPassword, setShowIcPassword] = useState(false);

  useEffect(() => {
    if (user) router.replace("/(tabs)/dashboard");
  }, [user]);

  const handleLogin = async () => {
    if (!selectedDistrict || !icUsername.trim() || !icPassword.trim()) return;
    const url = selectedDistrict.district_baseurl.replace(/\/$/, "");

    const ok = await icLogin(
      url,
      icUsername.trim(),
      icPassword.trim(),
      selectedDistrict.district_app_name
    );
    if (!ok) return;

    try {
      const hostname = new URL(url).hostname;
      const pseudoEmail = `${icUsername.toLowerCase()}@${hostname}.ic.vela.app`;
      const pseudoPassword = `VelaIC#${btoa(pseudoEmail).substring(0, 16)}`;
      try {
        await signIn(pseudoEmail, pseudoPassword);
      } catch (e: any) {
        if (e.code === "auth/invalid-credential" || e.code === "auth/user-not-found") {
          await signUp(pseudoEmail, pseudoPassword, icUsername);
        } else throw e;
      }
      router.replace("/(tabs)/dashboard");
    } catch (e) {
      console.error("Shadow account error:", e);
    }
  };

  const canSubmit = !!selectedDistrict && !!icUsername.trim() && !!icPassword.trim();

  return (
    <SafeAreaView className="flex-1 bg-space-void">
      {/* Shimmering stars */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        {STARS.map((s, i) => (
          <Star key={i} {...s} />
        ))}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Logo — absolutely pinned to top */}
        <View style={{ position: "absolute", top: 72, left: 0, right: 0, alignItems: "center" }} pointerEvents="none">
          <Image
            source={require("@/assets/logo.png")}
            style={{ width: 150, height: 150 }}
            resizeMode="contain"
          />
          <Text className="text-3xl font-bold text-star-bright tracking-widest">VELA</Text>
          <Text className="text-[11px] text-star-faint tracking-[0.3em] mt-1.5">
            ACADEMIC NAVIGATOR
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Card — centered on screen */}
          <View className="rounded-3xl border border-space-border bg-space-surface/60 p-7">

            {/* Error */}
            {icError ? (
              <View className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                <Text className="text-base text-red-400">{icError}</Text>
              </View>
            ) : null}

            {/* District search */}
            <View className="mb-5">
              <DistrictSearch
                selectedDistrict={selectedDistrict}
                onSelect={setSelectedDistrict}
                onClear={() => setSelectedDistrict(null)}
              />
            </View>

            {/* Credentials — shown after district selected */}
            {selectedDistrict && (
              <View>
                <Text className="text-sm text-star-dim uppercase tracking-wider mb-1.5">
                  Username
                </Text>
                <TextInput
                  value={icUsername}
                  onChangeText={setIcUsername}
                  placeholder="IC Username"
                  placeholderTextColor="#4A5578"
                  autoCapitalize="none"
                  className="border border-space-border rounded-xl bg-space-mid/60 px-4 text-base text-star-bright mb-4"
                  style={{ height: 52 }}
                />

                <Text className="text-sm text-star-dim uppercase tracking-wider mb-1.5">
                  Password
                </Text>
                <View
                  className="flex-row items-center border border-space-border rounded-xl bg-space-mid/60 px-4 mb-6"
                  style={{ height: 52 }}
                >
                  <TextInput
                    value={icPassword}
                    onChangeText={setIcPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#4A5578"
                    secureTextEntry={!showIcPassword}
                    className="flex-1 text-base text-star-bright"
                  />
                  <TouchableOpacity
                    onPress={() => setShowIcPassword(!showIcPassword)}
                    style={{ padding: 4 }}
                  >
                    {showIcPassword ? (
                      <EyeOff size={18} color="#4A5578" />
                    ) : (
                      <Eye size={18} color="#4A5578" />
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={handleLogin}
                  disabled={icChecking || !canSubmit}
                  className="flex-row items-center justify-center gap-2 rounded-xl bg-vela-400"
                  style={{ height: 52, opacity: icChecking || !canSubmit ? 0.5 : 1 }}
                >
                  {icChecking ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Text className="text-lg font-semibold text-white">Sign In</Text>
                      <ArrowRight size={16} color="white" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
