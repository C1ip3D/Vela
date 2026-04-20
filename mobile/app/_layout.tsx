import { Slot, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { NativeModules } from "react-native";
import { AuthProvider } from "@/contexts/AuthContext";
import { InfiniteCampusProvider } from "@/contexts/InfiniteCampusContext";
import "../global.css";

// Check native module registry directly — most reliable way to detect Expo Go
const hasPushSupport = !!NativeModules.ExpoPushTokenManager;

if (hasPushSupport) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Notifications = require("expo-notifications") as typeof import("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function NotificationListeners() {
  const responseListener = useRef<any>();

  useEffect(() => {
    if (!hasPushSupport) return;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require("expo-notifications") as typeof import("expo-notifications");
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      router.push("/(tabs)/courses");
    });
    return () => responseListener.current?.remove();
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <InfiniteCampusProvider>
        <StatusBar style="light" backgroundColor="#03060D" />
        <NotificationListeners />
        <Slot />
      </InfiniteCampusProvider>
    </AuthProvider>
  );
}
