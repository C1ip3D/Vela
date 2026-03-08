"use client";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { Badge } from "@/components/ui/Badge";
import { useCanvasCourses } from "@/hooks/useCanvasCourses";
import { useAuth } from "@/contexts/AuthContext";
import { useCanvas } from "@/contexts/CanvasContext";
import { ChevronRight, Clock } from "lucide-react";

function gradeColor(grade: number): string {
  if (grade >= 90) return "text-emerald-400";
  if (grade >= 80) return "text-[#A5B4FC]";
  if (grade >= 70) return "text-amber-400";
  return "text-rose-400";
}

export default function CoursesPage() {
  const { user } = useAuth();
  const { isConnected } = useCanvas();
  const { courses, loading } = useCanvasCourses();
  const displayName = user?.displayName || "Student";

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="My Grades" studentName={displayName} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-[#818CF8]/30 border-t-[#818CF8] animate-spin" />
            <p className="text-sm text-[#8B98B8]">Loading courses{isConnected ? " from Canvas" : ""}...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="My Grades" studentName={displayName} />
      <div className="flex-1 p-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          {courses.map((course, i) => {
            const hasGrade = course.currentGrade != null;
            return (
              <Link href={`/courses/${course.id}`} key={course.id} className="block">
                <div
                  className="animate-fade-in group flex items-center justify-between rounded-xl border border-[#1C2A45]/60 bg-[#101828]/50 backdrop-blur-sm px-8 py-7 hover:border-[#253A5E]/80 hover:bg-[#162032]/60 transition-all duration-300 cursor-pointer"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {/* Left: course info */}
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2.5 mb-2">
                      <p className="text-lg font-medium text-[#E8ECFF] truncate">{course.name}</p>
                      {course.courseType !== "STANDARD" && (
                        <Badge variant={course.courseType === "AP" ? "ap" : "honors"} className="shrink-0">
                          {course.courseType}
                        </Badge>
                      )}
                    </div>
                    <p className="flex items-center gap-1.5 text-sm text-[#4A5578]">
                      <Clock size={12} />
                      {course.courseCode}
                    </p>
                  </div>

                  {/* Right: grade + chevron */}
                  <div className="flex items-center gap-4 shrink-0">
                    {hasGrade ? (
                      <span className={`font-mono text-xl font-semibold ${gradeColor(course.currentGrade!)}`}>
                        {course.letterGrade} ({course.currentGrade!.toFixed(2)}%)
                      </span>
                    ) : (
                      <span className="text-base text-[#4A5578]">No grade</span>
                    )}
                    <ChevronRight size={20} className="text-[#4A5578] group-hover:text-[#818CF8] transition-colors duration-300" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
