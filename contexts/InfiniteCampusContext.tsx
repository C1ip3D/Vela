"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface ICSession {
  authToken: string;
  baseUrl: string;
  appName?: string;
  displayName: string | null;
}

interface ICCredentials {
  districtUrl: string;
  username: string;
  password: string;
  appName?: string;
}

interface ICContextType {
  session: ICSession | null;
  isConnected: boolean;
  isChecking: boolean;
  isInitializing: boolean;
  login: (districtUrl: string, username: string, password: string, appName?: string) => Promise<boolean>;
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
          const newSession = await doLogin(creds.districtUrl, creds.username, creds.password, creds.appName);
          if (newSession) {
            persist(newSession);
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
    appName?: string
  ): Promise<ICSession | null> => {
    const res = await fetch("/api/ic/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ districtUrl, username, password, appName }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      authToken: data.authToken,
      baseUrl: data.baseUrl,
      appName: data.appName,
      displayName: data.displayName ?? null,
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
    appName?: string
  ): Promise<boolean> => {
    setIsChecking(true);
    setLoginError(null);
    try {
      const newSession = await doLogin(districtUrl, username, password, appName);
      if (!newSession) {
        setLoginError("Login failed. Check your credentials.");
        return false;
      }
      persist(newSession);
      // Save credentials for future auto-reauth
      localStorage.setItem(IC_CREDS_KEY, JSON.stringify({ districtUrl, username, password, appName }));
      return true;
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Network error");
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  const reauth = async (): Promise<ICSession | null> => {
    try {
      const raw = localStorage.getItem(IC_CREDS_KEY);
      if (!raw) return null;
      const creds: ICCredentials = JSON.parse(raw);
      const newSession = await doLogin(creds.districtUrl, creds.username, creds.password, creds.appName);
      if (!newSession) return null;
      persist(newSession);
      return newSession;
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
