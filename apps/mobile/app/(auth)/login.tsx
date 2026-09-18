import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  Dimensions,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useIC, type ICSession } from "@/contexts/InfiniteCampusContext";
import { DistrictSearch, District } from "@/components/forms/DistrictSearch";
import { IcLoginWebView, type IcLoginResult } from "@/components/auth/IcLoginWebView";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const STARS = [
  // top band
  { x: 0.04, y: 0.02, size: 2,   delay: 0 },
  { x: 0.13, y: 0.06, size: 3,   delay: 400 },
  { x: 0.22, y: 0.03, size: 1.5, delay: 800 },
  { x: 0.31, y: 0.09, size: 2.5, delay: 200 },
  { x: 0.40, y: 0.01, size: 2,   delay: 1200 },
  { x: 0.50, y: 0.07, size: 3,   delay: 600 },
  { x: 0.59, y: 0.04, size: 1.5, delay: 1000 },
  { x: 0.68, y: 0.10, size: 2,   delay: 300 },
  { x: 0.77, y: 0.03, size: 2.5, delay: 900 },
  { x: 0.86, y: 0.08, size: 2,   delay: 1400 },
  { x: 0.94, y: 0.02, size: 1.5, delay: 700 },
  // upper-mid band
  { x: 0.07, y: 0.15, size: 2.5, delay: 100 },
  { x: 0.18, y: 0.20, size: 2,   delay: 1600 },
  { x: 0.27, y: 0.17, size: 3,   delay: 500 },
  { x: 0.38, y: 0.23, size: 1.5, delay: 1100 },
  { x: 0.47, y: 0.18, size: 2,   delay: 1800 },
  { x: 0.56, y: 0.25, size: 2.5, delay: 250 },
  { x: 0.64, y: 0.14, size: 2,   delay: 1300 },
  { x: 0.73, y: 0.22, size: 3,   delay: 750 },
  { x: 0.83, y: 0.16, size: 1.5, delay: 1700 },
  { x: 0.92, y: 0.26, size: 2,   delay: 350 },
  // mid band
  { x: 0.03, y: 0.35, size: 3,   delay: 950 },
  { x: 0.12, y: 0.40, size: 2,   delay: 550 },
  { x: 0.24, y: 0.33, size: 2.5, delay: 1450 },
  { x: 0.34, y: 0.42, size: 2,   delay: 650 },
  { x: 0.44, y: 0.37, size: 1.5, delay: 1150 },
  { x: 0.53, y: 0.45, size: 3,   delay: 450 },
  { x: 0.62, y: 0.38, size: 2,   delay: 1250 },
  { x: 0.71, y: 0.44, size: 2.5, delay: 850 },
  { x: 0.80, y: 0.36, size: 2,   delay: 1550 },
  { x: 0.90, y: 0.43, size: 1.5, delay: 150 },
  // lower-mid band
  { x: 0.06, y: 0.55, size: 2,   delay: 1050 },
  { x: 0.16, y: 0.60, size: 3,   delay: 350 },
  { x: 0.26, y: 0.53, size: 1.5, delay: 1350 },
  { x: 0.37, y: 0.62, size: 2.5, delay: 750 },
  { x: 0.48, y: 0.56, size: 2,   delay: 1650 },
  { x: 0.57, y: 0.63, size: 2,   delay: 550 },
  { x: 0.66, y: 0.57, size: 3,   delay: 1250 },
  { x: 0.76, y: 0.64, size: 1.5, delay: 450 },
  { x: 0.85, y: 0.58, size: 2,   delay: 1750 },
  { x: 0.93, y: 0.66, size: 2.5, delay: 950 },
  // bottom band
  { x: 0.09, y: 0.73, size: 2,   delay: 650 },
  { x: 0.20, y: 0.78, size: 3,   delay: 1150 },
  { x: 0.30, y: 0.72, size: 2.5, delay: 250 },
  { x: 0.41, y: 0.80, size: 2,   delay: 1550 },
  { x: 0.52, y: 0.75, size: 1.5, delay: 850 },
  { x: 0.61, y: 0.82, size: 2,   delay: 1050 },
  { x: 0.70, y: 0.76, size: 3,   delay: 350 },
  { x: 0.79, y: 0.84, size: 2,   delay: 1450 },
  { x: 0.88, y: 0.79, size: 2.5, delay: 750 },
  { x: 0.96, y: 0.87, size: 2,   delay: 1850 },
  { x: 0.15, y: 0.90, size: 1.5, delay: 550 },
  { x: 0.35, y: 0.93, size: 2,   delay: 1650 },
  { x: 0.55, y: 0.91, size: 2.5, delay: 450 },
  { x: 0.75, y: 0.95, size: 2,   delay: 1250 },
  { x: 0.92, y: 0.96, size: 3,   delay: 950 },
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
        shadowColor: "#A5B4FC",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: size * 2,
      }}
    />
  );
}

