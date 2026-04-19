import { Tabs } from "expo-router";
import { TouchableOpacity, Alert } from "react-native";
import { LayoutDashboard, Compass, LogOut } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";

export default function TabLayout() {
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
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#070B16",
          borderTopColor: "#1C2A45",
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#A5B4FC",
        tabBarInactiveTintColor: "#4A5578",
        tabBarLabelStyle: {
          fontSize: 11.5,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard/index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="courses/index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="advisor/index"
        options={{
          title: "Kepler",
          tabBarIcon: ({ color, size }) => (
            <Compass size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: "Sign Out",
          tabBarIcon: ({ color, size }) => (
            <LogOut size={size} color={color} />
          ),
          tabBarButton: (props) => (
            <TouchableOpacity
              {...props}
              onPress={handleSignOut}
              activeOpacity={0.7}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="courses/[courseId]"
        options={{ href: null }}
      />
    </Tabs>
  );
}
