import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { RefreshCw } from "lucide-react-native";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { IcLoginWebView, type IcLoginResult } from "./IcLoginWebView";

// Shown in place of the tab screens whenever the stored IC session has
// expired and InfiniteCampusContext.reauth() couldn't silently replace it
// (no saved "Stay signed in" login, it was rejected, or an SSO-only
// district) — the user re-authenticates on IC's own page, but skips
// district search since lastDistrict remembers where they last signed in.
export function IcReconnectGate({ children }: { children: React.ReactNode }) {
  const { isConnected, isInitializing, lastDistrict, completeLogin } = useIC();
  const [showWebView, setShowWebView] = useState(false);

  useEffect(() => {
    if (!isInitializing && !isConnected && !lastDistrict) {
      router.replace("/(auth)/login");
    }
  }, [isInitializing, isConnected, lastDistrict]);

  if (isInitializing || isConnected) {
    return <>{children}</>;
  }

  if (!lastDistrict) {
    return null;
  }

  const handleSuccess = async (result: IcLoginResult) => {
    setShowWebView(false);
    await completeLogin(result, lastDistrict);
  };

  return (
    <SafeAreaView className="flex-1 bg-space-void items-center justify-center px-8">
      <RefreshCw size={32} color="#818CF8" />
      <Text className="text-lg font-semibold text-star-bright mt-4 text-center">
        Your Infinite Campus session expired
      </Text>
      <Text className="text-sm text-star-dim mt-2 text-center">
        Sign back in to {lastDistrict.district_name} to keep viewing your grades.
      </Text>
      <TouchableOpacity
        onPress={() => setShowWebView(true)}
        className="mt-6 rounded-xl bg-vela-400 px-6 py-3"
      >
        <Text className="text-base font-semibold text-white">Reconnect</Text>
      </TouchableOpacity>

      <Modal visible={showWebView} animationType="slide" onRequestClose={() => setShowWebView(false)}>
        <IcLoginWebView
          baseUrl={lastDistrict.district_baseurl}
          appName={lastDistrict.district_app_name}
          districtName={lastDistrict.district_name}
          onSuccess={handleSuccess}
          onCancel={() => setShowWebView(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}
