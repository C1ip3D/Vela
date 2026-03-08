"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface CanvasContextType {
    token: string;
    setToken: (token: string) => void;
    isConnected: boolean;
    isChecking: boolean;
    userName: string | null;
    testConnection: (tokenOverride?: string) => Promise<boolean>;
    disconnect: () => void;
}

const CANVAS_BASE = "https://dublinusd.instructure.com";
const STORAGE_KEY = "vela_canvas_token";

const CanvasContext = createContext<CanvasContextType>({} as CanvasContextType);

export function useCanvas() {
    return useContext(CanvasContext);
}

export function CanvasProvider({ children }: { children: ReactNode }) {
    const [token, setTokenState] = useState("");
    const [isConnected, setIsConnected] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [userName, setUserName] = useState<string | null>(null);

    // Load token from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            setTokenState(saved);
            // Test the saved token on load
            testConnectionWithToken(saved);
        }
    }, []);

    const setToken = (newToken: string) => {
        setTokenState(newToken);
        if (newToken) {
            localStorage.setItem(STORAGE_KEY, newToken);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    };

    const testConnectionWithToken = async (tokenToTest: string): Promise<boolean> => {
        setIsChecking(true);
        try {
            const res = await fetch("/api/canvas/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: tokenToTest }),
            });
            if (res.ok) {
                const data = await res.json();
                setIsConnected(true);
                setUserName(data.name || null);
                return true;
            }
            setIsConnected(false);
            setUserName(null);
            return false;
        } catch {
            setIsConnected(false);
            setUserName(null);
            return false;
        } finally {
            setIsChecking(false);
        }
    };

    const testConnection = async (tokenOverride?: string): Promise<boolean> => {
        const t = tokenOverride || token;
        if (!t) return false;
        const result = await testConnectionWithToken(t);
        if (result && tokenOverride) {
            setToken(tokenOverride);
        }
        return result;
    };

    const disconnect = () => {
        setToken("");
        setIsConnected(false);
        setUserName(null);
    };

    return (
        <CanvasContext.Provider value={{ token, setToken, isConnected, isChecking, userName, testConnection, disconnect }}>
            {children}
        </CanvasContext.Provider>
    );
}

export { CANVAS_BASE };
