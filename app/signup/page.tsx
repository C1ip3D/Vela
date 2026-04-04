"use client";
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { VelaLogo } from "@/components/ui/VelaLogo";
import {
  Mail, Lock, User, Eye, EyeOff, ArrowRight,
  School, CheckCircle, Loader2, SkipForward, MapPin, Search
} from "lucide-react";

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const STARS = [
  { x: 8, y: 20, s: 1, d: 0.4 }, { x: 22, y: 10, s: 1.5, d: 1.0 }, { x: 38, y: 35, s: 2, d: 0.2 },
  { x: 52, y: 8, s: 1, d: 2.3 }, { x: 68, y: 28, s: 1.5, d: 0.6 }, { x: 82, y: 15, s: 1, d: 1.8 },
  { x: 18, y: 60, s: 2, d: 2.0 }, { x: 58, y: 68, s: 1, d: 1.3 }, { x: 78, y: 55, s: 1.5, d: 0.9 },
  { x: 35, y: 80, s: 1, d: 1.6 }, { x: 88, y: 75, s: 1.5, d: 2.2 }, { x: 48, y: 50, s: 1, d: 0.1 },
];

export default function SignupPage() {
  const { signUp, signInWithGoogle, user } = useAuth();
  const { login: icLogin, isChecking: icChecking, loginError: icError, isConnected: icConnected } = useIC();
  const router = useRouter();

  // Mode: regular email/password or IC-only sign-up
  const [authMode, setAuthMode] = useState<"standard" | "ic_only">("standard");

  // Flow Step
  const [step, setStep] = useState<1 | 2>(1);

  // Standard creation state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);

  // IC District Search
  const [icStateCode, setIcStateCode] = useState("CA");
  const [districtQuery, setDistrictQuery] = useState("");
  const [districts, setDistricts] = useState<any[]>([]);
  const [isSearchingDistrict, setIsSearchingDistrict] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // IC credentials
  const [selectedDistrict, setSelectedDistrict] = useState<any | null>(null);
  const [icUsername, setIcUsername] = useState("");
  const [icPassword, setIcPassword] = useState("");
  const [showIcPassword, setShowIcPassword] = useState(false);

  useEffect(() => {
    // If we're fully past the process or already logged in with no IC logic needed, go instantly home
    if (user && step === 1 && authMode === "standard") router.push("/dashboard");
  }, [user, router, step, authMode]);

  useEffect(() => {
    if (!districtQuery || selectedDistrict) {
      setDistricts([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setIsSearchingDistrict(true);
      try {
        const res = await fetch(`/api/ic/districts?query=${encodeURIComponent(districtQuery)}&state=${icStateCode}`);
        if (res.ok) {
          const json = await res.json();
          setDistricts(json.data || []);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingDistrict(false);
      }
    }, 400);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [districtQuery, icStateCode, selectedDistrict]);

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError("");
    if (password !== confirm) { setAccountError("Passwords do not match"); return; }
    if (password.length < 6) { setAccountError("Password must be at least 6 characters"); return; }
    setAccountLoading(true);
    try {
      await signUp(email, password, name);
      setStep(2);
    } catch (err: any) {
      setAccountError(
        err.code === "auth/email-already-in-use" ? "An account with this email already exists" :
          err.code === "auth/weak-password" ? "Password is too weak — use at least 6 characters" :
            err.message
      );
    } finally {
      setAccountLoading(false);
    }
  };

  const handleGoogle = async () => {
    setAccountError("");
    try {
      await signInWithGoogle();
      setStep(2);
    } catch (err: any) {
      setAccountError(err.message);
    }
  };

  const attemptICConnection = async (isStandaloneICFlow: boolean) => {
    if (!selectedDistrict || !icUsername.trim() || !icPassword.trim()) return;
    const url = selectedDistrict.district_baseurl.replace(/\/$/, "");

    // 1. Fetch the short-lived token
    await icLogin(url, icUsername.trim(), icPassword.trim());
    if (icError) return;

    // 2. If this is a purely IC sign-up (they clicked Continue with IC at the very beginning)
    // We create a Firebase "Shadow Account" to maintain platform access inside protected routes.
    if (isStandaloneICFlow) {
      try {
        const hostname = new URL(url).hostname;
        const pseudoEmail = `${icUsername.toLowerCase()}@${hostname}.ic.vela.app`;
        const pseudoPassword = `VelaIC#${btoa(pseudoEmail).substring(0, 16)}`;
        try {
          await signUp(pseudoEmail, pseudoPassword, icUsername);
        } catch (e: any) {
          if (e.code === "auth/email-already-in-use") {
            // Already logged in before!
            const { signInWithEmailAndPassword } = await import("firebase/auth");
            const { auth } = await import("@/lib/firebase");
            await signInWithEmailAndPassword(auth, pseudoEmail, pseudoPassword);
          } else throw e;
        }
      } catch (e) {
        console.error("Firebase shadow account creation failed:", e);
      }
    }
    
    // In either case (added in step 2 or standalone), go to dashboard
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#03060D] relative overflow-hidden">
      {/* Star field */}
      <div className="pointer-events-none absolute inset-0">
        {STARS.map((star, i) => (
          <div key={i} className="absolute rounded-full"
            style={{
              left: `${star.x}%`, top: `${star.y}%`, width: `${star.s}px`, height: `${star.s}px`,
              background: star.s >= 2 ? "rgba(232,236,255,0.7)" : "rgba(196,210,230,0.4)",
              boxShadow: star.s >= 2 ? "0 0 6px rgba(124,158,245,0.4)" : "0 0 3px rgba(124,158,245,0.2)",
              animation: `twinkle ${3 + star.d}s ease-in-out ${star.d}s infinite`,
            }}
          />
        ))}
        <div className="absolute top-[20%] left-[20%] h-64 w-64 rounded-full bg-[#6366F1]/[0.04] blur-3xl" />
        <div className="absolute bottom-[10%] right-[15%] h-48 w-48 rounded-full bg-[#818CF8]/[0.03] blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6 my-10">
        <div className="mb-8 flex justify-center animate-fade-in">
          <VelaLogo size="lg" />
        </div>

        {/* Multi-step context for Standard creation */}
        {authMode === "standard" && (
          <div className="flex items-center justify-center gap-3 mb-6 animate-fade-in">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-3">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                  step === s
                    ? "bg-[#818CF8] text-white shadow-[0_0_12px_rgba(129,140,248,0.4)]"
                    : step > s
                    ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                    : "bg-[#1C2A45]/60 border border-[#253A5E]/60 text-[#4A5578]"
                }`}>
                  {step > s ? <CheckCircle size={14} /> : s}
                </div>
                <span className={`text-xs font-medium ${step === s ? "text-[#A5B4FC]" : step > s ? "text-emerald-400" : "text-[#4A5578]"}`}>
                  {s === 1 ? "Account" : "Infinite Campus"}
                </span>
                {s < 2 && <div className={`h-px w-8 ${step > 1 ? "bg-emerald-500/40" : "bg-[#1C2A45]/60"}`} />}
              </div>
            ))}
          </div>
        )}

        {/* ── Standard Entry / Step 1 ── */}
        {authMode === "standard" && step === 1 && (
          <div className="animate-fade-in rounded-2xl border border-[#1C2A45]/60 bg-[#101828]/60 backdrop-blur-lg p-8">
            <h1 className="text-xl font-semibold text-[#E8ECFF] mb-1">Create your account</h1>
            <p className="text-sm text-[#8B98B8] mb-6">Join Vela and start navigating your academics</p>

            {accountError && (
              <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-400">
                {accountError}
              </div>
            )}

            <form onSubmit={handleAccountSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#8B98B8] uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5578]" />
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                    className="w-full rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/60 pl-10 pr-4 py-2.5 text-sm text-[#E8ECFF] placeholder-[#4A5578] outline-none focus:border-[#818CF8]/40 focus:shadow-[0_0_12px_rgba(129,140,248,0.1)] transition-all"
                    placeholder="Alex Chen" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#8B98B8] uppercase tracking-wider">School Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5578]" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="w-full rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/60 pl-10 pr-4 py-2.5 text-sm text-[#E8ECFF] placeholder-[#4A5578] outline-none focus:border-[#818CF8]/40 focus:shadow-[0_0_12px_rgba(129,140,248,0.1)] transition-all"
                    placeholder="you@school.edu" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#8B98B8] uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5578]" />
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required
                    className="w-full rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/60 pl-10 pr-10 py-2.5 text-sm text-[#E8ECFF] placeholder-[#4A5578] outline-none focus:border-[#818CF8]/40 focus:shadow-[0_0_12px_rgba(129,140,248,0.1)] transition-all"
                    placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5578] hover:text-[#8B98B8] transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#8B98B8] uppercase tracking-wider">Confirm Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5578]" />
                  <input type={showPassword ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} required
                    className="w-full rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/60 pl-10 pr-4 py-2.5 text-sm text-[#E8ECFF] placeholder-[#4A5578] outline-none focus:border-[#818CF8]/40 focus:shadow-[0_0_12px_rgba(129,140,248,0.1)] transition-all"
                    placeholder="••••••••" />
                </div>
              </div>

              <button type="submit" disabled={accountLoading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#818CF8] py-2.5 text-sm font-medium text-white hover:bg-[#6366F1] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_0_16px_rgba(129,140,248,0.25)]">
                {accountLoading ? <Loader2 size={14} className="animate-spin" /> : <>Continue <ArrowRight size={14} /></>}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-[#1C2A45]/60" />
              <span className="text-[10px] uppercase tracking-wider text-[#4A5578]">or</span>
              <div className="flex-1 h-px bg-[#1C2A45]/60" />
            </div>

            <div className="space-y-3">
              <button onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/40 py-2.5 text-sm text-[#8B98B8] hover:border-[#253A5E] hover:text-[#E8ECFF] transition-all duration-200">
                <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                Continue with Google
              </button>
              <button onClick={() => { setAuthMode("ic_only"); setStep(2); }}
                className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/40 py-2.5 text-sm text-[#8B98B8] hover:border-[#253A5E] hover:text-[#E8ECFF] transition-all duration-200">
                <School size={16} /> Continue with Infinite Campus
              </button>
            </div>
            
            <p className="mt-8 text-center text-sm text-[#8B98B8]">
              Already have an account?{" "}
              <Link href="/login" className="text-[#A5B4FC] hover:text-[#818CF8] transition-colors font-medium">
                Sign in
              </Link>
            </p>
          </div>
        )}

        {/* ── Connect Infinite Campus (Step 2 or Standalone Mode) ── */}
        {step === 2 && (
          <div className="animate-fade-in rounded-2xl border border-[#1C2A45]/60 bg-[#101828]/60 backdrop-blur-lg p-8 relative">
            
            {authMode === "ic_only" && (
              <button onClick={() => { setAuthMode("standard"); setStep(1); }} className="absolute top-6 right-6 text-[#4A5578] hover:text-[#8B98B8]">
                Close
              </button>
            )}

            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#818CF8]/15 border border-[#818CF8]/20 shadow-[0_0_16px_rgba(129,140,248,0.1)]">
                <School size={20} className="text-[#818CF8]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#E8ECFF] leading-tight">Infinite Campus</h1>
                <p className="text-sm text-[#8B98B8]">Find your district to get started</p>
              </div>
            </div>

            {icError && (
              <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-400">
                {icError}
              </div>
            )}

            {icConnected && authMode === "standard" ? (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  <CheckCircle size={28} className="text-emerald-400" />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-[#E8ECFF]">Connected!</p>
                  <p className="text-sm text-[#8B98B8] mt-1">Vela is syncing your grades</p>
                </div>
                <button onClick={() => router.push("/dashboard")}
                  className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg bg-[#818CF8] py-2.5 text-sm font-medium text-white hover:bg-[#6366F1] shadow-[0_0_16px_rgba(129,140,248,0.25)]">
                  <ArrowRight size={14} /> Go to Dashboard
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Autocomplete Search Dropdowns */}
                <div className="flex gap-3">
                  <div className="w-[85px]">
                    <label className="mb-1.5 block text-xs font-medium text-[#8B98B8] uppercase tracking-wider">State</label>
                    <div className="relative">
                      <select value={icStateCode} onChange={(e) => { setIcStateCode(e.target.value); setSelectedDistrict(null); }}
                        className="w-full appearance-none rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/60 px-3 py-2.5 text-sm text-[#E8ECFF] outline-none focus:border-[#818CF8]/40 transition-all">
                        {US_STATES.map((s) => (
                          <option key={s} value={s} className="bg-[#101828]">{s}</option>
                        ))}
                      </select>
                      <MapPin size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5578] pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex-1 relative">
                    <label className="mb-1.5 block text-xs font-medium text-[#8B98B8] uppercase tracking-wider">District Name</label>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5578]" />
                      <input type="text" value={districtQuery}
                        onChange={(e) => { setDistrictQuery(e.target.value); setSelectedDistrict(null); setShowDropdown(true); }}
                        className="w-full rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/60 pl-9 pr-8 py-2.5 text-sm text-[#E8ECFF] placeholder-[#4A5578] outline-none focus:border-[#818CF8]/40 focus:shadow-[0_0_12px_rgba(129,140,248,0.1)] transition-all"
                        placeholder="Search district..." />
                      {isSearchingDistrict && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5578] animate-spin" />}
                      
                      {/* Search Results Dropdown */}
                      {showDropdown && districts.length > 0 && !selectedDistrict && (
                        <div className="absolute z-50 left-0 right-0 top-[110%] rounded-lg border border-[#1C2A45] bg-[#0C1220]/95 backdrop-blur-md shadow-xl max-h-48 overflow-y-auto">
                          {districts.map((d, i) => (
                            <button key={i} type="button" onClick={() => { setSelectedDistrict(d); setDistrictQuery(d.district_name); setShowDropdown(false); }}
                              className="w-full text-left px-4 py-2.5 text-sm text-[#E8ECFF] hover:bg-[#818CF8]/10 border-b border-[#1C2A45]/50 last:border-0 truncate">
                              {d.district_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {selectedDistrict && (
                  <div className="animate-fade-in space-y-4 pt-1">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#8B98B8] uppercase tracking-wider">IC Username</label>
                      <input type="text" value={icUsername} onChange={(e) => setIcUsername(e.target.value)}
                        className="w-full rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/60 px-4 py-2.5 text-sm text-[#E8ECFF] placeholder-[#4A5578] outline-none" placeholder="Username" />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#8B98B8] uppercase tracking-wider">IC Password</label>
                      <div className="relative">
                        <input type={showIcPassword ? "text" : "password"} value={icPassword} onChange={(e) => setIcPassword(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") attemptICConnection(authMode === "ic_only"); }}
                          className="w-full rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/60 px-4 pr-10 py-2.5 text-sm text-[#E8ECFF] placeholder-[#4A5578] outline-none" placeholder="••••••••" />
                        <button type="button" onClick={() => setShowIcPassword(!showIcPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5578] hover:text-[#8B98B8]">
                          {showIcPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => attemptICConnection(authMode === "ic_only")}
                      disabled={icChecking || !icUsername.trim() || !icPassword.trim()}
                      className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg bg-[#818CF8] py-2.5 text-sm font-medium text-white hover:bg-[#6366F1] disabled:opacity-50 transition-all shadow-[0_0_16px_rgba(129,140,248,0.25)]">
                      {icChecking ? <Loader2 size={14} className="animate-spin" /> : 
                       authMode === "ic_only" ? <>Access Vela Dashboard <ArrowRight size={14} /></> : <>Connect Portfolio <ArrowRight size={14} /> </>}
                    </button>
                  </div>
                )}

                {authMode === "standard" && (
                  <button onClick={() => router.push("/dashboard")}
                    className="w-full text-center mt-2 flex items-center justify-center gap-2 py-2 text-sm text-[#4A5578] hover:text-[#8B98B8] transition-colors">
                    <SkipForward size={14} /> Skip for now
                  </button>
                )}

              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
