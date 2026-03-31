"use client";
import { AuthProvider } from "@/contexts/AuthContext";
import { CanvasProvider } from "@/contexts/CanvasContext";
import { ClassroomProvider } from "@/contexts/ClassroomContext";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <CanvasProvider>
                <ClassroomProvider>{children}</ClassroomProvider>
            </CanvasProvider>
        </AuthProvider>
    );
}
