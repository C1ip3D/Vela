import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Eye, EyeOff, ArrowRight, School, Search, MapPin, Compass } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { api } from "@/lib/api";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export default function LoginScreen() {
  const { signIn, signUp, user } = useAuth();
  const { login: icLogin, isChecking: icChecking, loginError: icError } = useIC();

  const [icStateCode, setIcStateCode] = useState("CA");
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [districtQuery, setDistrictQuery] = useState("");
  const [districts, setDistricts] = useState<any[]>([]);
  const [isSearchingDistrict, setIsSearchingDistrict] = useState(false);
  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedDistrict, setSelectedDistrict] = useState<any | null>(null);
  const [icUsername, setIcUsername] = useState("");
  const [icPassword, setIcPassword] = useState("");
  const [showIcPassword, setShowIcPassword] = useState(false);

  useEffect(() => {
    if (user) router.replace("/(tabs)/dashboard");
  }, [user]);

  useEffect(() => {
    if (!districtQuery || districtQuery.length < 3 || selectedDistrict) {
      setDistricts([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setIsSearchingDistrict(true);
      try {
        const res = await api.get(
          `/api/ic/districts?query=${encodeURIComponent(districtQuery)}&state=${icStateCode}`
        );
        setDistricts(res.data?.data || []);
        setShowDistrictDropdown(true);
      } catch {
        // silent
      } finally {
        setIsSearchingDistrict(false);
      }
    }, 400);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [districtQuery, icStateCode, selectedDistrict]);

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

    // Shadow Firebase account for platform auth
    try {
      const hostname = new URL(url).hostname;
      const pseudoEmail = `${icUsername.toLowerCase()}@${hostname}.ic.vela.app`;
      const pseudoPassword = `VelaIC#${btoa(pseudoEmail).substring(0, 16)}`;
      try {
        await signIn(pseudoEmail, pseudoPassword);
      } catch (e: any) {
        if (
          e.code === "auth/invalid-credential" ||
          e.code === "auth/user-not-found"
        ) {
          await signUp(pseudoEmail, pseudoPassword, icUsername);
        } else throw e;
      }
      router.replace("/(tabs)/dashboard");
    } catch (e) {
      console.error("Shadow account error:", e);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-space-void">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View className="items-center mb-10">
            <View className="w-14 h-14 rounded-2xl bg-vela-400/20 border border-vela-400/30 items-center justify-center mb-3">
              <Compass size={28} color="#818CF8" />
            </View>
            <Text className="text-2xl font-bold text-star-bright tracking-widest">VELA</Text>
            <Text className="text-xs text-star-faint tracking-[0.2em] mt-0.5">ACADEMIC NAVIGATOR</Text>
          </View>

          <View className="rounded-2xl border border-space-border bg-space-surface/60 p-6">
            <View className="flex-row items-center gap-3 mb-5">
              <View className="w-10 h-10 rounded-xl bg-vela-400/15 border border-vela-400/20 items-center justify-center">
                <School size={20} color="#818CF8" />
              </View>
              <View>
                <Text className="text-xl font-semibold text-star-bright">Sign In</Text>
                <Text className="text-sm text-star-dim">Use your Infinite Campus credentials</Text>
              </View>
            </View>

            {icError ? (
              <View className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5">
                <Text className="text-sm text-red-400">{icError}</Text>
              </View>
            ) : null}

            {/* State + District row */}
            <View className="flex-row gap-3 mb-4">
              {/* State picker */}
              <View style={{ width: 80 }}>
                <Text className="text-xs text-star-dim uppercase tracking-wider mb-1.5">State</Text>
                <TouchableOpacity
                  onPress={() => setShowStatePicker(true)}
                  className="flex-row items-center justify-between border border-space-border rounded-lg bg-space-mid/60 px-3 py-3"
                >
                  <Text className="text-sm text-star-bright">{icStateCode}</Text>
                  <MapPin size={12} color="#4A5578" />
                </TouchableOpacity>
              </View>

              {/* District search */}
              <View className="flex-1">
                <Text className="text-xs text-star-dim uppercase tracking-wider mb-1.5">District</Text>
                <View className="flex-row items-center border border-space-border rounded-lg bg-space-mid/60 px-3">
                  <Search size={14} color="#4A5578" />
                  <TextInput
                    value={districtQuery}
                    onChangeText={(t) => {
                      setDistrictQuery(t);
                      setSelectedDistrict(null);
                    }}
                    placeholder="Search district..."
                    placeholderTextColor="#4A5578"
                    className="flex-1 py-3 px-2 text-sm text-star-bright"
                  />
                  {isSearchingDistrict && (
                    <ActivityIndicator size="small" color="#4A5578" />
                  )}
                </View>

                {showDistrictDropdown && districts.length > 0 && !selectedDistrict && (
                  <View className="border border-space-border rounded-lg bg-space-mid mt-1 max-h-40 overflow-hidden">
                    <FlatList
                      data={districts}
                      keyExtractor={(_, i) => i.toString()}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedDistrict(item);
                            setDistrictQuery(item.district_name);
                            setShowDistrictDropdown(false);
                          }}
                          className="px-4 py-2.5 border-b border-space-border/50"
                        >
                          <Text className="text-sm text-star-bright" numberOfLines={1}>
                            {item.district_name}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                )}
              </View>
            </View>

            {/* Credentials — shown after district selected */}
            {selectedDistrict && (
              <View>
                <Text className="text-xs text-star-dim uppercase tracking-wider mb-1.5">Username</Text>
                <TextInput
                  value={icUsername}
                  onChangeText={setIcUsername}
                  placeholder="IC Username"
                  placeholderTextColor="#4A5578"
                  autoCapitalize="none"
                  className="border border-space-border rounded-lg bg-space-mid/60 px-4 py-3 text-sm text-star-bright mb-4"
                />

                <Text className="text-xs text-star-dim uppercase tracking-wider mb-1.5">Password</Text>
                <View className="flex-row items-center border border-space-border rounded-lg bg-space-mid/60 px-3 mb-5">
                  <TextInput
                    value={icPassword}
                    onChangeText={setIcPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#4A5578"
                    secureTextEntry={!showIcPassword}
                    className="flex-1 py-3 text-sm text-star-bright"
                  />
                  <TouchableOpacity onPress={() => setShowIcPassword(!showIcPassword)}>
                    {showIcPassword ? (
                      <EyeOff size={16} color="#4A5578" />
                    ) : (
                      <Eye size={16} color="#4A5578" />
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={handleLogin}
                  disabled={icChecking || !icUsername.trim() || !icPassword.trim()}
                  className="flex-row items-center justify-center gap-2 rounded-lg bg-vela-400 py-3"
                  style={{
                    opacity:
                      icChecking || !icUsername.trim() || !icPassword.trim()
                        ? 0.5
                        : 1,
                  }}
                >
                  {icChecking ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Text className="text-sm font-semibold text-white">Sign In Securely</Text>
                      <ArrowRight size={14} color="white" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* State Picker Modal */}
      <Modal visible={showStatePicker} transparent animationType="slide">
        <TouchableOpacity
          className="flex-1 bg-black/60"
          onPress={() => setShowStatePicker(false)}
        />
        <View className="bg-space-mid border-t border-space-border" style={{ maxHeight: 300 }}>
          <FlatList
            data={US_STATES}
            keyExtractor={(s) => s}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  setIcStateCode(item);
                  setSelectedDistrict(null);
                  setShowStatePicker(false);
                }}
                className="px-6 py-3.5 border-b border-space-border/50"
              >
                <Text
                  className={`text-sm ${item === icStateCode ? "text-vela-300 font-semibold" : "text-star-white"}`}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}
