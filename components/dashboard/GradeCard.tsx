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
  teacher?: string | null;
}

export function GradeCard({ id, name, courseCode, courseType, currentGrade, letterGrade, missingCount, weekDelta, teacher }: Props) {
  const hasGrade = currentGrade != null;
  const grade = currentGrade ?? 0;
  const isCritical = hasGrade && (missingCount >= 3 || grade < 70);
  const isWarning = hasGrade && (missingCount >= 1 || grade < 80);

  const gradeTextColor = hasGrade ? "text-emerald-400" : "text-[#4A5578]";

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
            {teacher && <p className="text-xs text-[#8B98B8] mt-0.5 truncate">{teacher}</p>}
          </div>
        </div>

        {/* Grade display */}
        <div className="relative mb-3 flex items-end justify-between min-h-[44px]">
          {hasGrade ? (
            <>
              <span className={`font-mono text-4xl font-bold ${gradeTextColor}`}>{grade.toFixed(1)}%</span>
            </>
          ) : (
            <div className="w-full flex items-center justify-center">
              <span className="font-mono text-2xl font-semibold text-[#4A5578]/70">
                No Grade
              </span>
            </div>
          )}
        </div>

        {/* Status row - pushed to bottom */}
        {/* <div className="relative mt-auto flex items-center justify-between text-sm min-h-[20px]">
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
        </div> */}
      </Card>
    </Link>
  );
}
