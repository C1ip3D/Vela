import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { api } from "@/lib/api";

export interface ICSession {
  authToken: string;
  baseUrl: string;
  appName?: string;
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

  useEffect(() => {
    SecureStore.getItemAsync(IC_SESSION_KEY).then((raw) => {
      if (raw) {
        try {
          setSession(JSON.parse(raw));
        } catch {
          SecureStore.deleteItemAsync(IC_SESSION_KEY);
        }
      }
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

  const login = async (
    districtUrl: string,
    username: string,
    password: string,
    appName?: string
  ): Promise<boolean> => {
    setIsChecking(true);
    setLoginError(null);
    try {
      const res = await api.post("/api/ic/auth", {
        districtUrl,
        username,
        password,
        appName,
      });
      const data = res.data;
      const newSession: ICSession = {
        authToken: data.authToken,
        baseUrl: data.baseUrl,
        appName: data.appName,
        displayName: data.displayName ?? null,
      };
      await persist(newSession);
      return true;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Login failed. Check your credentials.";
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
