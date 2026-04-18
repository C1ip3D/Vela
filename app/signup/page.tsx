"use client";
import React, { useState, useEffect, useRef } from "react";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { useRouter } from "next/navigation";
import { VelaLogo } from "@/components/ui/VelaLogo";
import {
  Eye, EyeOff, ArrowRight,
  School, Loader2, MapPin, Search
} from "lucide-react";

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const STARS = [
  { x: 3,  y: 5,  s: 2,   d: 0.4 }, { x: 11, y: 2,  s: 2.5, d: 1.0 }, { x: 19, y: 8,  s: 1.5, d: 0.2 },
  { x: 27, y: 3,  s: 3,   d: 2.3 }, { x: 36, y: 7,  s: 2,   d: 0.6 }, { x: 44, y: 1,  s: 1.5, d: 1.8 },
  { x: 53, y: 6,  s: 2.5, d: 0.3 }, { x: 62, y: 2,  s: 2,   d: 1.5 }, { x: 71, y: 9,  s: 3,   d: 0.8 },
  { x: 80, y: 4,  s: 1.5, d: 2.0 }, { x: 89, y: 7,  s: 2,   d: 1.2 }, { x: 96, y: 3,  s: 2.5, d: 0.5 },
  { x: 6,  y: 18, s: 2,   d: 1.7 }, { x: 15, y: 22, s: 3,   d: 0.1 }, { x: 24, y: 16, s: 1.5, d: 2.4 },
  { x: 33, y: 25, s: 2,   d: 0.9 }, { x: 42, y: 19, s: 2.5, d: 1.6 }, { x: 51, y: 28, s: 2,   d: 0.4 },
  { x: 60, y: 14, s: 1.5, d: 2.1 }, { x: 69, y: 23, s: 3,   d: 0.7 }, { x: 78, y: 17, s: 2,   d: 1.3 },
  { x: 87, y: 26, s: 2.5, d: 2.5 }, { x: 94, y: 20, s: 2,   d: 0.2 },
  { x: 2,  y: 38, s: 2.5, d: 1.1 }, { x: 13, y: 42, s: 2,   d: 0.6 }, { x: 22, y: 35, s: 3,   d: 1.9 },
  { x: 31, y: 45, s: 1.5, d: 0.3 }, { x: 40, y: 39, s: 2,   d: 2.2 }, { x: 49, y: 48, s: 2.5, d: 0.8 },
  { x: 58, y: 36, s: 2,   d: 1.4 }, { x: 67, y: 43, s: 3,   d: 0.1 }, { x: 76, y: 37, s: 1.5, d: 2.3 },
  { x: 85, y: 46, s: 2,   d: 0.9 }, { x: 93, y: 40, s: 2.5, d: 1.7 },
  { x: 5,  y: 58, s: 2,   d: 2.0 }, { x: 16, y: 63, s: 3,   d: 0.5 }, { x: 25, y: 55, s: 1.5, d: 1.2 },
  { x: 34, y: 67, s: 2.5, d: 0.4 }, { x: 43, y: 60, s: 2,   d: 1.8 }, { x: 52, y: 70, s: 2,   d: 0.7 },
  { x: 61, y: 56, s: 3,   d: 2.4 }, { x: 70, y: 65, s: 1.5, d: 1.0 }, { x: 79, y: 59, s: 2,   d: 0.3 },
  { x: 88, y: 68, s: 2.5, d: 1.6 }, { x: 97, y: 62, s: 2,   d: 2.1 },
  { x: 8,  y: 78, s: 2,   d: 0.6 }, { x: 18, y: 84, s: 3,   d: 1.3 }, { x: 28, y: 76, s: 2.5, d: 0.2 },
  { x: 38, y: 88, s: 2,   d: 1.9 }, { x: 48, y: 81, s: 1.5, d: 0.8 }, { x: 57, y: 91, s: 2,   d: 2.2 },
  { x: 66, y: 77, s: 2.5, d: 0.5 }, { x: 75, y: 86, s: 3,   d: 1.5 }, { x: 84, y: 79, s: 2,   d: 0.1 },
  { x: 91, y: 93, s: 2.5, d: 1.8 }, { x: 98, y: 85, s: 2,   d: 0.9 },
];

