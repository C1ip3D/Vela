import { Tabs } from "expo-router";
import { LayoutDashboard, Compass, Settings } from "lucide-react-native";

export default function TabLayout() {
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
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
      {/* Hide course detail from tab bar */}
      <Tabs.Screen
        name="courses/[courseId]"
        options={{ href: null }}
      />
    </Tabs>
  );
}
