import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { api } from "@/lib/api";

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
  isInitializing: boolean;
  isChecking: boolean;
  login: (districtUrl: string, username: string, password: string, appName?: string) => Promise<boolean>;
  logout: () => void;
  reauth: () => Promise<ICSession | null>;
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
  const [isInitializing, setIsInitializing] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(IC_SESSION_KEY).then((raw) => {
      if (raw) {
        try {
          setSession(JSON.parse(raw));
        } catch {
          SecureStore.deleteItemAsync(IC_SESSION_KEY);
        }
      }
    }).finally(() => {
      setIsInitializing(false);
    });
  }, []);

  const persist = async (s: ICSession | null) => {
    setSession(s);
    if (s) {
      await SecureStore.setItemAsync(IC_SESSION_KEY, JSON.stringify(s));
    } else {
      await SecureStore.deleteItemAsync(IC_SESSION_KEY);
    }
  };

  const doLogin = async (
    districtUrl: string,
    username: string,
    password: string,
    appName?: string
  ): Promise<ICSession | null> => {
    const res = await api.post("/api/ic/auth", {
      districtUrl,
      username,
      password,
      appName,
    });
    const data = res.data;
    return {
      authToken: data.authToken,
      baseUrl: data.baseUrl,
      appName: data.appName,
      displayName: data.displayName ?? null,
    };
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
      if (!newSession) return false;
      await persist(newSession);
      // Store credentials for auto-reauth
      await SecureStore.setItemAsync(IC_CREDS_KEY, JSON.stringify({
        districtUrl,
        username,
        password,
        appName,
      }));
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed. Check your credentials.";
      setLoginError(msg);
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  const reauth = async (): Promise<ICSession | null> => {
    try {
      const raw = await SecureStore.getItemAsync(IC_CREDS_KEY);
      if (!raw) return null;
      const creds: ICCredentials = JSON.parse(raw);
      const newSession = await doLogin(creds.districtUrl, creds.username, creds.password, creds.appName);
      if (!newSession) return null;
      await persist(newSession);
      return newSession;
    } catch {
      return null;
    }
  };

  const logout = () => {
    persist(null);
    SecureStore.deleteItemAsync(IC_CREDS_KEY);
    setLoginError(null);
  };

  return (
    <ICContext.Provider
      value={{
        session,
        isConnected: !!session,
        isInitializing,
        isChecking,
        login,
        logout,
        reauth,
        loginError,
      }}
    >
      {children}
    </ICContext.Provider>
  );
}
