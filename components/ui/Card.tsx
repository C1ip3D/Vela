import { cn } from "@/lib/utils";

export function Card({ children, className, glow }: { children: React.ReactNode; className?: string; glow?: "blue" | "critical" | "success" }) {
  const glowClass = glow === "blue" ? "shadow-[0_0_24px_rgba(124,158,245,0.25)]"
    : glow === "critical" ? "shadow-[0_0_20px_rgba(244,63,94,0.30)]"
      : glow === "success" ? "shadow-[0_0_16px_rgba(16,185,129,0.25)]"
        : "";
  return (
    <div className={cn(
      "relative rounded-xl border border-[#1C2A45]/80 p-5 transition-all duration-200",
      "bg-[#101828]/70 backdrop-blur-md",
      "hover:border-[#253A5E]",
      glowClass,
      className
    )}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-3 flex items-center justify-between", className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-xs font-semibold uppercase tracking-widest text-[#8B98B8]", className)}>{children}</h3>;
}
