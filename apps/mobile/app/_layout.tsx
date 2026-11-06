import { Text, TextInput } from "react-native";
import { Slot } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/contexts/AuthContext";
import { InfiniteCampusProvider } from "@/contexts/InfiniteCampusContext";
import "../global.css";

// Many styles pair a scaled fontSize with a fixed lineHeight, so unbounded Dynamic Type
// clips glyphs. Cap scaling at ~1.4x (still honours larger text) instead of unlimited.
const MAX_FONT_SCALE = 1.4;
(Text as any).defaultProps = { ...(Text as any).defaultProps, maxFontSizeMultiplier: MAX_FONT_SCALE };
(TextInput as any).defaultProps = { ...(TextInput as any).defaultProps, maxFontSizeMultiplier: MAX_FONT_SCALE };

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <InfiniteCampusProvider>
          <StatusBar style="light" backgroundColor="#03060D" />
          <Slot />
        </InfiniteCampusProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
