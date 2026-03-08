"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { VelaLogo } from "@/components/ui/VelaLogo";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";

export default function LoginPage() {
    const { signIn, signInWithGoogle, user } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // If already logged in, redirect
    useEffect(() => { if (user) router.push("/dashboard"); }, [user, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await signIn(email, password);
            router.push("/dashboard");
        } catch (err: any) {
            setError(err.code === "auth/invalid-credential" ? "Invalid email or password" : err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        setError("");
        try {
            await signInWithGoogle();
            router.push("/dashboard");
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#03060D] relative overflow-hidden">
            {/* Star field background */}
            <div className="pointer-events-none absolute inset-0">
                {[
                    { x: 10, y: 15, s: 1.5, d: 0 }, { x: 25, y: 8, s: 1, d: 1.2 }, { x: 40, y: 30, s: 2, d: 0.5 },
                    { x: 55, y: 12, s: 1, d: 2.1 }, { x: 70, y: 25, s: 1.5, d: 0.8 }, { x: 85, y: 18, s: 1, d: 1.5 },
                    { x: 15, y: 55, s: 2, d: 2.5 }, { x: 60, y: 70, s: 1, d: 1.0 }, { x: 80, y: 60, s: 1.5, d: 0.7 },
                    { x: 30, y: 85, s: 1, d: 1.8 }, { x: 90, y: 80, s: 1.5, d: 2.0 }, { x: 50, y: 45, s: 1, d: 0.3 },
                ].map((star, i) => (
                    <div key={i} className="absolute rounded-full"
                        style={{
                            left: `${star.x}%`, top: `${star.y}%`, width: `${star.s}px`, height: `${star.s}px`,
                            background: star.s >= 2 ? "rgba(232,236,255,0.7)" : "rgba(196,210,230,0.4)",
                            boxShadow: star.s >= 2 ? "0 0 6px rgba(124,158,245,0.4)" : "0 0 3px rgba(124,158,245,0.2)",
                            animation: `twinkle ${3 + star.d}s ease-in-out ${star.d}s infinite`,
                        }}
                    />
                ))}
                {/* Nebula accents */}
                <div className="absolute top-[10%] right-[15%] h-64 w-64 rounded-full bg-[#818CF8]/[0.04] blur-3xl" />
                <div className="absolute bottom-[15%] left-[10%] h-48 w-48 rounded-full bg-[#6366F1]/[0.03] blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md px-6">
                {/* Logo */}
                <div className="mb-10 flex justify-center animate-fade-in">
                    <VelaLogo size="lg" />
                </div>

                {/* Card */}
                <div className="animate-fade-in rounded-2xl border border-[#1C2A45]/60 bg-[#101828]/60 backdrop-blur-lg p-8" style={{ animationDelay: "100ms" }}>
                    <h1 className="text-xl font-semibold text-[#E8ECFF] mb-1">Welcome back</h1>
                    <p className="text-sm text-[#8B98B8] mb-6">Sign in to your Vela account</p>

                    {error && (
                        <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-400">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#8B98B8] uppercase tracking-wider">Email</label>
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

                        <button type="submit" disabled={loading}
                            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#818CF8] py-2.5 text-sm font-medium text-white hover:bg-[#6366F1] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_0_16px_rgba(129,140,248,0.25)]">
                            {loading ? (
                                <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            ) : (
                                <>Sign In <ArrowRight size={14} /></>
                            )}
                        </button>
                    </form>

                    <div className="my-6 flex items-center gap-3">
                        <div className="flex-1 h-px bg-[#1C2A45]/60" />
                        <span className="text-[10px] uppercase tracking-wider text-[#4A5578]">or</span>
                        <div className="flex-1 h-px bg-[#1C2A45]/60" />
                    </div>

                    <button onClick={handleGoogle}
                        className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/40 py-2.5 text-sm text-[#8B98B8] hover:border-[#253A5E] hover:text-[#E8ECFF] transition-all duration-200">
                        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                        Continue with Google
                    </button>
                </div>

                {/* Sign up link */}
                <p className="mt-6 text-center text-sm text-[#8B98B8] animate-fade-in" style={{ animationDelay: "200ms" }}>
                    Don&apos;t have an account?{" "}
                    <Link href="/signup" className="text-[#A5B4FC] hover:text-[#818CF8] transition-colors font-medium">
                        Create one
                    </Link>
                </p>
            </div>
        </div>
    );
}
