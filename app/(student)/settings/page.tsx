"use client";
import { useState, useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { useAuth } from "@/contexts/AuthContext";
import { useCanvas } from "@/contexts/CanvasContext";
import {
  Eye, EyeOff, CheckCircle, XCircle, Loader2,
  User as UserIcon, GraduationCap, Bell, Mail, MessageCircle, ChevronDown, ChevronUp
} from "lucide-react";

interface NotificationPrefs {
  emailEnabled: boolean;
  telegram: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  gradeAlerts: boolean;
  assignmentAlerts: boolean;
  weeklyDigest: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  emailEnabled: true,
  telegram: false,
  telegramBotToken: "",
  telegramChatId: "",
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
  const { token, isConnected, isChecking, userName, testConnection, disconnect } = useCanvas();
  const displayName = user?.displayName || "Student";
  const email = user?.email || "not connected";

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [showTelegramSetup, setShowTelegramSetup] = useState(false);
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [patInput, setPatInput] = useState(token || "");
  const [showToken, setShowToken] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [testStatus, setTestStatus] = useState<Record<string, "idle" | "success" | "error">>({});
  const [counselor, setCounselor] = useState("");
  const [grade, setGrade] = useState("");

  // Load from localStorage
  useEffect(() => {
    const savedCounselor = localStorage.getItem("vela_student_counselor");
    const savedGrade = localStorage.getItem("vela_student_grade");
    const savedPrefs = localStorage.getItem("vela_notif_prefs");
    if (savedCounselor) setCounselor(savedCounselor);
    if (savedGrade) setGrade(savedGrade);
    if (savedPrefs) {
      try { setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(savedPrefs) }); } catch {}
    }
  }, []);

  // Persist changes
  useEffect(() => { localStorage.setItem("vela_student_counselor", counselor); }, [counselor]);
  useEffect(() => { localStorage.setItem("vela_student_grade", grade); }, [grade]);
  useEffect(() => { localStorage.setItem("vela_notif_prefs", JSON.stringify(prefs)); }, [prefs]);

  const updatePref = <K extends keyof NotificationPrefs>(key: K, val: NotificationPrefs[K]) =>
    setPrefs(p => ({ ...p, [key]: val }));

  const handleTestEmail = async () => {
    if (!email || email === "not connected") return;
    setIsSendingEmail(true);
    setTestStatus(s => ({ ...s, email: "idle" }));
    try {
      const res = await fetch("/api/notifications/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setTestStatus(s => ({ ...s, email: res.ok ? "success" : "error" }));
    } catch {
      setTestStatus(s => ({ ...s, email: "error" }));
    } finally {
      setIsSendingEmail(false);
      setTimeout(() => setTestStatus(s => ({ ...s, email: "idle" })), 3000);
    }
  };

  const handleTestTelegram = async () => {
    if (!prefs.telegramBotToken || !prefs.telegramChatId) return;
    setIsSendingTelegram(true);
    setTestStatus(s => ({ ...s, telegram: "idle" }));
    try {
      const res = await fetch("/api/notifications/grade-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: displayName,
          type: "grade_update",
          courseName: "AP Calculus BC",
          details: { oldGrade: 88.5, newGrade: 91.4 },
          prefs: { ...prefs, email: email, gradeAlerts: true },
        }),
      });
      setTestStatus(s => ({ ...s, telegram: res.ok ? "success" : "error" }));
    } catch {
      setTestStatus(s => ({ ...s, telegram: "error" }));
    } finally {
      setIsSendingTelegram(false);
      setTimeout(() => setTestStatus(s => ({ ...s, telegram: "idle" })), 3000);
    }
  };

  const handleConnect = async () => {
    setConnectionError("");
    if (!patInput.trim()) { setConnectionError("Please enter a Canvas access token"); return; }
    const success = await testConnection(patInput.trim());
    if (!success) setConnectionError("Invalid token or unable to reach Canvas. Check your token and try again.");
  };

  const handleDisconnect = () => { disconnect(); setPatInput(""); setConnectionError(""); };

  const COUNSELORS = [
    { name: "Nemesio Ordonez", email: "ordoneznemesio@dublinusd.org" },
    { name: "Christina Henning", email: "henningchristina@dublinusd.org" },
    { name: "Pallavi Nandakishore", email: "nandakishorepallavi@dublinusd.org" },
    { name: "Dianna Heise", email: "heisedianna@dublinusd.org" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Settings" studentName={displayName} />
      <div className="flex-1 p-6 max-w-4xl mx-auto space-y-6">

        {/* Student Profile */}
        <div className="animate-fade-in rounded-xl border border-[#1C2A45]/60 bg-[#101828]/50 backdrop-blur-sm p-5 space-y-5">
          <h2 className="text-sm font-semibold text-[#E8ECFF] flex items-center gap-2">
            <span className="text-[#818CF8]">◈</span> Student Profile
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#8B98B8] uppercase tracking-wider">Grade Level</label>
              <div className="relative">
                <select value={grade} onChange={e => setGrade(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/60 px-4 py-2.5 text-sm text-[#E8ECFF] outline-none focus:border-[#818CF8]/40 transition-all">
                  <option value="" disabled className="bg-[#101828]">Select Grade</option>
                  {["9", "10", "11", "12"].map(g => (
                    <option key={g} value={g} className="bg-[#101828]">
                      {g === "9" ? "9th (Freshman)" : g === "10" ? "10th (Sophomore)" : g === "11" ? "11th (Junior)" : "12th (Senior)"}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#4A5578]">
                  <GraduationCap size={24} />
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#8B98B8] uppercase tracking-wider">Assigned Counselor</label>
              <div className="relative">
                <select value={counselor} onChange={e => setCounselor(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/60 px-4 py-2.5 text-sm text-[#E8ECFF] outline-none focus:border-[#818CF8]/40 transition-all">
                  <option value="" disabled className="bg-[#101828]">Select Counselor</option>
                  {COUNSELORS.map(c => (
                    <option key={c.email} value={c.name} className="bg-[#101828]">{c.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#4A5578]">
                  <UserIcon size={24} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Canvas Integration */}
        <div className="animate-fade-in rounded-xl border border-[#1C2A45]/60 bg-[#101828]/50 backdrop-blur-sm p-5">
          <h2 className="text-sm font-semibold text-[#E8ECFF] mb-4 flex items-center gap-2">
            <span className="text-[#818CF8]">◈</span> Canvas Integration
          </h2>
          <div className="flex items-center justify-between rounded-lg bg-[#162032]/60 border border-[#1C2A45]/40 px-4 py-3 mb-3">
            <div>
              <p className="text-sm text-[#E8ECFF]">Dublin USD Canvas</p>
              <p className="text-xs text-[#8B98B8]">dublinusd.instructure.com</p>
              {isConnected && userName && <p className="text-xs text-[#A5B4FC] mt-0.5">Signed in as {userName}</p>}
            </div>
            {isChecking ? (
              <span className="flex items-center gap-1.5 text-xs text-[#8B98B8]"><Loader2 size={12} className="animate-spin" /> Checking...</span>
            ) : isConnected ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircle size={12} /> Connected</span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-[#8B98B8]"><XCircle size={12} /> Not Connected</span>
            )}
          </div>
          {!isConnected ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#8B98B8] uppercase tracking-wider">Personal Access Token</label>
                <div className="relative">
                  <input type={showToken ? "text" : "password"} value={patInput} onChange={e => setPatInput(e.target.value)}
                    className="w-full rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/60 px-4 pr-10 py-2.5 text-sm text-[#E8ECFF] placeholder-[#4A5578] outline-none focus:border-[#818CF8]/40 transition-all font-mono"
                    placeholder="Paste your Canvas access token..." />
                  <button type="button" onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5578] hover:text-[#8B98B8] transition-colors">
                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-[10px] text-[#4A5578] mt-1.5">Canvas → Account → Settings → New Access Token</p>
              </div>
              {connectionError && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">{connectionError}</div>}
              <button onClick={handleConnect} disabled={isChecking || !patInput.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#818CF8] py-2.5 text-sm font-medium text-white hover:bg-[#6366F1] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_0_16px_rgba(129,140,248,0.25)]">
                {isChecking ? <Loader2 size={14} className="animate-spin" /> : "Connect Canvas Account"}
              </button>
            </div>
          ) : (
            <button onClick={handleDisconnect}
              className="w-full rounded-lg border border-rose-500/20 bg-rose-500/5 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 transition-all duration-200">
              Disconnect Canvas Account
            </button>
          )}
        </div>

        {/* Notifications */}
        <div className="animate-fade-in rounded-xl border border-[#1C2A45]/60 bg-[#101828]/50 backdrop-blur-sm p-5 space-y-5" style={{ animationDelay: "80ms" }}>
          <h2 className="text-sm font-semibold text-[#E8ECFF] flex items-center gap-2">
            <Bell size={14} className="text-[#818CF8]" /> Notifications
          </h2>

          {/* Alert types */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#8B98B8] uppercase tracking-wider">Alert Types</p>
            {[
              { key: "gradeAlerts" as const, label: "Overall Grade Updates", desc: "Alert when a course grade changes" },
              { key: "assignmentAlerts" as const, label: "Assignment Updates", desc: "Alert when an assignment is graded" },
              { key: "weeklyDigest" as const, label: "Weekly Digest", desc: "Weekly summary of your academic progress" },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between rounded-lg bg-[#162032]/60 border border-[#1C2A45]/40 px-4 py-3">
                <div>
                  <p className="text-sm text-[#E8ECFF]">{item.label}</p>
                  <p className="text-xs text-[#8B98B8]">{item.desc}</p>
                </div>
                <Toggle on={prefs[item.key] as boolean} onToggle={() => updatePref(item.key, !prefs[item.key])} />
              </div>
            ))}
          </div>

          {/* Delivery channels */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#8B98B8] uppercase tracking-wider">Delivery Channels</p>

            {/* Email */}
            <div className="rounded-lg border border-[#1C2A45]/40 overflow-hidden">
              <div className="flex items-center justify-between bg-[#162032]/60 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Mail size={16} className="text-[#A5B4FC]" />
                  <div>
                    <p className="text-sm text-[#E8ECFF]">Email Alerts</p>
                    <p className="text-xs text-[#8B98B8]">{email !== "not connected" ? email : "Sign in to enable"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {testStatus.email === "success" && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle size={12} /> Sent!</span>}
                  {testStatus.email === "error" && <span className="text-xs text-rose-400 flex items-center gap-1"><XCircle size={12} /> Failed</span>}
                  <Toggle on={prefs.emailEnabled} onToggle={() => updatePref("emailEnabled", !prefs.emailEnabled)} />
                </div>
              </div>
              {prefs.emailEnabled && (
                <div className="px-4 pb-3 pt-2 bg-[#0C1220]/40 border-t border-[#1C2A45]/30">
                  <button onClick={handleTestEmail} disabled={isSendingEmail || email === "not connected"}
                    className="flex items-center gap-2 rounded-lg bg-[#818CF8]/15 border border-[#818CF8]/25 px-4 py-2 text-xs text-[#A5B4FC] hover:bg-[#818CF8]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    {isSendingEmail ? <Loader2 size={12} className="animate-spin" /> : "Send Test Email"}
                  </button>
                </div>
              )}
            </div>

            {/* Telegram */}
            <div className="rounded-lg border border-[#1C2A45]/40 overflow-hidden">
              <div className="flex items-center justify-between bg-[#162032]/60 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <MessageCircle size={16} className="text-[#A5B4FC]" />
                  <div>
                    <p className="text-sm text-[#E8ECFF]">Telegram Alerts</p>
                    <p className="text-xs text-[#8B98B8]">
                      {prefs.telegramChatId ? `Chat ID: ${prefs.telegramChatId}` : "Configure below to enable"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {testStatus.telegram === "success" && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle size={12} /> Sent!</span>}
                  {testStatus.telegram === "error" && <span className="text-xs text-rose-400 flex items-center gap-1"><XCircle size={12} /> Failed</span>}
                  <Toggle on={prefs.telegram} onToggle={() => updatePref("telegram", !prefs.telegram)} />
                </div>
              </div>
              {prefs.telegram && (
                <div className="px-4 pb-4 pt-3 bg-[#0C1220]/40 border-t border-[#1C2A45]/30 space-y-3">
                  {/* Setup instructions collapsible */}
                  <button onClick={() => setShowTelegramSetup(!showTelegramSetup)}
                    className="flex items-center gap-1.5 text-xs text-[#818CF8] hover:text-[#A5B4FC] transition-colors">
                    {showTelegramSetup ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    Setup instructions
                  </button>
                  {showTelegramSetup && (
                    <div className="rounded-lg bg-[#162032]/60 border border-[#1C2A45]/30 p-3 text-xs text-[#8B98B8] space-y-1.5">
                      <p className="text-[#A5B4FC] font-medium">How to set up Telegram alerts:</p>
                      <p>1. Message <span className="text-[#E8ECFF] font-mono">@BotFather</span> on Telegram → create a new bot → copy the Bot Token</p>
                      <p>2. Message your new bot (start a chat with it)</p>
                      <p>3. Message <span className="text-[#E8ECFF] font-mono">@userinfobot</span> to get your Chat ID</p>
                      <p>4. Enter both below and send a test message</p>
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#8B98B8]">Bot Token</label>
                    <div className="relative">
                      <input
                        type={showTelegramToken ? "text" : "password"}
                        value={prefs.telegramBotToken}
                        onChange={e => updatePref("telegramBotToken", e.target.value)}
                        placeholder="1234567890:ABCdef..."
                        className="w-full rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/60 px-4 pr-10 py-2 text-xs text-[#E8ECFF] placeholder-[#4A5578] outline-none focus:border-[#818CF8]/40 transition-all font-mono"
                      />
                      <button type="button" onClick={() => setShowTelegramToken(!showTelegramToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5578] hover:text-[#8B98B8] transition-colors">
                        {showTelegramToken ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#8B98B8]">Chat ID</label>
                    <input
                      type="text"
                      value={prefs.telegramChatId}
                      onChange={e => updatePref("telegramChatId", e.target.value)}
                      placeholder="123456789"
                      className="w-full rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/60 px-4 py-2 text-xs text-[#E8ECFF] placeholder-[#4A5578] outline-none focus:border-[#818CF8]/40 transition-all font-mono"
                    />
                  </div>
                  <button onClick={handleTestTelegram}
                    disabled={isSendingTelegram || !prefs.telegramBotToken || !prefs.telegramChatId}
                    className="flex items-center gap-2 rounded-lg bg-[#818CF8]/15 border border-[#818CF8]/25 px-4 py-2 text-xs text-[#A5B4FC] hover:bg-[#818CF8]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    {isSendingTelegram ? <Loader2 size={12} className="animate-spin" /> : "Send Test Message"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="animate-fade-in rounded-xl border border-[#1C2A45]/60 bg-[#101828]/50 backdrop-blur-sm p-5" style={{ animationDelay: "160ms" }}>
          <h2 className="text-sm font-semibold text-[#E8ECFF] mb-4 flex items-center gap-2">
            <span className="text-[#818CF8]">✦</span> Account
          </h2>
          <div className="flex items-center justify-between rounded-lg bg-[#162032]/60 border border-[#1C2A45]/40 px-4 py-3">
            <div>
              <p className="text-sm text-[#E8ECFF]">{displayName}</p>
              <p className="text-xs text-[#8B98B8]">{email}</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />Signed In
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
