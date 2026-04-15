import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Eye, EyeOff, ArrowRight, School, Compass } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { DistrictSearch, District } from "@/components/forms/DistrictSearch";

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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View className="items-center mb-10">
            <View
              className="w-20 h-20 rounded-3xl bg-vela-400/20 border border-vela-400/30 items-center justify-center mb-4"
            >
              <Compass size={38} color="#818CF8" />
            </View>
            <Text className="text-3xl font-bold text-star-bright tracking-widest">VELA</Text>
            <Text className="text-[11px] text-star-faint tracking-[0.3em] mt-1.5">
              ACADEMIC NAVIGATOR
            </Text>
          </View>

          {/* Card */}
          <View className="rounded-3xl border border-space-border bg-space-surface/60 p-7">
            {/* Card header */}
            <View className="flex-row items-center gap-3.5 mb-6">
              <View className="w-11 h-11 rounded-xl bg-vela-400/15 border border-vela-400/20 items-center justify-center">
                <School size={22} color="#818CF8" />
              </View>
              <View>
                <Text className="text-xl font-semibold text-star-bright">Sign In</Text>
                <Text className="text-sm text-star-dim mt-0.5">
                  Use your Infinite Campus credentials
                </Text>
              </View>
            </View>

            {/* Error */}
            {icError ? (
              <View className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                <Text className="text-sm text-red-400">{icError}</Text>
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
                <Text className="text-xs text-star-dim uppercase tracking-wider mb-1.5">
                  Username
                </Text>
                <TextInput
                  value={icUsername}
                  onChangeText={setIcUsername}
                  placeholder="IC Username"
                  placeholderTextColor="#4A5578"
                  autoCapitalize="none"
                  className="border border-space-border rounded-xl bg-space-mid/60 px-4 text-sm text-star-bright mb-4"
                  style={{ height: 48 }}
                />

                <Text className="text-xs text-star-dim uppercase tracking-wider mb-1.5">
                  Password
                </Text>
                <View
                  className="flex-row items-center border border-space-border rounded-xl bg-space-mid/60 px-4 mb-6"
                  style={{ height: 48 }}
                >
                  <TextInput
                    value={icPassword}
                    onChangeText={setIcPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#4A5578"
                    secureTextEntry={!showIcPassword}
                    className="flex-1 text-sm text-star-bright"
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
                      <Text className="text-base font-semibold text-white">Sign In Securely</Text>
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
