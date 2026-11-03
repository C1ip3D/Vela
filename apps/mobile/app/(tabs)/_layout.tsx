import { Tabs } from "expo-router";
import { CalendarCheck, LayoutDashboard, Settings } from "lucide-react-native";
import { IcReconnectGate } from "@/components/auth/IcReconnectGate";

export default function TabLayout() {
  return (
    <IcReconnectGate>
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
        name="schedule/index"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color, size }) => (
            <CalendarCheck size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="courses/index"
        options={{ href: null }}
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
      <Tabs.Screen
        name="courses/[courseId]"
        options={{ href: null }}
      />
    </Tabs>
    </IcReconnectGate>
  );
}
