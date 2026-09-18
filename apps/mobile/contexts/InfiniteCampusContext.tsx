import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { fetchPersonInfo } from "@vela/ic-client";
import { auth } from "@/lib/firebase";
import {
  getStoredIcSession,
  saveStoredIcSession,
  clearStoredIcSession,
  toIcSession,
  getLastIcDistrict,
  saveLastIcDistrict,
  clearLastIcDistrict,
  type StoredIcSession,
  type StoredIcDistrict,
} from "@/lib/icSession";

export type ICSession = StoredIcSession;

interface WebViewLoginResult {
  cookies: string;
  baseUrl: string;
  appName: string;
}

interface ICContextType {
  session: ICSession | null;
  lastDistrict: StoredIcDistrict | null;
  isConnected: boolean;
  isInitializing: boolean;
  isChecking: boolean;
  // Called once the mobile WebView login screen has established an IC
  // session on the user's behalf (see components/auth/IcLoginWebView.tsx).
  // Vela never sees the user's raw IC password with this flow.
  completeLogin: (result: WebViewLoginResult, district: StoredIcDistrict) => Promise<ICSession | null>;
  logout: () => void;
  // Best-effort: confirms the existing session is still valid. Cannot
  // silently establish a *new* session (no password is stored to replay),
  // so a genuinely expired session is cleared and callers should route the
  // user back to the WebView login (see lastDistrict) rather than expect a
  // fresh session back here.
  reauth: () => Promise<ICSession | null>;
  loginError: string | null;
}

const ICContext = createContext<ICContextType>({} as ICContextType);

export function useIC() {
  return useContext(ICContext);
}

export function InfiniteCampusProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ICSession | null>(null);
  const [lastDistrict, setLastDistrict] = useState<StoredIcDistrict | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getStoredIcSession(), getLastIcDistrict()]).then(([s, d]) => {
      setSession(s);
      setLastDistrict(d);
      setIsInitializing(false);
    });
  }, []);

  // Clear IC session when Firebase user signs out so the next user never
  // inherits a previous user's IC auth token and sees their grades.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setSession(null);
        setLastDistrict(null);
        clearStoredIcSession();
        clearLastIcDistrict();
      }
    });
    return unsub;
  }, []);

  const persist = async (s: ICSession | null) => {
    setSession(s);
    if (s) {
      await saveStoredIcSession(s);
    } else {
      await clearStoredIcSession();
    }
  };

  const completeLogin = async (
    result: WebViewLoginResult,
    district: StoredIcDistrict
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
      // left to derive the Firebase pseudo-account from.
      const person = await fetchPersonInfo(toIcSession(partial));
      if (!person) {
        throw new Error("Signed in, but couldn't verify your student profile. Please try again.");
      }
      const newSession: ICSession = { ...partial, personId: person.personId, displayName: person.displayName ?? null };

      await persist(newSession);
      await saveLastIcDistrict(district);
      setLastDistrict(district);
      return newSession;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign-in failed. Please try again.";
      setLoginError(msg);
      return null;
    } finally {
      setIsChecking(false);
    }
  };

  const reauth = async (): Promise<ICSession | null> => {
    if (!session) return null;
    try {
      // Confirm the existing cookie session still works — this repairs
      // transient 401s without bothering the user, but can't recover a
      // truly expired session (no password is stored to replay).
      const person = await fetchPersonInfo(toIcSession(session));
      if (person) return session;
    } catch {}
    await persist(null);
    return null;
  };

  const logout = () => {
    persist(null);
    clearLastIcDistrict();
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
    </ICContext.Provider>
  );
}
