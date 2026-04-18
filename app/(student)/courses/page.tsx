"use client";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { useCourses } from "@/hooks/useCourses";
import { useAuth } from "@/contexts/AuthContext";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { ChevronRight, Clock, AlertTriangle } from "lucide-react";

function gradeColor(_grade: number): string {
  return "text-emerald-400";
}

export default function CoursesPage() {
  const { user } = useAuth();
  const { isConnected } = useIC();
  const { courses, loading } = useCourses();
  const displayName = user?.displayName || "Student";

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-[#818CF8]/30 border-t-[#818CF8] animate-spin" />
            <p className="text-sm text-[#8B98B8]">
              Loading courses{isConnected ? " from Infinite Campus" : ""}...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 px-4">
            <p className="text-lg text-[#E8ECFF]">Connect Infinite Campus to view your grades</p>
            <p className="text-sm text-[#8B98B8]">Go to Settings and sign in with your IC credentials.</p>
            <Link href="/settings"
              className="inline-block mt-3 rounded-lg bg-[#818CF8] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#6366F1] transition-colors">
              Go to Settings
            </Link>
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
          {courses.length === 0 && (
            <div className="text-center py-16 text-[#4A5578]">
              <p className="text-lg">No courses found</p>
              <p className="text-sm mt-1">Your Infinite Campus account may not have any active courses this term.</p>
            </div>
          )}
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
                    </div>
                    <p className="flex items-center gap-1.5 text-sm text-[#4A5578]">
                      <Clock size={12} />
                      {course.courseCode}
                      {course.period && <span className="ml-1 text-[#4A5578]">· Period {course.period}</span>}
                      {course.missingCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400 ml-1">
                          <AlertTriangle size={10} /> {course.missingCount} missing
                        </span>
                      )}
                    </p>
                    {course.teacher && (
                      <p className="text-xs text-[#4A5578] mt-1">{course.teacher}</p>
                    )}
                  </div>

                  {/* Right: grade + chevron */}
                  <div className="flex items-center gap-4 shrink-0">
                    {hasGrade ? (
                      <span className={`font-mono text-xl font-semibold ${gradeColor(course.currentGrade!)}`}>
                        {course.currentGrade!.toFixed(2)}%
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
