import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/contexts/AuthContext";
import { InfiniteCampusProvider } from "@/contexts/InfiniteCampusContext";
import "../global.css";

export default function RootLayout() {
  return (
    <AuthProvider>
      <InfiniteCampusProvider>
        <StatusBar style="light" backgroundColor="#03060D" />
        <Slot />
      </InfiniteCampusProvider>
    </AuthProvider>
  );
}
