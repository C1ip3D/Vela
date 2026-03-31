"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function SyncStatus({ lastSynced }: { lastSynced?: string }) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try { await fetch("/api/sync", { method: "POST" }); } catch { }
    setTimeout(() => setSyncing(false), 1500);
  };

  return (
    <div className="flex items-center gap-2 text-xs text-[#8B98B8]">
      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
      <span>{lastSynced ? `Synced ${lastSynced}` : "Live"}</span>
      <button onClick={handleSync} className="ml-1 rounded p-1 hover:bg-[#162032]/60 transition-colors" title="Sync now">
        <RefreshCw size={12} className={cn("text-[#8B98B8] hover:text-[#A5B4FC] transition-colors", syncing && "animate-spin")} />
      </button>
    </div>
  );
}
