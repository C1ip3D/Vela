import { Slot, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { InfiniteCampusProvider } from "@/contexts/InfiniteCampusContext";
import * as Notifications from "expo-notifications";
import "../global.css";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function NotificationListeners() {
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
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
