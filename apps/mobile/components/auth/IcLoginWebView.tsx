import React, { useCallback, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView, { WebViewNavigation } from "react-native-webview";
import { X } from "lucide-react-native";
import NitroCookies from "react-native-nitro-cookies";
import { isFailedIcRedirectUrl, containsIcFailureMarkers } from "@vela/ic-client";

export interface IcLoginResult {
  cookies: string;
  baseUrl: string;
  appName: string;
}

interface IcLoginWebViewProps {
  baseUrl: string;
  appName: string;
  districtName: string;
  onSuccess: (result: IcLoginResult) => void;
  onCancel: () => void;
}

// Scans the loaded page for the same failure markers loginToIc() checks
// server-side (see packages/ic-client/src/loginSignals.ts), since we no
// longer see IC's raw HTTP response — only what the WebView renders.
// Also reports whether a login form is still present: a fresh anti-CSRF
// session cookie can rotate even on a *failed* login attempt (IC reloads
// the same login page), so "a new cookie appeared" alone is not a
// reliable success signal — the login form actually being gone is.
const PAGE_SCAN_SCRIPT = `
(function () {
  try {
    var text = document.body ? (document.body.innerText || "") : "";
    var html = document.documentElement ? (document.documentElement.outerHTML || "") : "";
    var hasLoginForm = !!document.querySelector('input[type="password"]') || /student username/i.test(text);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "page-scan", combined: (text + " " + html).toLowerCase(), hasLoginForm: hasLoginForm }));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "page-scan", combined: "", hasLoginForm: true }));
  }
  true;
})();
`;

const STUCK_TIMEOUT_MS = 20000;
const COOKIE_POLL_ATTEMPTS = 4;
const COOKIE_POLL_DELAY_MS = 400;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function IcLoginWebView({ baseUrl, appName, districtName, onSuccess, onCancel }: IcLoginWebViewProps) {
  const base = baseUrl.replace(/\/+$/, "");
  const loginUrl = `${base}/portal/students/${appName}.jsp`;

  const webviewRef = useRef<WebView>(null);
  const submittedRef = useRef(false);
  const resolvingRef = useRef(false);
  const initialCookieNamesRef = useRef<Set<string> | null>(null);
  const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const clearStuckTimer = () => {
    if (stuckTimerRef.current) {
      clearTimeout(stuckTimerRef.current);
      stuckTimerRef.current = null;
    }
  };

  const armStuckTimer = () => {
    clearStuckTimer();
    stuckTimerRef.current = setTimeout(() => setShowManualFallback(true), STUCK_TIMEOUT_MS);
  };

  const extractAndFinish = useCallback(async () => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    setIsResolving(true);
    clearStuckTimer();
    try {
      let cookies = await NitroCookies.getCookieHeader(base, true);
      for (let i = 0; i < COOKIE_POLL_ATTEMPTS && !cookies; i++) {
        await sleep(COOKIE_POLL_DELAY_MS);
        cookies = await NitroCookies.getCookieHeader(base, true);
      }
      if (!cookies) {
        throw new Error("Authenticated but could not read the session cookie.");
      }
      // Mirrors loginToIc()'s server-side step: IC needs an explicit
      // appName cookie or later API calls fail with a "conflicting app
      // name values" error.
      if (!/(^|;\s*)appName=/.test(cookies)) {
        cookies = `${cookies}; appName=${appName}`;
      }
      onSuccess({ cookies, baseUrl: base, appName });
    } catch (e: unknown) {
      setIsResolving(false);
      resolvingRef.current = false;
      setError(e instanceof Error ? e.message : "Could not complete sign-in. Please try again.");
    }
  }, [base, appName, onSuccess]);

  const checkForNewCookies = useCallback(async () => {
    if (resolvingRef.current) return;
    const current = await NitroCookies.get(base, true);
    const currentNames = new Set(Object.keys(current));
    const initial = initialCookieNamesRef.current ?? new Set<string>();
    const hasNewCookie = [...currentNames].some((name) => !initial.has(name));
    if (hasNewCookie) {
      await extractAndFinish();
    }
  }, [base, extractAndFinish]);

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    if (navState.loading) return;
    const url = navState.url || "";

    if (!submittedRef.current && url.toLowerCase().includes("verify.jsp")) {
      submittedRef.current = true;
      armStuckTimer();
      return;
    }

    if (!submittedRef.current) return;

    // A bounce back to a failure-shaped URL after we've already submitted
    // once (as opposed to the initial, expected load) means bad credentials.
    if (isFailedIcRedirectUrl(url) && url.toLowerCase() !== loginUrl.toLowerCase()) {
      setError("Invalid username or password. Please try again.");
      submittedRef.current = false;
      clearStuckTimer();
    }
    // Otherwise wait for the page-scan message (handleMessage) to decide —
    // it has the DOM signal the cookie check alone can't provide.
  }, [loginUrl]);

  const handleLoadEnd = useCallback(() => {
    webviewRef.current?.injectJavaScript(PAGE_SCAN_SCRIPT);
  }, []);

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload?.type !== "page-scan" || !submittedRef.current) return;

      if (containsIcFailureMarkers(payload.combined || "")) {
        setError("Invalid username or password. Please try again.");
        submittedRef.current = false;
        clearStuckTimer();
        return;
      }

      // A fresh anti-CSRF/session cookie can rotate even on a failed
      // attempt (IC reloads the same login page), so only trust "new
      // cookie" as success once the login form itself is confirmed gone.
      if (!payload.hasLoginForm) {
        checkForNewCookies();
      }
    } catch {
      // ignore malformed messages
    }
  }, [checkForNewCookies]);

  const handleInitialLoadEnd = useCallback(async () => {
    if (initialCookieNamesRef.current) return;
    const initial = await NitroCookies.get(base, true);
    initialCookieNamesRef.current = new Set(Object.keys(initial));
  }, [base]);

  return (
    <SafeAreaView className="flex-1 bg-space-void">
      <View className="flex-row items-center justify-between px-5 py-3 border-b border-space-border">
        <View style={{ flex: 1 }}>
          <Text className="text-base font-semibold text-star-bright" numberOfLines={1}>
            {districtName}
          </Text>
          <Text className="text-xs text-star-dim">Sign in with Infinite Campus</Text>
        </View>
        <TouchableOpacity onPress={onCancel} style={{ padding: 8 }}>
          <X size={20} color="#8B98B8" />
        </TouchableOpacity>
      </View>

      {error && (
        <View className="mx-5 mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <Text className="text-sm text-red-400">{error}</Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <WebView
          ref={webviewRef}
          source={{ uri: loginUrl }}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          onNavigationStateChange={handleNavigationStateChange}
          onLoadEnd={() => {
            handleInitialLoadEnd();
            handleLoadEnd();
          }}
          onMessage={handleMessage}
          startInLoadingState
          renderLoading={() => (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color="#818CF8" size="large" />
            </View>
          )}
        />

        {isResolving && (
          <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(3,6,13,0.85)" }}>
            <ActivityIndicator color="#818CF8" size="large" />
            <Text className="text-sm text-star-dim mt-3">Finishing sign-in…</Text>
          </View>
        )}
      </View>

      {showManualFallback && !isResolving && (
        <View className="px-5 py-4 border-t border-space-border">
          <Text className="text-xs text-star-dim mb-2">
            Already signed in on the page above? Tap below to continue.
          </Text>
          <TouchableOpacity
            onPress={extractAndFinish}
            className="rounded-xl bg-vela-400 py-3 items-center"
          >
            <Text className="text-sm font-semibold text-white">I&apos;m signed in</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
