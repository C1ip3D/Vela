import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Modal,
  FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Settings,
  School,
  Bell,
  LogOut,
  Search,
  MapPin,
  ChevronDown,
  Eye,
  EyeOff,
} from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { api } from "@/lib/api";
import { router } from "expo-router";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

interface NotifPrefs {
  emailEnabled: boolean;
  telegram: boolean;
  gradeAlerts: boolean;
  assignmentAlerts: boolean;
  weeklyDigest: boolean;
  gradeThreshold: number;
}

const DEFAULT_PREFS: NotifPrefs = {
  emailEnabled: false,
  telegram: false,
  gradeAlerts: true,
  assignmentAlerts: true,
  weeklyDigest: false,
  gradeThreshold: 80,
};

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-xs uppercase tracking-[0.2em] text-star-faint mb-3 mt-2">
      {title}
    </Text>
  );
}

function SettingRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between py-3 border-b border-space-border/40">
      <Text className="text-sm text-star-white">{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "#1C2A45", true: "#818CF8" }}
        thumbColor="white"
      />
    </View>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { session, login: icLogin, logout: icLogout, isChecking, loginError } = useIC();

  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [gradeLevel, setGradeLevel] = useState("");

  // IC connect form
  const [icStateCode, setIcStateCode] = useState("CA");
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [districtQuery, setDistrictQuery] = useState("");
  const [districts, setDistricts] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<any | null>(null);
  const [showDistrictList, setShowDistrictList] = useState(false);
  const [icUsername, setIcUsername] = useState("");
  const [icPassword, setIcPassword] = useState("");
  const [showIcPassword, setShowIcPassword] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("vela_notif_prefs").then((raw) => {
      if (raw) {
        try { setNotifPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) }); } catch {}
      }
    });
    AsyncStorage.getItem("vela_student_grade").then((v) => {
      if (v) setGradeLevel(v);
    });
  }, []);

  const savePrefs = async (updated: NotifPrefs) => {
    setNotifPrefs(updated);
    await AsyncStorage.setItem("vela_notif_prefs", JSON.stringify(updated));
  };

  useEffect(() => {
    if (!districtQuery || districtQuery.length < 3 || selectedDistrict) {
      setDistricts([]);
      return;
    }
    if (searchTimeout) clearTimeout(searchTimeout);
    const t = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get(
          `/api/ic/districts?query=${encodeURIComponent(districtQuery)}&state=${icStateCode}`
        );
        setDistricts(res.data?.data || []);
        setShowDistrictList(true);
      } catch {}
      finally { setIsSearching(false); }
    }, 400);
    setSearchTimeout(t);
    return () => clearTimeout(t);
  }, [districtQuery, icStateCode, selectedDistrict]);

  const handleICConnect = async () => {
    if (!selectedDistrict || !icUsername.trim() || !icPassword.trim()) return;
    const url = selectedDistrict.district_baseurl.replace(/\/$/, "");
    const ok = await icLogin(url, icUsername.trim(), icPassword.trim(), selectedDistrict.district_app_name);
    if (ok) {
      setIcUsername("");
      setIcPassword("");
      setDistrictQuery("");
      setSelectedDistrict(null);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-space-void">
      <View className="px-5 pt-5 pb-3 flex-row items-center gap-2">
        <Settings size={18} color="#818CF8" />
        <Text className="text-2xl font-bold text-star-bright">Settings</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Account */}
        <View className="rounded-xl border border-space-border bg-space-surface/50 p-4 mb-5">
          <Text className="text-xs text-star-faint uppercase tracking-wider mb-2">Account</Text>
          <Text className="text-sm font-semibold text-star-bright">
            {user?.displayName || "Student"}
          </Text>
          <Text className="text-xs text-star-faint mt-0.5">{user?.email}</Text>
        </View>

        {/* Infinite Campus */}
        <SectionHeader title="Infinite Campus" />
        <View className="rounded-xl border border-space-border bg-space-surface/50 p-4 mb-5">
          {session ? (
            <View>
              <View className="flex-row items-center gap-2 mb-3">
                <View className="w-2 h-2 rounded-full bg-emerald-400" />
                <Text className="text-sm text-emerald-400 font-medium">Connected</Text>
              </View>
              <Text className="text-sm text-star-white">
                {session.displayName ?? "Student"}
              </Text>
              <Text className="text-xs text-star-faint mt-0.5">{session.baseUrl}</Text>
              <TouchableOpacity
                onPress={icLogout}
                className="mt-3 self-start px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10"
              >
                <Text className="text-xs text-red-400">Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text className="text-sm text-star-dim mb-4">
                Connect your Infinite Campus account to sync grades.
              </Text>

              {loginError && (
                <View className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
                  <Text className="text-xs text-red-400">{loginError}</Text>
                </View>
              )}

              {/* State + District */}
              <View className="flex-row gap-2 mb-3">
                <View style={{ width: 72 }}>
                  <Text className="text-xs text-star-faint mb-1">State</Text>
                  <TouchableOpacity
                    onPress={() => setShowStatePicker(true)}
                    className="flex-row items-center justify-between border border-space-border rounded-lg bg-space-mid/60 px-2.5 py-2.5"
                  >
                    <Text className="text-sm text-star-bright">{icStateCode}</Text>
                    <ChevronDown size={12} color="#4A5578" />
                  </TouchableOpacity>
                </View>

                <View className="flex-1">
                  <Text className="text-xs text-star-faint mb-1">District</Text>
                  <View className="flex-row items-center border border-space-border rounded-lg bg-space-mid/60 px-2">
                    <Search size={13} color="#4A5578" />
                    <TextInput
                      value={districtQuery}
                      onChangeText={(t) => {
                        setDistrictQuery(t);
                        setSelectedDistrict(null);
                      }}
                      placeholder="Search..."
                      placeholderTextColor="#4A5578"
                      className="flex-1 py-2.5 px-1.5 text-sm text-star-bright"
                    />
                    {isSearching && <ActivityIndicator size="small" color="#4A5578" />}
                  </View>
                  {showDistrictList && districts.length > 0 && !selectedDistrict && (
                    <View className="border border-space-border rounded-lg bg-space-mid mt-1 max-h-32">
                      <FlatList
                        data={districts}
                        keyExtractor={(_, i) => i.toString()}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            onPress={() => {
                              setSelectedDistrict(item);
                              setDistrictQuery(item.district_name);
                              setShowDistrictList(false);
                            }}
                            className="px-3 py-2 border-b border-space-border/40"
                          >
                            <Text className="text-xs text-star-bright" numberOfLines={1}>
                              {item.district_name}
                            </Text>
                          </TouchableOpacity>
                        )}
                      />
                    </View>
                  )}
                </View>
              </View>

              {selectedDistrict && (
                <View>
                  <Text className="text-xs text-star-faint mb-1">Username</Text>
                  <TextInput
                    value={icUsername}
                    onChangeText={setIcUsername}
                    placeholder="IC Username"
                    placeholderTextColor="#4A5578"
                    autoCapitalize="none"
                    className="border border-space-border rounded-lg bg-space-mid/60 px-3 py-2.5 text-sm text-star-bright mb-3"
                  />

                  <Text className="text-xs text-star-faint mb-1">Password</Text>
                  <View className="flex-row items-center border border-space-border rounded-lg bg-space-mid/60 px-3 mb-4">
                    <TextInput
                      value={icPassword}
                      onChangeText={setIcPassword}
                      placeholder="••••••••"
                      placeholderTextColor="#4A5578"
                      secureTextEntry={!showIcPassword}
                      className="flex-1 py-2.5 text-sm text-star-bright"
                    />
                    <TouchableOpacity onPress={() => setShowIcPassword(!showIcPassword)}>
                      {showIcPassword ? (
                        <EyeOff size={14} color="#4A5578" />
                      ) : (
                        <Eye size={14} color="#4A5578" />
                      )}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={handleICConnect}
                    disabled={isChecking || !icUsername.trim() || !icPassword.trim()}
                    className="flex-row items-center justify-center gap-2 rounded-lg bg-vela-400 py-2.5"
                    style={{
                      opacity:
                        isChecking || !icUsername.trim() || !icPassword.trim()
                          ? 0.5
                          : 1,
                    }}
                  >
                    {isChecking ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <>
                        <School size={14} color="white" />
                        <Text className="text-sm font-semibold text-white">Connect</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Grade Level */}
        <SectionHeader title="Academic Info" />
        <View className="rounded-xl border border-space-border bg-space-surface/50 p-4 mb-5">
          <Text className="text-xs text-star-faint mb-2">Current Grade Level</Text>
          <View className="flex-row gap-2">
            {["9", "10", "11", "12"].map((g) => (
              <TouchableOpacity
                key={g}
                onPress={async () => {
                  setGradeLevel(g);
                  await AsyncStorage.setItem("vela_student_grade", g);
                }}
                className={`flex-1 py-2 rounded-lg border items-center ${
                  gradeLevel === g
                    ? "border-vela-400 bg-vela-400/20"
                    : "border-space-border bg-space-mid/40"
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    gradeLevel === g ? "text-vela-300" : "text-star-dim"
                  }`}
                >
                  {g}th
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <View className="rounded-xl border border-space-border bg-space-surface/50 px-4 mb-5">
          <SettingRow
            label="Grade Alerts"
            value={notifPrefs.gradeAlerts}
            onToggle={(v) => savePrefs({ ...notifPrefs, gradeAlerts: v })}
          />
          <SettingRow
            label="Assignment Alerts"
            value={notifPrefs.assignmentAlerts}
            onToggle={(v) => savePrefs({ ...notifPrefs, assignmentAlerts: v })}
          />
          <SettingRow
            label="Email Notifications"
            value={notifPrefs.emailEnabled}
            onToggle={(v) => savePrefs({ ...notifPrefs, emailEnabled: v })}
          />
          <SettingRow
            label="Telegram Alerts"
            value={notifPrefs.telegram}
            onToggle={(v) => savePrefs({ ...notifPrefs, telegram: v })}
          />
          <View className="py-3">
            <SettingRow
              label="Weekly Digest"
              value={notifPrefs.weeklyDigest}
              onToggle={(v) => savePrefs({ ...notifPrefs, weeklyDigest: v })}
            />
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          onPress={handleSignOut}
          className="flex-row items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-3"
        >
          <LogOut size={16} color="#F87171" />
          <Text className="text-sm font-medium text-red-400">Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* State Picker Modal */}
      <Modal visible={showStatePicker} transparent animationType="slide">
        <TouchableOpacity
          className="flex-1 bg-black/60"
          onPress={() => setShowStatePicker(false)}
        />
        <View className="bg-space-mid border-t border-space-border" style={{ maxHeight: 280 }}>
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
                className="px-6 py-3 border-b border-space-border/40"
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
