"use client";
import { useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { GpaHeroCard } from "@/components/dashboard/GpaHeroCard";
import { GradeCard } from "@/components/dashboard/GradeCard";
import { AdvisorFeed } from "@/components/dashboard/AdvisorFeed";
import { useCourses } from "@/hooks/useCourses";
import { useAuth } from "@/contexts/AuthContext";
import { useIC } from "@/contexts/InfiniteCampusContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const { isConnected } = useIC();
  const { courses, loading, gpa } = useCourses();
  const history: { date: string; term: number; gpa: number }[] = [];
  const logs: { id: string; isRead: boolean; logType: string; severity: string; title: string; body: unknown; createdAt: string }[] = [];

  const alertCount = logs.filter((l) => !l.isRead).length;
  const unreadLogs = logs.filter((l) => !l.isRead);
  const totalMissing = courses.reduce((sum, c) => sum + c.missingCount, 0);

  const displayName = user?.displayName || "Student";

  // Save grade snapshot for future notification diffing
  useEffect(() => {
    if (loading || !courses.length) return;
    const snapshot: Record<string, number> = {};
    courses.forEach((c) => { if (c.currentGrade != null) snapshot[c.id] = c.currentGrade; });
    localStorage.setItem("vela_grade_snapshot", JSON.stringify(snapshot));
  }, [loading, courses]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="Dashboard" studentName={displayName} />
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
      <TopBar title="Dashboard" studentName={displayName} />
      <div className="flex-1 p-6 space-y-6">
        {/* GPA Hero */}
        <div className="animate-fade-in" style={{ animationDelay: "0ms" }}>
          <GpaHeroCard
            gpa={gpa.unweighted}
            termGpa={gpa.weighted}
            termLabel="Weighted GPA"
            termDelta={gpa.weighted - 3.95}
            history={history}
          />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[
            { label: "Enrolled Courses", value: courses.length.toString(), icon: "◈" },
            { label: "Cumulative GPA", value: gpa.unweighted.toFixed(2), icon: "✦" },
            { label: "Missing Assignments", value: totalMissing.toString(), warn: totalMissing > 0, icon: "△" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="animate-fade-in rounded-xl border border-[#1C2A45]/60 bg-[#101828]/50 backdrop-blur-sm p-4 hover:border-[#253A5E]/80 transition-all duration-300 group"
              style={{ animationDelay: `${(i + 1) * 80}ms` }}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-[#8B98B8] uppercase tracking-[0.15em]">{stat.label}</p>
                <span className="text-[#4A5578] text-sm group-hover:text-[#818CF8] transition-colors">{stat.icon}</span>
              </div>
              <p className={`font-mono text-3xl font-bold ${stat.warn ? "text-amber-400" : "text-[#E8ECFF]"}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Course grid */}
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#8B98B8]">Current Courses</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {courses.map((course, i) => (
              <div key={course.id} className="animate-fade-in h-full" style={{ animationDelay: `${(i + 5) * 60}ms` }}>
                <GradeCard
                  id={course.id}
                  name={course.name}
                  courseCode={course.courseCode}
                  courseType={course.courseType}
                  currentGrade={course.currentGrade}
                  letterGrade={course.letterGrade}
                  missingCount={course.missingCount}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
