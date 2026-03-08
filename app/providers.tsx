"use client";
import { AuthProvider } from "@/contexts/AuthContext";
import { CanvasProvider } from "@/contexts/CanvasContext";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <CanvasProvider>{children}</CanvasProvider>
        </AuthProvider>
    );
}
