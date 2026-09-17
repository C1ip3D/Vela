"use client";
import { useEffect } from "react";
import { GpaHeroCard } from "@/components/dashboard/GpaHeroCard";
import { GradeCard } from "@/components/dashboard/GradeCard";
import { useCourses } from "@/hooks/useCourses";
import { useIC } from "@/contexts/InfiniteCampusContext";

export default function DashboardPage() {
  const { isConnected } = useIC();
  const { courses, loading, gpa, gpaHistory } = useCourses();

  const totalMissing = courses.reduce((sum, c) => sum + c.missingCount, 0);
  const gradedCourses = courses.filter((c) => c.currentGrade != null);
  const avgGrade =
    gradedCourses.length > 0
      ? gradedCourses.reduce((s, c) => s + c.currentGrade!, 0) /
        gradedCourses.length
      : null;

  // Save grade snapshot for future notification diffing
  useEffect(() => {
    if (loading || !courses.length) return;
    const snapshot: Record<string, number> = {};
    courses.forEach((c) => {
      if (c.currentGrade != null) snapshot[c.id] = c.currentGrade;
    });
    localStorage.setItem("vela_grade_snapshot", JSON.stringify(snapshot));
  }, [loading, courses]);

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

  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="flex-1 p-6 space-y-6">
        {/* GPA Hero */}
        <div className="animate-fade-in" style={{ animationDelay: "40ms" }}>
          <GpaHeroCard
            gpa={gpa.unweighted}
            termGpa={gpa.weighted}
            termLabel="Weighted GPA"
            history={gpaHistory}
          />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[
            {
              label: "Enrolled Courses",
              value: courses.length.toString(),
              icon: "◈",
            },
            {
              label: "Missing Assignments",
              value: totalMissing.toString(),
              warn: totalMissing > 0,
              icon: "△",
            },
            {
              label: "AVG Grade",
              value: avgGrade != null ? avgGrade.toFixed(2) + "%" : "N/A",
              icon: "✦",
            },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="animate-fade-in rounded-xl border border-[#1C2A45]/60 bg-[#101828]/50 backdrop-blur-sm p-4 hover:border-[#253A5E]/80 transition-all duration-300 group"
              style={{ animationDelay: `${180 + i * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-[#8B98B8] uppercase tracking-[0.15em]">
                  {stat.label}
                </p>
                <span className="text-[#4A5578] text-sm group-hover:text-[#818CF8] transition-colors">
                  {stat.icon}
                </span>
              </div>
              <p
                className={`font-mono text-3xl font-bold ${stat.warn ? "text-amber-400" : "text-[#E8ECFF]"}`}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Course grid */}
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#8B98B8]">
            Current Courses
          </h2>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(350px,1fr))]">
            {courses.map((course, i) => (
              <div
                key={course.id}
                className="animate-fade-in h-full"
                style={{ animationDelay: `${480 + i * 90}ms` }}
              >
                <GradeCard
                  id={course.id}
                  name={course.name}
                  courseCode={course.courseCode}
                  courseType={course.courseType}
                  currentGrade={course.currentGrade}
                  letterGrade={course.letterGrade}
                  missingCount={course.missingCount}
                  teacher={course.teacher}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
