import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "critical" | "info" | "ap" | "honors";

const variants: Record<BadgeVariant, string> = {
  default: "bg-[#162032]/60 text-[#8B98B8] border border-[#1C2A45]/60",
  success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15",
  warning: "bg-amber-400/10 text-amber-400 border border-amber-400/15",
  critical: "bg-rose-500/10 text-rose-400 border border-rose-500/15",
  info: "bg-sky-400/10 text-sky-400 border border-sky-400/15",
  ap: "bg-[#818CF8]/10 text-[#A5B4FC] border border-[#818CF8]/20",
  honors: "bg-[#6366F1]/10 text-[#C7D2FE] border border-[#6366F1]/15",
};

export function Badge({ children, variant = "default", className }: { children: React.ReactNode; variant?: BadgeVariant; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-wider uppercase", variants[variant], className)}>
      {children}
    </span>
  );
}
