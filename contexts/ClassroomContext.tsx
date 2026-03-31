"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { GoogleAuthProvider, signInWithPopup, getAuth } from "firebase/auth";
import app from "@/lib/firebase";

// ── Types ──────────────────────────────────────────────────────────────────

interface ClassroomContextType {
  classroomToken: string;
  isConnected: boolean;
  isChecking: boolean;
  displayName: string | null;
  connect: () => Promise<boolean>;
  disconnect: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "vela_classroom_token";
const STORAGE_NAME_KEY = "vela_classroom_name";

// Google Classroom OAuth scopes (read-only)
const CLASSROOM_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
];

// ── Context ────────────────────────────────────────────────────────────────

const ClassroomContext = createContext<ClassroomContextType>(
  {} as ClassroomContextType
);

export function useClassroom() {
  return useContext(ClassroomContext);
}

// ── Provider ───────────────────────────────────────────────────────────────

export function ClassroomProvider({ children }: { children: ReactNode }) {
  const [classroomToken, setClassroomTokenState] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);

  // Restore token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEY);
    const savedName = localStorage.getItem(STORAGE_NAME_KEY);
    if (savedToken) {
      setClassroomTokenState(savedToken);
      setIsConnected(true);
      setDisplayName(savedName);
    }
  }, []);

  const persist = (token: string, name: string | null) => {
    setClassroomTokenState(token);
    if (token) {
      localStorage.setItem(STORAGE_KEY, token);
      if (name) localStorage.setItem(STORAGE_NAME_KEY, name);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_NAME_KEY);
    }
  };

  const connect = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();

      // Request Classroom-specific read scopes
      CLASSROOM_SCOPES.forEach((scope) => provider.addScope(scope));

      // Force account chooser every time so user can pick the right Google account
      provider.setCustomParameters({ prompt: "select_account" });

      const result = await signInWithPopup(auth, provider);

      // Extract the Google OAuth access token from the credential
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;

      if (!accessToken) {
        throw new Error("No access token returned from Google OAuth");
      }

      const name = result.user.displayName;
      persist(accessToken, name);
      setIsConnected(true);
      setDisplayName(name);
      return true;
    } catch (err) {
      console.error("Classroom OAuth error:", err);
      setIsConnected(false);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    persist("", null);
    setIsConnected(false);
    setDisplayName(null);
  }, []);

  return (
    <ClassroomContext.Provider
      value={{
        classroomToken,
        isConnected,
        isChecking,
        displayName,
        connect,
        disconnect,
      }}
    >
      {children}
    </ClassroomContext.Provider>
  );
}
