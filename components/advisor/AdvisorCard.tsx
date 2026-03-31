import { severityColor, formatDate } from "@/lib/utils";
import { AlertTriangle, TrendingDown, BookMarked, CheckCircle, Info } from "lucide-react";

const icons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  GPA_DROP_ALERT: TrendingDown,
  MISSING_ASSIGNMENT_ALERT: AlertTriangle,
  COURSE_RECOMMENDATION: BookMarked,
  POSITIVE_TREND: CheckCircle,
  MILESTONE_REACHED: CheckCircle,
};

interface AdvisorLog {
  id: string;
  logType: string;
  severity: string;
  title: string;
  body: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export function AdvisorCard({ log }: { log: AdvisorLog }) {
  const colors = severityColor(log.severity);
  const Icon = icons[log.logType] ?? Info;

  return (
    <div className={`relative rounded-xl border border-[#1C2A45]/60 bg-[#101828]/50 backdrop-blur-sm p-4 transition-all duration-200 hover:border-[#253A5E]/80 ${log.logType === "GPA_DROP_ALERT" && log.severity === "CRITICAL" ? "pulse-critical" : ""}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-lg p-1.5 ${colors.bg}`}>
          <Icon size={14} className={colors.text} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-medium ${log.isRead ? "text-[#8B98B8]" : "text-[#E8ECFF]"}`}>{log.title}</p>
            <span className="shrink-0 text-[10px] text-[#4A5578]">{formatDate(log.createdAt)}</span>
          </div>
          {log.logType === "GPA_DROP_ALERT" && (
            <p className="mt-1 text-xs text-[#8B98B8]">
              {(log.body as any).fromGpa?.toFixed(2)} → {(log.body as any).toGpa?.toFixed(2)} GPA over {(log.body as any).window}
            </p>
          )}
          {log.logType === "MISSING_ASSIGNMENT_ALERT" && (log.body as any).course && (
            <p className="mt-1 text-xs text-[#8B98B8]">
              {(log.body as any).course}
            </p>
          )}
          {log.logType === "MISSING_ASSIGNMENT_ALERT" && !(log.body as any).course && (
            <p className="mt-1 text-xs text-[#8B98B8]">
              {/* Do nothing, user requested this subtext to be removed */}
            </p>
          )}
        </div>
      </div>
      {!log.isRead && <div className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-[#818CF8] shadow-[0_0_6px_rgba(129,140,248,0.5)]" />}
    </div>
  );
}
