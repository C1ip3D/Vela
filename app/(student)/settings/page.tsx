"use client";
import { useState, useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { useAuth } from "@/contexts/AuthContext";
import { Bell } from "lucide-react";

interface NotificationPrefs {
  gradeAlerts: boolean;
  assignmentAlerts: boolean;
  weeklyDigest: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  gradeAlerts: true,
  assignmentAlerts: true,
  weeklyDigest: false,
};

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{ transition: "background-color 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1)" }}
      className={`relative h-[30px] w-[52px] rounded-full flex-shrink-0 ${on ? "bg-[#34C759] shadow-[0_0_10px_rgba(52,199,89,0.3)]" : "bg-[#1C2A45]"}`}
    >
      <div
        style={{ transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)" }}
        className={`absolute top-[3px] left-[3px] h-[24px] w-[24px] rounded-full bg-white shadow-md ${on ? "translate-x-[22px]" : "translate-x-0"}`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const displayName = user?.displayName || "Student";

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    const saved = localStorage.getItem("vela_notif_prefs");
    if (saved) {
      try { setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(saved) }); } catch {}
    }
  }, []);

  useEffect(() => { localStorage.setItem("vela_notif_prefs", JSON.stringify(prefs)); }, [prefs]);

  const updatePref = <K extends keyof NotificationPrefs>(key: K, val: NotificationPrefs[K]) =>
    setPrefs((p) => ({ ...p, [key]: val }));

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Settings" studentName={displayName} />
      <div className="flex-1 p-6 max-w-4xl mx-auto space-y-6">

        <div className="animate-fade-in rounded-xl border border-[#1C2A45]/60 bg-[#101828]/50 backdrop-blur-sm p-5 space-y-5">
          <h2 className="text-sm font-semibold text-[#E8ECFF] flex items-center gap-2">
            <Bell size={14} className="text-[#818CF8]" /> Notifications
          </h2>

          <div className="space-y-3">
            {[
              { key: "gradeAlerts" as const, label: "Overall Grade Updates", desc: "Alert when a course grade changes" },
              { key: "assignmentAlerts" as const, label: "Assignment Updates", desc: "Alert when a missing assignment is detected" },
              { key: "weeklyDigest" as const, label: "Weekly Digest", desc: "Weekly summary of your academic progress" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-lg bg-[#162032]/60 border border-[#1C2A45]/40 px-4 py-3">
                <div>
                  <p className="text-sm text-[#E8ECFF]">{item.label}</p>
                  <p className="text-xs text-[#8B98B8]">{item.desc}</p>
                </div>
                <Toggle on={prefs[item.key]} onToggle={() => updatePref(item.key, !prefs[item.key])} />
              </div>
            ))}
          </div>
        </div>

        <div className="animate-fade-in" style={{ animationDelay: "80ms" }}>
          <button
            onClick={async () => {
              const { signOut } = await import("firebase/auth");
              const { auth } = await import("@/lib/firebase");
              await signOut(auth);
              window.location.href = "/signup";
            }}
            className="w-full rounded-xl border border-rose-500/20 bg-rose-500/5 py-3 text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-all duration-200"
          >
            Sign Out
          </button>
        </div>

      </div>
    </div>
  );
}