export default function LoginScreen() {
  const { signIn, signUp, user } = useAuth();
  const { completeLogin, isChecking: icChecking, loginError: icError } = useIC();

  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [showWebView, setShowWebView] = useState(false);

  useEffect(() => {
    if (user) router.replace("/(tabs)/dashboard");
  }, [user]);

  const finishFirebaseSignIn = async (session: ICSession, baseUrl: string) => {
    try {
      const hostname = new URL(baseUrl).hostname;
      // personId (not the IC username, which Vela never sees with the
      // WebView flow) anchors the pseudo-account — stable per student and
      // resolved right after IC login in completeLogin().
      const pseudoEmail = `${session.personId}@${hostname}.ic.vela.app`;
      const pseudoPassword = `VelaIC#${btoa(pseudoEmail).substring(0, 16)}`;
      try {
        await signIn(pseudoEmail, pseudoPassword);
      } catch (e: any) {
        if (e.code === "auth/invalid-credential" || e.code === "auth/user-not-found") {
          await signUp(pseudoEmail, pseudoPassword, session.displayName || selectedDistrict?.district_name || "Vela Student");
        } else throw e;
      }
      router.replace("/(tabs)/dashboard");
    } catch (e) {
      console.error("Shadow account error:", e);
    }
  };

  const handleWebViewSuccess = async (result: IcLoginResult) => {
    if (!selectedDistrict) return;
    setShowWebView(false);
    const session = await completeLogin(result, {
      district_name: selectedDistrict.district_name,
      district_baseurl: selectedDistrict.district_baseurl,
      district_app_name: selectedDistrict.district_app_name,
    });
    if (!session) return;
    await finishFirebaseSignIn(session, result.baseUrl);
  };

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
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, alignItems: "center", paddingHorizontal: 28, paddingTop: 72, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo + title — centered at top */}
          <View style={{ alignItems: "center", width: "100%", marginBottom: 40 }}>
            <Image
              source={require("@/assets/logo.png")}
              style={{ width: 160, height: 160 }}
              resizeMode="contain"
            />
            <Text style={{ fontSize: 42, fontWeight: "800", letterSpacing: 8, color: "#F0F4FF", marginTop: 8 }}>VELA</Text>
            <Text className="text-[12px] text-star-faint tracking-[0.35em] mt-2">
              ACADEMIC NAVIGATOR
            </Text>
          </View>

          {/* Card — centered, wider */}
          <View style={{ width: "100%", maxWidth: 480 }} className="rounded-3xl border border-space-border bg-space-surface/60 p-8">

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

            {/* Continue to IC's own login page — shown after district selected */}
            {selectedDistrict && (
              <View>
                <Text className="text-sm text-star-dim mb-4">
                  You&apos;ll sign in directly on {selectedDistrict.district_name}&apos;s Infinite Campus page. Vela never sees your password.
                </Text>
                <TouchableOpacity
                  onPress={() => setShowWebView(true)}
                  disabled={icChecking}
                  className="flex-row items-center justify-center gap-2 rounded-xl bg-vela-400"
                  style={{ height: 52, opacity: icChecking ? 0.5 : 1 }}
                >
                  {icChecking ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Text className="text-lg font-semibold text-white">Continue to Infinite Campus</Text>
                      <ArrowRight size={16} color="white" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {selectedDistrict && (
        <Modal visible={showWebView} animationType="slide" onRequestClose={() => setShowWebView(false)}>
          <IcLoginWebView
            baseUrl={selectedDistrict.district_baseurl}
            appName={selectedDistrict.district_app_name}
            districtName={selectedDistrict.district_name}
            onSuccess={handleWebViewSuccess}
            onCancel={() => setShowWebView(false)}
          />
        </Modal>
      )}
    </SafeAreaView>
  );
}
