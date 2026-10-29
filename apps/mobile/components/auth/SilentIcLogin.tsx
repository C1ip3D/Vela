import React, { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import WebView from "react-native-webview";
import NitroCookies from "react-native-nitro-cookies";
import { containsIcFailureMarkers } from "@vela/ic-client";
import { icOrigin, type IcLoginResult } from "./IcLoginWebView";

interface SilentIcLoginProps {
  baseUrl: string;
  appName: string;
  // Opt-in saved credentials (see lib/icSession.ts). Without them this can
  // still succeed when the WebView's own cookie store holds a session IC
  // still honours, but an expired one needs them.
  credentials: { username: string; password: string } | null;
  // Confirms a candidate cookie jar really is a live session for the right
  // student. A rejected candidate isn't fatal — the page may simply not
  // have rendered its login form yet — so polling continues.
  verify: (result: IcLoginResult) => Promise<boolean>;
  // null = couldn't sign in without the user (no credentials, wrong
  // password, SSO-only district, timeout).
  onDone: (result: IcLoginResult | null) => void;
}

const SILENT_TIMEOUT_MS = 25000;
const SCAN_INTERVAL_MS = 1000;

// Reports the page state and, the first time IC's own login form is
// showing, fills and submits it with the saved credentials. Only ever
// fills on the district's IC origin — if the login bounces to an SSO
// provider, the saved IC password must never be typed into that page.
// Values are set through the native setter + input/change events so
// framework-managed forms (IC's newer Angular login) see them.
function buildScanScript(origin: string, credentials: SilentIcLoginProps["credentials"], allowFill: boolean) {
  return `
(function () {
  try {
    var onIc = location.origin.toLowerCase() === ${JSON.stringify(origin)};
    var text = document.body ? (document.body.innerText || "") : "";
    var html = document.documentElement ? (document.documentElement.outerHTML || "") : "";
    var pw = document.querySelector('input[type="password"]');
    var hasLoginForm = !!pw || /student username/i.test(text);
    var filled = false;
    var creds = ${allowFill && credentials ? JSON.stringify(credentials) : "null"};
    if (onIc && creds && pw) {
      var form = pw.form || document;
      var user = form.querySelector('input[name="username"], input#username, input[type="email"], input[type="text"]');
      if (user) {
        var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        [[user, creds.username], [pw, creds.password]].forEach(function (pair) {
          setter.call(pair[0], pair[1]);
          pair[0].dispatchEvent(new Event("input", { bubbles: true }));
          pair[0].dispatchEvent(new Event("change", { bubbles: true }));
        });
        var submit = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
        if (submit) submit.click();
        else if (pw.form && pw.form.requestSubmit) pw.form.requestSubmit();
        else if (pw.form) pw.form.submit();
        filled = true;
      }
    }
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: "silent-scan",
      onIc: onIc,
      combined: (text + " " + html).toLowerCase(),
      hasLoginForm: hasLoginForm,
      filled: filled
    }));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "silent-scan", onIc: false, combined: "", hasLoginForm: true, filled: false }));
  }
})();
true;
`;
}

/**
 * Invisible counterpart to IcLoginWebView: loads the district's IC login
 * page off-screen and tries to come out the other side with a fresh session
 * without showing the user anything. Mounted by InfiniteCampusProvider only
 * while a reauth is in flight.
 *
 * Scans the page on an interval rather than only on load, so it copes with
 * login forms rendered after load and with logins submitted via XHR that
 * never trigger another navigation.
 */
export function SilentIcLogin({ baseUrl, appName, credentials, verify, onDone }: SilentIcLoginProps) {
  const base = baseUrl.replace(/\/+$/, "");
  const origin = icOrigin(base);
  const loginUrl = `${base}/portal/students/${appName}.jsp`;

  const webviewRef = useRef<WebView>(null);
  const filledRef = useRef(false);
  const doneRef = useRef(false);
  const checkingRef = useRef(false);
  // Held in refs so a parent re-render (new callback identity) doesn't
  // restart the timers below.
  const onDoneRef = useRef(onDone);
  const verifyRef = useRef(verify);
  onDoneRef.current = onDone;
  verifyRef.current = verify;

  const finish = useCallback((result: IcLoginResult | null) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current(result);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => finish(null), SILENT_TIMEOUT_MS);
    const interval = setInterval(() => {
      if (doneRef.current || checkingRef.current) return;
      webviewRef.current?.injectJavaScript(buildScanScript(origin, credentials, !filledRef.current));
    }, SCAN_INTERVAL_MS);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [finish, origin, credentials]);

  const handleMessage = useCallback(async (event: { nativeEvent: { data: string } }) => {
    if (doneRef.current || checkingRef.current) return;
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload?.type !== "silent-scan") return;

      if (payload.filled) {
        filledRef.current = true;
        return;
      }
      // Bounced to an SSO provider or anywhere else off IC: can't continue
      // without the user.
      if (!payload.onIc) {
        finish(null);
        return;
      }
      if (filledRef.current && containsIcFailureMarkers(payload.combined || "")) {
        finish(null);
        return;
      }
      // Login form showing with nothing (more) to fill in — no saved
      // credentials, or they were already tried. Wait for the next scan
      // in case a submit is still in flight; the timeout ends it otherwise.
      if (payload.hasLoginForm) {
        if (!credentials) finish(null);
        return;
      }

      checkingRef.current = true;
      let cookies = await NitroCookies.getCookieHeader(base, true);
      if (cookies) {
        // Same appName cookie fix-up as IcLoginWebView / loginToIc().
        if (!/(^|;\s*)appName=/.test(cookies)) {
          cookies = `${cookies}; appName=${appName}`;
        }
        const result = { cookies, baseUrl: base, appName };
        if (await verifyRef.current(result)) {
          finish(result);
          return;
        }
      }
      checkingRef.current = false;
    } catch {
      checkingRef.current = false;
    }
  }, [base, appName, credentials, finish]);

  return (
    <View style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} pointerEvents="none">
      <WebView
        ref={webviewRef}
        source={{ uri: loginUrl }}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        onMessage={handleMessage}
        onError={() => finish(null)}
      />
    </View>
  );
}
