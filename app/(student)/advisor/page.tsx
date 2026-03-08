"use client";
import { useState, useEffect, useMemo } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { AdvisorChatbot } from "@/components/advisor/AdvisorChatbot";
import { useCanvasCourses } from "@/hooks/useCanvasCourses";
import { useAuth } from "@/contexts/AuthContext";

export default function AdvisorPage() {
  const { user } = useAuth();
  const { courses } = useCanvasCourses();
  const displayName = user?.displayName || "Student";
  const [gradeLevel, setGradeLevel] = useState(11);
  useEffect(() => {
    const saved = localStorage.getItem("vela_student_grade");
    if (saved) setGradeLevel(parseInt(saved));
  }, []);

  const courseContext = useMemo(() => courses.map(c => ({
    name: c.name,
    grade: c.currentGrade || 0,
    letterGrade: c.letterGrade || "N/A",
    missingCount: c.missingCount,
    courseType: c.courseType || "Regular",
  })), [courses]);

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Kepler" studentName={displayName} />
      <div className="flex-1 min-h-0 p-6">
        <AdvisorChatbot
          courses={courseContext}
          studentName={displayName}
          gradeLevel={gradeLevel}
          onPathwayUpdate={() => {}}
        />
      </div>
    </div>
  );
}
