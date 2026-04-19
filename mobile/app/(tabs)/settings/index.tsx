import { View } from "react-native";

// This screen is never navigated to — the tab button in _layout.tsx intercepts
// the press and fires the sign-out alert directly without routing here.
export default function SettingsStub() {
  return <View />;
}
