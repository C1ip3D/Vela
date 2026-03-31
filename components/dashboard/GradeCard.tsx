"use client";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { gradeColor } from "@/lib/utils";
import { AlertTriangle, Sparkles, Minus } from "lucide-react";

interface Props {
  id: string;
  name: string;
  courseCode: string;
  courseType: string;
  currentGrade: number | null;
  letterGrade: string | null;
  missingCount: number;
  weekDelta?: number;
}

export function GradeCard({ id, name, courseCode, courseType, currentGrade, letterGrade, missingCount, weekDelta }: Props) {
  const hasGrade = currentGrade != null;
  const grade = currentGrade ?? 0;
  const isCritical = hasGrade && (missingCount >= 3 || grade < 70);
  const isWarning = hasGrade && (missingCount >= 1 || grade < 80);

  const accentGradient = !hasGrade
    ? "from-[#4A5578] to-[#8B98B8]"
    : grade >= 90
      ? "from-[#818CF8] to-[#A5B4FC]"
      : grade >= 80
        ? "from-[#6366F1] to-[#818CF8]"
        : grade >= 70
          ? "from-[#F59E0B] to-[#FCD34D]"
          : "from-[#F43F5E] to-[#FB7185]";

  const barGradient = !hasGrade
    ? "linear-gradient(to right, #4A5578, #8B98B8)"
    : grade >= 90
      ? "linear-gradient(to right, #818CF8, #A5B4FC)"
      : grade >= 80
        ? "linear-gradient(to right, #6366F1, #818CF8)"
        : grade >= 70
          ? "linear-gradient(to right, #F59E0B, #FCD34D)"
          : "linear-gradient(to right, #F43F5E, #FB7185)";

  return (
    <Link href={`/courses/${id}`}>
      <Card className={`group cursor-pointer p-4 h-full flex flex-col hover:border-[#253A5E] hover:-translate-y-1 hover:shadow-card-hover transition-all duration-300 ${isCritical ? "border-l-2 border-l-rose-500/70" : isWarning ? "border-l-2 border-l-amber-400/50" : ""}`}
        glow={isCritical ? "critical" : undefined}>

        {/* Subtle nebula accent per card */}
        <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-[#818CF8]/[0.03] blur-2xl group-hover:bg-[#818CF8]/[0.06] transition-all duration-500" />

        {/* Header */}
        <div className="relative mb-3 flex items-start justify-between min-h-[3.75rem]">
          <div className="flex-1">
            <p className="text-base font-medium text-[#E8ECFF] leading-tight line-clamp-3">{name}</p>
          </div>
          {courseType !== "STANDARD" && (
            <Badge variant={courseType === "AP" ? "ap" : "honors"} className="ml-2 shrink-0">{courseType}</Badge>
          )}
        </div>

        {/* Grade display */}
        <div className="relative mb-3 flex items-end justify-between min-h-[44px]">
          {hasGrade ? (
            <>
              <span className={`font-mono text-4xl font-bold bg-gradient-to-r ${accentGradient} bg-clip-text text-transparent`}>{letterGrade}</span>
              <span className="font-mono text-2xl text-[#A5B4FC]/80">{grade.toFixed(1)}%</span>
            </>
          ) : (
            <div className="w-full flex items-center justify-center">
              <span className="font-mono text-2xl font-semibold text-[#4A5578]/70">
                No Grade
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[#1C2A45]/60">
          {hasGrade ? (
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${grade}%`,
                background: barGradient,
                boxShadow: `0 0 8px ${grade >= 80 ? "rgba(129,140,248,0.3)" : grade >= 70 ? "rgba(245,158,11,0.3)" : "rgba(244,63,94,0.3)"}`,
              }}
            />
          ) : (
            <div className="h-full w-0 rounded-full" />
          )}
        </div>

        {/* Status row - pushed to bottom */}
        <div className="relative mt-auto flex items-center justify-between text-sm min-h-[20px]">
          <div className="flex items-center gap-2">
            {missingCount > 0 && (
              <span className="flex items-center gap-1 text-amber-400/90">
                <AlertTriangle size={10} /> {missingCount} missing
              </span>
            )}
            {weekDelta !== undefined && (
              <span className={weekDelta >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {weekDelta >= 0 ? "↑" : "↓"} {Math.abs(weekDelta).toFixed(1)} this week
              </span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
