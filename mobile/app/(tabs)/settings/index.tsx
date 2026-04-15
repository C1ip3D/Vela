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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Settings,
  School,
  Bell,
  LogOut,
  Eye,
  EyeOff,
} from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { api } from "@/lib/api";
import { router } from "expo-router";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { DistrictSearch, District } from "@/components/forms/DistrictSearch";

interface NotifPrefs {
  gradeAlerts: boolean;
  assignmentAlerts: boolean;
  gradeThreshold: number;
}

const DEFAULT_PREFS: NotifPrefs = {
  gradeAlerts: true,
  assignmentAlerts: true,
  gradeThreshold: 80,
};

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
    <View className="flex-row items-center justify-between py-3.5 border-b border-space-border/40">
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

  // IC connect form
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [icUsername, setIcUsername] = useState("");
  const [icPassword, setIcPassword] = useState("");
  const [showIcPassword, setShowIcPassword] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("vela_notif_prefs").then((raw) => {
      if (raw) {
        try {
          setNotifPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
        } catch {}
      }
    });
  }, []);

  const savePrefs = async (updated: NotifPrefs) => {
    setNotifPrefs(updated);
    await AsyncStorage.setItem("vela_notif_prefs", JSON.stringify(updated));
  };

  const handleICConnect = async () => {
    if (!selectedDistrict || !icUsername.trim() || !icPassword.trim()) return;
    const url = selectedDistrict.district_baseurl.replace(/\/$/, "");
    const ok = await icLogin(
      url,
      icUsername.trim(),
      icPassword.trim(),
      selectedDistrict.district_app_name
    );
    if (ok) {
      setIcUsername("");
      setIcPassword("");
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

  // Avatar initials
  const displayName = user?.displayName || "Student";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((n: string) => n[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <SafeAreaView className="flex-1 bg-space-void">
      {/* Header */}
      <View className="px-5 pt-5 pb-4 flex-row items-center gap-2.5" style={{ borderBottomWidth: 1, borderBottomColor: "#1C2A45" }}>
        <Settings size={20} color="#818CF8" />
        <Text className="text-2xl font-bold text-star-bright">Settings</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingTop: 16, paddingBottom: 64 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Account */}
        <SectionLabel title="Account" />
        <View className="rounded-2xl border border-space-border bg-space-surface/50 p-4 mb-6 flex-row items-center gap-4">
          {/* Avatar */}
          <View
            className="w-12 h-12 rounded-2xl bg-vela-400/20 border border-vela-400/30 items-center justify-center"
          >
            <Text className="text-base font-bold text-vela-300">{initials}</Text>
          </View>
          <View>
            <Text className="text-base font-semibold text-star-bright">{displayName}</Text>
            <Text className="text-xs text-star-faint mt-0.5">{user?.email}</Text>
          </View>
        </View>

        {/* Infinite Campus */}
        <SectionLabel title="Infinite Campus" />
        <View className="rounded-2xl border border-space-border bg-space-surface/50 p-4 mb-6">
          {session ? (
            <View>
              <View className="flex-row items-center gap-2 mb-3">
                <View className="w-2 h-2 rounded-full bg-emerald-400" />
                <Text className="text-sm text-emerald-400 font-medium">Connected</Text>
              </View>
              <Text className="text-sm font-medium text-star-white">
                {session.displayName ?? "Student"}
              </Text>
              <Text className="text-xs text-star-faint mt-1">{session.baseUrl}</Text>
              <TouchableOpacity
                onPress={icLogout}
                className="mt-4 self-start rounded-xl border border-red-500/30 bg-red-500/10"
                style={{ paddingHorizontal: 14, paddingVertical: 8 }}
              >
                <Text className="text-xs text-red-400 font-medium">Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text className="text-sm text-star-dim mb-4 leading-5">
                Connect your Infinite Campus account to sync grades.
              </Text>

              {loginError && (
                <View className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5">
                  <Text className="text-xs text-red-400">{loginError}</Text>
                </View>
              )}

              {/* District search */}
              <View className="mb-4">
                <DistrictSearch
                  selectedDistrict={selectedDistrict}
                  onSelect={setSelectedDistrict}
                  onClear={() => setSelectedDistrict(null)}
                  compact
                />
              </View>

              {selectedDistrict && (
                <View>
                  <Text className="text-xs text-star-faint mb-1.5">Username</Text>
                  <TextInput
                    value={icUsername}
                    onChangeText={setIcUsername}
                    placeholder="IC Username"
                    placeholderTextColor="#4A5578"
                    autoCapitalize="none"
                    className="border border-space-border rounded-xl bg-space-mid/60 px-3 text-sm text-star-bright mb-3"
                    style={{ height: 46 }}
                  />

                  <Text className="text-xs text-star-faint mb-1.5">Password</Text>
                  <View
                    className="flex-row items-center border border-space-border rounded-xl bg-space-mid/60 px-3 mb-4"
                    style={{ height: 46 }}
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
                        <EyeOff size={16} color="#4A5578" />
                      ) : (
                        <Eye size={16} color="#4A5578" />
                      )}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={handleICConnect}
                    disabled={isChecking || !icUsername.trim() || !icPassword.trim()}
                    className="flex-row items-center justify-center gap-2 rounded-xl bg-vela-400"
                    style={{
                      height: 48,
                      opacity:
                        isChecking || !icUsername.trim() || !icPassword.trim() ? 0.5 : 1,
                    }}
                  >
                    {isChecking ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <>
                        <School size={15} color="white" />
                        <Text className="text-sm font-semibold text-white">Connect</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Notifications */}
        <SectionLabel title="Notifications" />
        <View className="rounded-2xl border border-space-border bg-space-surface/50 px-4 mb-6">
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
        </View>

        {/* Sign out */}
        <TouchableOpacity
          onPress={handleSignOut}
          className="flex-row items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10"
          style={{ height: 52 }}
        >
          <LogOut size={16} color="#F87171" />
          <Text className="text-sm font-medium text-red-400">Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
