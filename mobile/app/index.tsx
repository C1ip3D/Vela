import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/contexts/AuthContext";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-space-void">
        <ActivityIndicator color="#818CF8" />
      </View>
    );
  }

  return <Redirect href={user ? "/(tabs)/dashboard" : "/(auth)/login"} />;
}
