"use client";
import { SyncStatus } from "@/components/ui/SyncStatus";
import { Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect } from "react";
import { AdvisorFeed } from "@/components/dashboard/AdvisorFeed";
import { useCanvasNotifications } from "@/hooks/useCanvasNotifications";

export function TopBar({ title, studentName }: { title?: string; studentName?: string }) {
  const { user } = useAuth();
  const displayName = user?.displayName || studentName || "User";
  const initial = displayName[0]?.toUpperCase() || "U";

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch live notifications
  const { unreadLogs } = useCanvasNotifications();
  const alertCount = unreadLogs.length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="flex h-16 items-center justify-between border-b border-[#1C2A45]/50 bg-[#070B16]/80 backdrop-blur-lg px-6 sticky top-0 z-50">
      <div>
        {title && <h1 className="text-base font-semibold text-[#E8ECFF] tracking-wide">{title}</h1>}
      </div>
      <div className="flex items-center gap-4">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="relative p-1.5 rounded-md hover:bg-[#1C2A45]/50 transition-colors focus:outline-none flex items-center justify-center"
          >
            <Bell size={24} className="text-[#8B98B8] hover:text-[#A5B4FC] transition-colors" />
            {alertCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-[0_0_8px_rgba(244,63,94,0.4)]">
                {alertCount}
              </span>
            )}
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-3 w-80 sm:w-[400px] rounded-xl border border-[#1C2A45]/80 bg-[#101828] shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200 z-50">
              <div className="px-4 py-4 max-h-[450px] overflow-y-auto custom-scrollbar">
                <AdvisorFeed logs={unreadLogs} isDropdown={true} />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-[#818CF8]/15 border border-[#818CF8]/20 flex items-center justify-center text-sm font-semibold text-[#A5B4FC] shadow-[0_0_8px_rgba(129,140,248,0.15)]">
            {initial}
          </div>
          <span className="text-sm text-[#8B98B8] hidden sm:block">{displayName}</span>
        </div>
      </div>
    </header>
  );
}
