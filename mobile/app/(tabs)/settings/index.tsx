import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Settings,
  Bell,
  LogOut,
} from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { SectionLabel } from "@/components/ui/SectionLabel";

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
  const { signOut } = useAuth();

  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);

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
