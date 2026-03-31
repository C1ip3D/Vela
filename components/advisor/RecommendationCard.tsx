import { Badge } from "@/components/ui/Badge";
import { CheckCircle, AlertCircle } from "lucide-react";

interface Recommendation {
  catalogCourseId: string;
  courseName: string;
  department?: string;
  track: string;
  reason: string;
  prerequisitesMet: boolean;
  confidenceScore: number;
  courseType?: string;
  ucApproved?: boolean;
}

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  const confidence = Math.round(rec.confidenceScore * 100);
  return (
    <div className="rounded-xl border border-[#1C2A45]/60 bg-[#101828]/50 backdrop-blur-sm p-4 hover:border-[#253A5E]/80 transition-all duration-200">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-[#E8ECFF]">{rec.courseName}</p>
            {rec.courseType && rec.courseType !== "STANDARD" && (
              <Badge variant={rec.courseType === "AP" ? "ap" : "honors"}>{rec.courseType}</Badge>
            )}
          </div>
          {rec.department && <p className="text-xs text-[#8B98B8]">{rec.department}</p>}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs font-mono font-bold text-[#A5B4FC]">{confidence}%</div>
          <div className="text-[10px] text-[#4A5578]">match</div>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-[#1C2A45]/60">
        <div className="h-full rounded-full transition-all duration-500" style={{
          width: `${confidence}%`,
          background: "linear-gradient(to right, #6366F1, #818CF8)",
          boxShadow: "0 0 6px rgba(129,140,248,0.3)",
        }} />
      </div>

      <p className="text-xs text-[#8B98B8] mb-3 leading-relaxed">{rec.reason}</p>

      <div className="flex items-center gap-3 text-xs">
        <span className={`flex items-center gap-1 ${rec.prerequisitesMet ? "text-emerald-400" : "text-amber-400"}`}>
          {rec.prerequisitesMet ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
          {rec.prerequisitesMet ? "Prerequisites met" : "Check prerequisites"}
        </span>
        {rec.ucApproved && <span className="text-[#4A5578]">UC/CSU approved</span>}
        <span className="text-[#4A5578]">{rec.track}</span>
      </div>
    </div>
  );
}
