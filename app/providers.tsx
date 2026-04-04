"use client";
import { AuthProvider } from "@/contexts/AuthContext";
import { InfiniteCampusProvider } from "@/contexts/InfiniteCampusContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <InfiniteCampusProvider>{children}</InfiniteCampusProvider>
    </AuthProvider>
  );
}