export default function SignupPage() {
  const { login: icLogin, isChecking: icChecking, loginError: icError } = useIC();
  const router = useRouter();

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
    if (!districtQuery || districtQuery.length < 3 || selectedDistrict) {
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

  const attemptICConnection = async () => {
    if (!selectedDistrict || !icUsername.trim() || !icPassword.trim()) return;
    const url = selectedDistrict.district_baseurl.replace(/\/$/, "");

    await icLogin(url, icUsername.trim(), icPassword.trim(), selectedDistrict.district_app_name);
    if (icError) return;

    try {
      const hostname = new URL(url).hostname;
      const pseudoEmail = `${icUsername.toLowerCase()}@${hostname}.ic.vela.app`;
      const pseudoPassword = `VelaIC#${btoa(pseudoEmail).substring(0, 16)}`;
      const { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase");
      try {
        const cred = await createUserWithEmailAndPassword(auth, pseudoEmail, pseudoPassword);
        await updateProfile(cred.user, { displayName: icUsername });
      } catch (e: any) {
        if (e.code === "auth/email-already-in-use") {
          await signInWithEmailAndPassword(auth, pseudoEmail, pseudoPassword);
        } else throw e;
      }
    } catch (e) {
      console.error("Firebase shadow account creation failed:", e);
    }

    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#03060D] relative overflow-hidden">
      {/* Star field */}
      <div className="pointer-events-none absolute inset-0">
        {STARS.map((star, i) => (
          <div key={i} className="absolute rounded-full"
            style={{
              left: `${star.x}%`, top: `${star.y}%`, width: `${star.s}px`, height: `${star.s}px`,
              background: star.s >= 2.5 ? "rgba(240,244,255,0.95)" : star.s >= 2 ? "rgba(210,220,255,0.85)" : "rgba(180,196,245,0.65)",
              boxShadow: star.s >= 2.5 ? `0 0 ${star.s * 4}px rgba(165,180,252,0.9), 0 0 ${star.s * 8}px rgba(129,140,248,0.5)` : `0 0 ${star.s * 3}px rgba(165,180,252,0.7)`,
              animation: `twinkle ${3 + star.d}s ease-in-out ${star.d}s infinite`,
            }}
          />
        ))}
        <div className="absolute top-[20%] left-[20%] h-64 w-64 rounded-full bg-[#6366F1]/[0.04] blur-3xl" />
        <div className="absolute bottom-[10%] right-[15%] h-48 w-48 rounded-full bg-[#818CF8]/[0.03] blur-3xl" />
      </div>

      {/* Logo — pinned top center */}
      <div className="absolute top-10 left-0 right-0 flex flex-col items-center z-10 pointer-events-none">
        <VelaLogo size="lg" />
        <h1 className="text-5xl font-bold text-[#E8ECFF] tracking-widest mt-3">VELA</h1>
        <p className="text-xs text-[#8B98B8] tracking-[0.35em] mt-2 uppercase">Academic Navigator</p>
      </div>

      {/* Card — fixed center, slides down when collapsed so logo is visible */}
      <div className="fixed inset-0 flex items-center justify-center z-20 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-xl px-6"
          style={{
            transform: selectedDistrict ? "translateY(0)" : "translateY(45%)",
            transition: "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
        <div className="animate-fade-in rounded-2xl border border-[#1C2A45]/60 bg-[#101828]/60 backdrop-blur-lg p-10">
          <div className="flex items-center gap-3 mb-5">
            <div>
              <h1 className="text-xl font-semibold text-[#E8ECFF] leading-tight">Sign In</h1>
              <p className="text-sm text-[#8B98B8]">Using your Infinite Campus credentials</p>
            </div>
          </div>

          {icError && (
            <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-400">
              {icError}
            </div>
          )}

          <div className="space-y-4">
            {/* State + District Search */}
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
                  <label className="mb-1.5 block text-xs font-medium text-[#8B98B8] uppercase tracking-wider">Username</label>
                  <input type="text" value={icUsername} onChange={(e) => setIcUsername(e.target.value)}
                    className="w-full rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/60 px-4 py-2.5 text-sm text-[#E8ECFF] placeholder-[#4A5578] outline-none" placeholder="Username" />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#8B98B8] uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <input type={showIcPassword ? "text" : "password"} value={icPassword} onChange={(e) => setIcPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") attemptICConnection(); }}
                      className="w-full rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/60 px-4 pr-10 py-2.5 text-sm text-[#E8ECFF] placeholder-[#4A5578] outline-none" placeholder="••••••••" />
                    <button type="button" onClick={() => setShowIcPassword(!showIcPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5578] hover:text-[#8B98B8]">
                      {showIcPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={attemptICConnection}
                  disabled={icChecking || !icUsername.trim() || !icPassword.trim()}
                  className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg bg-[#818CF8] py-2.5 text-sm font-medium text-white hover:bg-[#6366F1] disabled:opacity-50 transition-all shadow-[0_0_16px_rgba(129,140,248,0.25)]">
                  {icChecking ? <Loader2 size={14} className="animate-spin" /> : <>Access Vela Dashboard <ArrowRight size={14} /></>}
                </button>
              </div>
            )}
          </div>

        </div>
        </div>
      </div>
    </div>
  );
}
