import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { onAuthStateChanged } from "firebase/auth";
import { fetchPersonInfo } from "@vela/ic-client";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/api";
import { getStoredIcSession, saveStoredIcSession, clearStoredIcSession, toIcSession, type StoredIcSession } from "@/lib/icSession";

export type ICSession = StoredIcSession;

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
    getStoredIcSession().then(setSession).finally(() => {
      setIsInitializing(false);
    });
  }, []);

  // Clear IC session when Firebase user signs out so the next user never
  // inherits a previous user's IC auth token and sees their grades.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setSession(null);
        clearStoredIcSession();
        SecureStore.deleteItemAsync(IC_CREDS_KEY);
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
    const partial: ICSession = {
      authToken: data.authToken,
      baseUrl: data.baseUrl,
      appName: data.appName,
      displayName: data.displayName ?? null,
    };

    // Resolve personId now (some IC assignment/schedule endpoints require it);
    // best-effort — login still succeeds without it.
    try {
      const person = await fetchPersonInfo(toIcSession(partial));
      if (person) {
        return { ...partial, personId: person.personId, displayName: partial.displayName ?? person.displayName };
      }
    } catch {}

    return partial;
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
