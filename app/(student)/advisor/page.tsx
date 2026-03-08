"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { RecommendationCard } from "@/components/advisor/RecommendationCard";
import { AdvisorChatbot } from "@/components/advisor/AdvisorChatbot";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { useCanvasCourses } from "@/hooks/useCanvasCourses";
import { useAuth } from "@/contexts/AuthContext";
import { buildStudentProfile } from "@/lib/utils/courseMapping";
import { Sparkles, Loader2 } from "lucide-react";

interface PathwayData {
  pathway?: string;
  pathwayConfidence?: number;
  rigorLevel?: string;
  notes?: string;
}

interface Recommendation {
  catalogCourseId: string;
  courseName: string;
  department: string;
  track: string;
  reason: string;
  prerequisitesMet: boolean;
  confidenceScore: number;
  courseType: string;
  ucApproved: boolean;
  pathwayScore?: number;
}

export default function AdvisorPage() {
  const { user } = useAuth();
  const { courses } = useCanvasCourses();
  const displayName = user?.displayName || "Student";
  const [gradeLevel, setGradeLevel] = useState(11);
  useEffect(() => {
    const saved = localStorage.getItem("vela_student_grade");
    if (saved) setGradeLevel(parseInt(saved));
  }, []);

  const [pathway, setPathway] = useState<PathwayData>({});
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [aiEnhanced, setAiEnhanced] = useState(false);

  // Build course context for Kepler — memoized so it doesn't recreate on every render
  const courseContext = useMemo(() => courses.map(c => ({
    name: c.name,
    grade: c.currentGrade || 0,
    letterGrade: c.letterGrade || "N/A",
    missingCount: c.missingCount,
    courseType: c.courseType || "Regular",
  })), [courses]);

  // Build a profile mapping Canvas course names → catalog IDs, with inferred completed prereqs
  const studentCatalogProfile = useMemo(
    () => buildStudentProfile(courses),
    [courses]
  );

  const fetchRecommendations = useCallback(async (pathwayData: PathwayData) => {
    setRecsLoading(true);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathway: pathwayData.pathway,
          rigorLevel: pathwayData.rigorLevel,
          pathwayNotes: pathwayData.notes,
          currentCourses: courseContext,
          studentProfile: {
            completedCourseIds: studentCatalogProfile.completedCourseIds,
            currentCourseIds: studentCatalogProfile.currentCourseIds,
            gradeLevel,
            courseGrades: studentCatalogProfile.courseGrades,
          },
        }),
      });
      const data = await res.json();
      if (data.recommendations) {
        setRecs(data.recommendations);
        setAiEnhanced(data.aiEnhanced ?? false);
      }
    } catch (err) {
      console.error("Failed to fetch recommendations", err);
    } finally {
      setRecsLoading(false);
    }
  }, [courseContext, studentCatalogProfile, gradeLevel]);

  // Initial load (no pathway yet)
  useEffect(() => {
    if (courses.length > 0 && recs.length === 0) {
      fetchRecommendations({});
    }
  }, [courses.length]);

  // When Kepler discovers or refines the pathway, re-fetch recommendations
  const handlePathwayUpdate = useCallback((data: PathwayData) => {
    setPathway(prev => {
      const updated = { ...prev, ...data };
      const hasConfidence = !!(data.pathway && (data.pathwayConfidence ?? 0) >= 0.6);
      // Re-fetch whenever any meaningful field changes — not just the pathway name
      const changed =
        data.pathway !== prev.pathway ||
        data.rigorLevel !== prev.rigorLevel ||
        data.notes !== prev.notes;
      if (hasConfidence && changed) {
        fetchRecommendations(updated);
      }
      return updated;
    });
  }, [fetchRecommendations]);

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Kepler" studentName={displayName} />
      <div className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">

          {/* Left column: Recommendations */}
          <div className="space-y-5 lg:col-span-2">

            {/* Pathway badge */}
            {pathway.pathway && (
              <div className="animate-fade-in flex items-center gap-2 rounded-lg border border-[#818CF8]/20 bg-[#818CF8]/10 px-4 py-2.5">
                <Sparkles size={14} className="text-[#A5B4FC] shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-[#A5B4FC]">{pathway.pathway}</p>
                  {pathway.rigorLevel && (
                    <p className="text-[11px] text-[#8B98B8] capitalize">Rigor: {pathway.rigorLevel}</p>
                  )}
                </div>
                {aiEnhanced && (
                  <span className="ml-auto text-[10px] text-[#818CF8] border border-[#818CF8]/30 rounded-full px-2 py-0.5">AI‑ranked</span>
                )}
              </div>
            )}

            <CollapsibleSection
              title="Course Recommendations"
              count={recs.length}
              defaultOpen={true}
            >
              <p className="text-xs text-[#4A5578] mb-2 font-medium">
                {pathway.pathway
                  ? `Courses aligned with your ${pathway.pathway} pathway — next grade level, prerequisites verified.`
                  : "Suggested courses for next term based on your DUSD catalog eligibility. Tell Kepler your goals for personalized picks."}
              </p>

              {recsLoading ? (
                <div className="flex items-center gap-2 py-4 text-xs text-[#8B98B8]">
                  <Loader2 size={14} className="animate-spin text-[#818CF8]" />
                  {pathway.pathway ? `Finding best courses for ${pathway.pathway}...` : "Loading recommendations..."}
                </div>
              ) : (
                recs.map((rec, i) => (
                  <div key={rec.catalogCourseId} className="animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                    <RecommendationCard rec={rec} />
                  </div>
                ))
              )}
            </CollapsibleSection>
          </div>

          {/* Right column: Kepler chatbot */}
          <div className="lg:col-span-3 lg:sticky lg:top-6 lg:self-start">
            <AdvisorChatbot
              courses={courseContext}
              studentName={displayName}
              gradeLevel={gradeLevel}
              onPathwayUpdate={handlePathwayUpdate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
