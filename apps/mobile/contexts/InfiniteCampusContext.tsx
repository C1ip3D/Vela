import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { AppState } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { fetchPersonInfo } from "@vela/ic-client";
import NitroCookies from "react-native-nitro-cookies";
import { auth } from "@/lib/firebase";
import { isIcReachable, probeIcAuth, withTimeout } from "@/lib/icApi";
import { SilentIcLogin } from "@/components/auth/SilentIcLogin";
import type { IcLoginResult } from "@/components/auth/IcLoginWebView";
import {
  getStoredIcSession,
  saveStoredIcSession,
  clearStoredIcSession,
  toIcSession,
  getLastIcDistrict,
  saveLastIcDistrict,
  clearLastIcDistrict,
  getStoredIcCredentials,
  saveStoredIcCredentials,
  clearStoredIcCredentials,
  type StoredIcSession,
  type StoredIcDistrict,
} from "@/lib/icSession";

export type ICSession = StoredIcSession;

type WebViewLoginResult = IcLoginResult;

// Signs the device out of IC as well: the login WebView (WebKit store) and
// native fetch (shared store) would otherwise stay signed into the previous
// student's IC account, and the next person to tap "Continue to Infinite
// Campus" would land in it.
const clearIcCookies = () =>
  Promise.all([NitroCookies.clearAll(true), NitroCookies.clearAll()]).catch(() => {});

const icBase = (url: string) => url.replace(/\/+$/, "").toLowerCase();

// While the app is in the foreground, re-check the IC session this often so
// IC's idle timeout rarely gets a chance to expire it, and so an expired one
// is silently replaced before the user pulls to refresh.
const KEEPALIVE_INTERVAL_MS = 10 * 60 * 1000;
const PERSON_CHECK_TIMEOUT_MS = 10000;
// Upper bound on one reauth attempt (person check + probe + silent login),
// so a hung request can't block every later reauth behind the in-flight one.
const REAUTH_TIMEOUT_MS = 45000;

interface ICContextType {
  session: ICSession | null;
  lastDistrict: StoredIcDistrict | null;
  isConnected: boolean;
  isInitializing: boolean;
  isChecking: boolean;
  // Called once the mobile WebView login screen has established an IC
  // session on the user's behalf (see components/auth/IcLoginWebView.tsx).
  // `resolvedPerson` lets a caller that already resolved personId/displayName
  // server-side (see app/(auth)/login.tsx's call to /api/ic/mint-token) skip
  // this function's own fetchPersonInfo call rather than redundantly
  // repeating it. `result.credentials` is only set when the user left
  // "Stay signed in" on; they stay in this device's Keychain.
  completeLogin: (
    result: WebViewLoginResult,
    district: StoredIcDistrict,
    resolvedPerson?: { personId: string; displayName: string | null }
  ) => Promise<ICSession | null>;
  logout: () => void;
  // Confirms the existing session is still valid and, if not, tries to
  // establish a new one without the user via an off-screen IC login
  // (SilentIcLogin) using the opt-in saved credentials. Returns null when
  // that isn't possible. The session is only cleared (sending the user to
  // IcReconnectGate) when IC clearly says it has expired — never for being
  // offline, a timeout or a server error. Concurrent callers share one
  // attempt.
  reauth: () => Promise<ICSession | null>;
  loginError: string | null;
}

const ICContext = createContext<ICContextType>({} as ICContextType);

export function useIC() {
  return useContext(ICContext);
}

interface SilentJob {
  district: StoredIcDistrict;
  credentials: { username: string; password: string } | null;
  verify: (result: WebViewLoginResult) => Promise<boolean>;
  resolve: (result: WebViewLoginResult | null) => void;
}

