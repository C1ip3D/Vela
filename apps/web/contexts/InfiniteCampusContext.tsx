"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface ICSession {
  authToken: string;
  baseUrl: string;
  appName?: string;
  personId?: string;
  displayName: string | null;
  // Kept alongside the session so a later /api/ic/courses or
  // /api/ic/assignments call can re-verify baseUrl against IC's
  // district-search API without asking the user to search again — see
  // packages/ic-client/src/hostValidation.ts's verifyIcDistrictHost.
  districtName?: string;
  stateCode?: string;
}

interface ICCredentials {
  districtUrl: string;
  username: string;
  password: string;
  appName?: string;
  districtName?: string;
  stateCode?: string;
}

export interface ICLoginResult {
  success: boolean;
  /**
   * Short-lived, single-use-at-login value from /api/ic/auth — deliberately
   * NOT part of ICSession/localStorage; it has no reason to sit on disk.
   */
  firebaseCustomToken?: string;
}

interface ICContextType {
  session: ICSession | null;
  isConnected: boolean;
  isChecking: boolean;
  isInitializing: boolean;
  login: (
    districtUrl: string,
    username: string,
    password: string,
    appName?: string,
    districtName?: string,
    stateCode?: string
  ) => Promise<ICLoginResult>;
  reauth: () => Promise<ICSession | null>;
  logout: () => void;
  loginError: string | null;
}

const IC_SESSION_KEY = "vela_ic_session";
const IC_CREDS_KEY = "vela_ic_creds";

const ICContext = createContext<ICContextType>({} as ICContextType);

export function useIC() {
  return useContext(ICContext);
}

export function InfiniteCampusProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ICSession | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  // On mount: if saved credentials exist, silently re-authenticate
  useEffect(() => {
    const init = async () => {
      try {
        const credsRaw = localStorage.getItem(IC_CREDS_KEY);
        if (credsRaw) {
          const creds: ICCredentials = JSON.parse(credsRaw);
          const result = await doLogin(creds.districtUrl, creds.username, creds.password, creds.appName, creds.districtName, creds.stateCode);
          if (result) {
            persist(result.session);
            return;
          }
        }
        // Fall back to cached session if reauth fails
        const sessionRaw = localStorage.getItem(IC_SESSION_KEY);
        if (sessionRaw) setSession(JSON.parse(sessionRaw));
      } catch {
        localStorage.removeItem(IC_SESSION_KEY);
      } finally {
        setIsInitializing(false);
      }
    };
    init();
  }, []);

  const doLogin = async (
    districtUrl: string,
    username: string,
    password: string,
    appName?: string,
    districtName?: string,
    stateCode?: string
  ): Promise<{ session: ICSession; firebaseCustomToken?: string } | null> => {
    const res = await fetch("/api/ic/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ districtUrl, username, password, appName, districtName, stateCode }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      session: {
        authToken: data.authToken,
        baseUrl: data.baseUrl,
        appName: data.appName,
        personId: data.personId ?? undefined,
        displayName: data.displayName ?? null,
        districtName,
        stateCode,
      },
      firebaseCustomToken: data.firebaseCustomToken ?? undefined,
    };
  };

  const persist = (s: ICSession | null) => {
    setSession(s);
    if (s) {
      localStorage.setItem(IC_SESSION_KEY, JSON.stringify(s));
    } else {
      localStorage.removeItem(IC_SESSION_KEY);
    }
  };

  const login = async (
    districtUrl: string,
    username: string,
    password: string,
    appName?: string,
    districtName?: string,
    stateCode?: string
  ): Promise<ICLoginResult> => {
    setIsChecking(true);
    setLoginError(null);
    try {
      const result = await doLogin(districtUrl, username, password, appName, districtName, stateCode);
      if (!result) {
        setLoginError("Login failed. Check your credentials.");
        return { success: false };
      }
      persist(result.session);
      // Save credentials for future auto-reauth
      localStorage.setItem(
        IC_CREDS_KEY,
        JSON.stringify({ districtUrl, username, password, appName, districtName, stateCode })
      );
      return { success: true, firebaseCustomToken: result.firebaseCustomToken };
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Network error");
      return { success: false };
    } finally {
      setIsChecking(false);
    }
  };

  const reauth = async (): Promise<ICSession | null> => {
    try {
      const raw = localStorage.getItem(IC_CREDS_KEY);
      if (!raw) return null;
      const creds: ICCredentials = JSON.parse(raw);
      const result = await doLogin(creds.districtUrl, creds.username, creds.password, creds.appName, creds.districtName, creds.stateCode);
      if (!result) return null;
      persist(result.session);
      return result.session;
    } catch {
      return null;
    }
  };

  const logout = () => {
    persist(null);
    localStorage.removeItem(IC_CREDS_KEY);
    setLoginError(null);
  };

  return (
    <ICContext.Provider
      value={{
        session,
        isConnected: !!session,
        isChecking,
        isInitializing,
        login,
        reauth,
        logout,
        loginError,
      }}
    >
      {children}
    </ICContext.Provider>
  );
}
