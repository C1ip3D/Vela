"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface ICSession {
  /** The short-lived authToken returned by Infinite Campus after login */
  authToken: string;
  /** The base URL of the district portal, e.g. https://dublinusd.infinitecampus.org/campus */
  baseUrl: string;
  /** App partition name, e.g. dublin */
  appName?: string;
  /** Student's display name from IC */
  displayName: string | null;
}

interface ICContextType {
  session: ICSession | null;
  isConnected: boolean;
  isChecking: boolean;
  login: (districtUrl: string, username: string, password: string, appName?: string) => Promise<boolean>;
  logout: () => void;
  loginError: string | null;
}

const IC_SESSION_KEY = "vela_ic_session";

const ICContext = createContext<ICContextType>({} as ICContextType);

export function useIC() {
  return useContext(ICContext);
}

export function InfiniteCampusProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ICSession | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(IC_SESSION_KEY);
      if (raw) {
        const saved: ICSession = JSON.parse(raw);
        setSession(saved);
      }
    } catch {
      localStorage.removeItem(IC_SESSION_KEY);
    }
  }, []);

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
      const res = await fetch("/api/ic/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ districtUrl, username, password, appName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || "Login failed. Check your credentials.");
        return false;
      }

      const newSession: ICSession = {
        authToken: data.authToken,
        baseUrl: data.baseUrl,
        appName: data.appName,
        displayName: data.displayName ?? null,
      };
      persist(newSession);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setLoginError(msg);
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  const logout = () => {
    persist(null);
    setLoginError(null);
  };

  return (
    <ICContext.Provider
      value={{
        session,
        isConnected: !!session,
        isChecking,
        login,
        logout,
        loginError,
      }}
    >
      {children}
    </ICContext.Provider>
  );
}