export function InfiniteCampusProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ICSession | null>(null);
  const [lastDistrict, setLastDistrict] = useState<StoredIcDistrict | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [silentJob, setSilentJob] = useState<SilentJob | null>(null);

  // reauth() is called from data hooks and the keepalive with whatever
  // closure they captured, so it reads the latest values through refs.
  const sessionRef = useRef<ICSession | null>(null);
  const lastDistrictRef = useRef<StoredIcDistrict | null>(null);
  const reauthInFlightRef = useRef<Promise<ICSession | null> | null>(null);
  const silentJobRef = useRef<SilentJob | null>(null);
  sessionRef.current = session;
  lastDistrictRef.current = lastDistrict;

  useEffect(() => {
    Promise.all([getStoredIcSession(), getLastIcDistrict()]).then(([s, d]) => {
      setSession(s);
      setLastDistrict(d);
      setIsInitializing(false);
    });
  }, []);

  const startSilentJob = (job: SilentJob | null) => {
    silentJobRef.current = job;
    setSilentJob(job);
  };

  // Abandons an in-flight silent login (its reauth then resolves null, and
  // attemptReauth's session check stops it persisting anything).
  const cancelSilentJob = () => {
    const job = silentJobRef.current;
    startSilentJob(null);
    job?.resolve(null);
  };

  // Clear IC session when Firebase user signs out so the next user never
  // inherits a previous user's IC auth token (or saved login) and sees
  // their grades.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        cancelSilentJob();
        sessionRef.current = null;
        setSession(null);
        setLastDistrict(null);
        clearStoredIcSession();
        clearLastIcDistrict();
        clearStoredIcCredentials();
        clearIcCookies();
      }
    });
    return unsub;
  }, []);

  const persist = async (s: ICSession | null) => {
    sessionRef.current = s;
    setSession(s);
    if (s) {
      await saveStoredIcSession(s);
    } else {
      await clearStoredIcSession();
    }
  };

  const completeLogin = async (
    result: WebViewLoginResult,
    district: StoredIcDistrict,
    resolvedPerson?: { personId: string; displayName: string | null }
  ): Promise<ICSession | null> => {
    setIsChecking(true);
    setLoginError(null);
    try {
      const partial: ICSession = {
        authToken: result.cookies,
        baseUrl: result.baseUrl,
        appName: result.appName,
        displayName: null,
      };

      // personId is required here (not best-effort like it used to be):
      // with the WebView flow Vela never learns the user's IC username, so
      // personId + district hostname is the only stable identity anchor
      // left to derive the Firebase account from. Reuse the caller's
      // already-resolved person (from /api/ic/mint-token) when given,
      // rather than making IC's server answer the same question twice.
      const person = resolvedPerson ?? (await fetchPersonInfo(toIcSession(partial)));
      if (!person) {
        throw new Error("Signed in, but couldn't verify your student profile. Please try again.");
      }
      const newSession: ICSession = {
        ...partial,
        personId: person.personId,
        displayName: person.displayName ?? null,
        districtName: district.district_name,
        stateCode: district.state_code,
      };

      await persist(newSession);
      await saveLastIcDistrict(district);
      setLastDistrict(district);
      // Only saved after IC accepted them; turning "Stay signed in" off on a
      // later login forgets any previously saved ones.
      if (result.credentials) {
        await saveStoredIcCredentials({ ...result.credentials, baseUrl: result.baseUrl });
      } else if (result.remember === false) {
        await clearStoredIcCredentials();
      }
      return newSession;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign-in failed. Please try again.";
      setLoginError(msg);
      return null;
    } finally {
      setIsChecking(false);
    }
  };

  const checkPerson = (s: ICSession) =>
    withTimeout(fetchPersonInfo(toIcSession(s)).catch(() => null), PERSON_CHECK_TIMEOUT_MS, null);

  const attemptReauth = async (): Promise<ICSession | null> => {
    const current = sessionRef.current;
    if (!current) return null;
    // Anything that replaced or cleared the session meanwhile (logout,
    // Firebase sign-out, a manual re-login) wins over this attempt.
    const stillCurrent = () => sessionRef.current === current;

    if (await checkPerson(current)) return current;

    // fetchPersonInfo can't tell "offline" from "expired". Never throw away
    // a session (or burn a login attempt) just because there's no network.
    if (!(await isIcReachable(current.baseUrl))) return null;
    const authState = await probeIcAuth(current);
    if (authState === "valid") return current;

    const district = lastDistrictRef.current;
    // Sessions without a personId predate it being required; there's no
    // way to confirm a refreshed one is the same student, so don't try.
    if (district && current.personId && stillCurrent()) {
      const saved = await getStoredIcCredentials();
      const sameDistrict =
        !!saved && icBase(saved.baseUrl) === icBase(district.district_baseurl);
      let verified: { personId: string; displayName: string } | null = null;
      const result = await new Promise<WebViewLoginResult | null>((resolve) =>
        startSilentJob({
          district,
          credentials: saved && sameDistrict ? { username: saved.username, password: saved.password } : null,
          // Must still be the same student — saved credentials or leftover
          // WebView cookies for someone else must never swap whose grades
          // (and whose Firebase account's data) this session shows.
          verify: async (r) => {
            const person = await checkPerson({ ...current, authToken: r.cookies, baseUrl: r.baseUrl, appName: r.appName });
            if (person?.personId !== current.personId) return false;
            verified = person;
            return true;
          },
          resolve: (r) => {
            if (silentJobRef.current) startSilentJob(null);
            resolve(r);
          },
        })
      );
      const person = verified as { personId: string; displayName: string } | null;
      if (result && person && stillCurrent()) {
        const next: ICSession = {
          ...current,
          authToken: result.cookies,
          baseUrl: result.baseUrl,
          appName: result.appName,
          displayName: person.displayName || current.displayName,
        };
        await persist(next);
        return next;
      }
    }

    if (authState === "expired" && stillCurrent()) await persist(null);
    return null;
  };

  const reauth = useCallback((): Promise<ICSession | null> => {
    if (!reauthInFlightRef.current) {
      reauthInFlightRef.current = withTimeout(attemptReauth(), REAUTH_TIMEOUT_MS, null).finally(() => {
        reauthInFlightRef.current = null;
      });
    }
    return reauthInFlightRef.current;
    // attemptReauth only reads refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keepalive: check (and silently repair) the session whenever the app
  // returns to the foreground, and periodically while it stays there.
  const connected = !!session;
  useEffect(() => {
    if (!connected) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!interval) interval = setInterval(() => reauth(), KEEPALIVE_INTERVAL_MS);
    };
    const stop = () => {
      if (interval) clearInterval(interval);
      interval = null;
    };
    if (AppState.currentState === "active") start();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        reauth();
        start();
      } else {
        stop();
      }
    });
    return () => {
      sub.remove();
      stop();
    };
    // Re-arm only on connect/disconnect, not on every cookie refresh.
  }, [connected, reauth]);

  const logout = () => {
    cancelSilentJob();
    persist(null);
    clearLastIcDistrict();
    clearStoredIcCredentials();
    clearIcCookies();
    setLastDistrict(null);
    setLoginError(null);
  };

  return (
    <ICContext.Provider
      value={{
        session,
        lastDistrict,
        isConnected: !!session,
        isInitializing,
        isChecking,
        completeLogin,
        logout,
        reauth,
        loginError,
      }}
    >
      {children}
      {silentJob && (
        <SilentIcLogin
          baseUrl={silentJob.district.district_baseurl}
          appName={silentJob.district.district_app_name}
          credentials={silentJob.credentials}
          verify={silentJob.verify}
          onDone={silentJob.resolve}
        />
      )}
    </ICContext.Provider>
  );
}
