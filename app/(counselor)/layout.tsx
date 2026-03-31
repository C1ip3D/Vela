"use client";
import { Sidebar } from "@/components/layout/Sidebar";
import { StarField } from "@/components/ui/StarField";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function CounselorLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden bg-[#03060D] relative">
        <StarField />
        <Sidebar role="COUNSELOR" />
        <main className="relative flex-1 overflow-y-auto z-10">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
