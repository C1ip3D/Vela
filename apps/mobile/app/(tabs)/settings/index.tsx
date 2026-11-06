import { View, Text, TouchableOpacity, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LogOut } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { BellTimesSettings } from "@/components/schedule/BellTimesSettings";

export default function SettingsScreen() {
  const { signOut } = useAuth();

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
    <SafeAreaView edges={["top"]} className="flex-1 bg-space-void">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text className="text-star-bright" style={{ fontSize: 28, fontWeight: "600", marginBottom: 24 }}>
          Settings
        </Text>
        <BellTimesSettings />
        <TouchableOpacity
          onPress={handleSignOut}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          className="flex-row items-center rounded-2xl border border-space-border bg-space-surface/50"
          style={{ padding: 18, minHeight: 56, gap: 12 }}
        >
          <LogOut size={20} color="#F87171" />
          <Text style={{ fontSize: 17, color: "#F87171" }}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
