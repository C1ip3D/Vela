"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, Compass, Settings, Users, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { VelaLogo } from "@/components/ui/VelaLogo";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/advisor", label: "Advisor", icon: Compass },
  { href: "/settings", label: "Settings", icon: Settings },
];

const counselorItems = [
  { href: "/portal", label: "Student Portal", icon: Users },
];

export function Sidebar({ role = "STUDENT" }: { role?: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const items = role === "COUNSELOR" ? counselorItems : navItems;

  return (
    <aside className={cn(
      "relative flex h-screen flex-col border-r border-[#1C2A45]/60 transition-all duration-300",
      "bg-gradient-to-b from-[#0C1220] via-[#070B16] to-[#03060D]",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Star dots decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="star-dot absolute top-[15%] left-[20%] animate-twinkle" />
        <div className="star-dot absolute top-[35%] right-[25%] animate-twinkle-slow" />
        <div className="star-dot-bright absolute top-[65%] left-[60%] animate-twinkle-fast" />
        <div className="star-dot absolute bottom-[20%] left-[35%] animate-twinkle" />
        <div className="star-dot absolute top-[50%] left-[80%] animate-twinkle-slow" />
      </div>

      {/* Logo */}
      <div className="flex h-16 items-center border-b border-[#1C2A45]/40 px-4">
        {collapsed ? (
          <div className="flex justify-center w-full">
            <Image src="/logo.png" alt="Vela" height={80} width={80} style={{ height: 80, width: "auto", objectFit: "contain" }} priority />
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Vela" height={44} width={44} style={{ height: 44, width: "auto", objectFit: "contain" }} priority />
            <span className="text-[#E8ECFF] font-bold tracking-[0.25em] text-lg select-none">VELA</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                active
                  ? "bg-[#818CF8]/10 border border-[#818CF8]/20 text-[#A5B4FC] font-medium shadow-[0_0_12px_rgba(129,140,248,0.1)]"
                  : "border border-transparent text-[#8B98B8] hover:bg-[#162032]/60 hover:text-[#D4DAF0] hover:border-[#1C2A45]/50"
              )}>
              <item.icon size={24} className={cn("shrink-0 transition-all", active && "drop-shadow-[0_0_4px_rgba(129,140,248,0.5)]")} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-2 mb-2">
        <button onClick={async () => { const { signOut } = await import("firebase/auth"); const { auth } = await import("@/lib/firebase"); await signOut(auth); window.location.href = "/login"; }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#8B98B8] hover:bg-[#162032]/60 hover:text-rose-400 border border-transparent hover:border-[#1C2A45]/50 transition-all duration-200">
          <LogOut size={24} className="shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* Constellation watermark */}
      {!collapsed && (
        <div className="px-4 pb-4 pointer-events-none select-none">
          <svg width="160" height="100" viewBox="0 0 200 160" className="animate-constellation" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="starGlow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <g stroke="rgba(165,180,252,0.3)" strokeWidth="0.6" fill="none">
              <line x1="48" y1="110" x2="72" y2="80" />
              <line x1="72" y1="80" x2="110" y2="58" />
              <line x1="110" y1="58" x2="148" y2="42" />
              <line x1="148" y1="42" x2="162" y2="70" />
              <line x1="162" y1="70" x2="140" y2="95" />
              <line x1="140" y1="95" x2="72" y2="80" />
              <line x1="48" y1="110" x2="140" y2="95" />
            </g>
            <g filter="url(#starGlow)">
              <circle cx="48" cy="110" r="2.5" fill="rgba(165,180,252,0.6)" />
              <circle cx="72" cy="80" r="1.8" fill="rgba(165,180,252,0.5)" />
              <circle cx="110" cy="58" r="2.2" fill="rgba(165,180,252,0.6)" />
              <circle cx="148" cy="42" r="1.6" fill="rgba(165,180,252,0.5)" />
              <circle cx="162" cy="70" r="1.4" fill="rgba(165,180,252,0.4)" />
              <circle cx="140" cy="95" r="1.5" fill="rgba(165,180,252,0.5)" />
            </g>
          </svg>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-[#1C2A45] bg-[#0C1220] text-[#8B98B8] hover:text-[#A5B4FC] hover:border-[#818CF8]/30 hover:shadow-[0_0_8px_rgba(129,140,248,0.2)] transition-all duration-200"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
