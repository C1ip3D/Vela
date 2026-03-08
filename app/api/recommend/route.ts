import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getRecommendations, REQUIRED_SLOTS, MAX_COURSES_PER_YEAR } from "@/lib/engines/recommender";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

interface CourseGrade {
  name: string;
  grade: number;
  letterGrade: string;
  courseType: string;
}

interface RecommendBody {
  studentProfile?: {
    completedCourseIds: string[];
    currentCourseIds: string[];
    gradeLevel: number;
    courseGrades: Record<string, { letter: string; percentage: number }>;
  };
  pathway?: string;
  rigorLevel?: string;
  pathwayNotes?: string;
  currentCourses?: CourseGrade[];
}

// GET — simple mock fallback (no profile, no AI)
export async function GET() {
  const { getMockRecommendations } = await import("@/lib/canvas/client");
  return NextResponse.json({ recommendations: getMockRecommendations([]) });
}

// POST — full catalog matching + AI ranking
export async function POST(req: Request) {
  try {
    const body: RecommendBody = await req.json();
    const { studentProfile, pathway, rigorLevel, pathwayNotes, currentCourses = [] } = body;

    const gradeLevel = studentProfile?.gradeLevel ?? 10;
    const nextGrade = gradeLevel + 1;

    // 1. Catalog-based recommendations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let catalogRecs: any[] = [];
    if (studentProfile) {
      catalogRecs = getRecommendations(studentProfile);
    } else {
      const { getMockRecommendations } = await import("@/lib/canvas/client");
      catalogRecs = getMockRecommendations(currentCourses);
    }

    // 2. If no API key, return catalog recs as-is (no AI)
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ recommendations: catalogRecs, aiEnhanced: false });
    }

    // 3. Determine rigor from grades
    const avgGrade = currentCourses.length > 0
      ? currentCourses.reduce((s, c) => s + c.grade, 0) / currentCourses.length
      : 85;
    const computedRigor = rigorLevel || (avgGrade >= 90 ? "high" : avgGrade >= 80 ? "moderate" : "standard");

    // 4. Build required subjects context for the AI
    const slots = REQUIRED_SLOTS[nextGrade] ?? REQUIRED_SLOTS[12];
    const requiredSubjectsText = slots.map((s) => `• ${s.label}`).join("\n");

    // Identify which of the catalog recs are flagged as required vs elective
    const requiredRecs = catalogRecs.filter((r: any) => r.isRequired);
    const electiveRecs = catalogRecs.filter((r: any) => !r.isRequired);
    const electiveSlots = MAX_COURSES_PER_YEAR - requiredRecs.length;

    const coursesSummary = currentCourses.map(c => `${c.name} (${c.courseType}): ${c.letterGrade} ${c.grade.toFixed(1)}%`).join(", ");

    // Separate required vs elective in the summary sent to AI
    const requiredSummary = requiredRecs.map((r: any, i: number) =>
      `R${i + 1}. ${r.courseName} (${r.courseType}, ${r.department}) [REQUIRED SLOT]`
    ).join("\n");

    const electiveSummary = electiveRecs.map((r: any, i: number) =>
      `E${i + 1}. ${r.courseName} (${r.courseType}, ${r.department}) — catalog score: ${r.confidenceScore}`
    ).join("\n");

    // Build prompt — works with or without a specific pathway
    const pathwayContext = pathway
      ? `Student pathway/career interest: ${pathway}\n${pathwayNotes ? `Additional context from advisor chat: ${pathwayNotes}` : ""}`
      : `No career pathway identified yet. Rank courses based on the student's current grades, course history, and academic performance. Favor courses that build on their strongest subjects, maintain appropriate rigor for their GPA, and keep college options open.`;

    const prompt = `You are a high school academic counselor AI for Dublin USD (DUSD). A student needs course recommendations for Grade ${nextGrade}.

${pathwayContext}
Rigor level appropriate for student: ${computedRigor} (based on average grade: ${avgGrade.toFixed(1)}%)
Current courses: ${coursesSummary || "not provided"}

## CRITICAL SCHEDULING RULES
- Maximum courses per year: ${MAX_COURSES_PER_YEAR}
- Required courses for Grade ${nextGrade} (${requiredRecs.length} slots already reserved):
${requiredSubjectsText}
- Remaining elective/pathway slots: ${electiveSlots}
- NEVER recommend a course the student is already taking or has completed
- Summer school is available — if a student needs a prerequisite they haven't taken, note it could be completed over summer

## Required courses (already pre-selected by the system, do NOT re-rank these):
${requiredSummary || "None identified"}

## Elective/pathway courses to rank (pick the BEST ${electiveSlots} for this student):
${electiveSummary}

Rank the elective courses from most to least recommended. Select up to ${electiveSlots} courses. For each, provide a 1-2 sentence reason referencing the student's grades, course history, or career readiness. If a prerequisite course might be doable over summer, mention it.

Return ONLY a JSON array (no markdown, no extra text) using the "E#" indices:
[
  {"index": "E1", "reason": "...", "pathwayScore": 0.95},
  {"index": "E2", "reason": "...", "pathwayScore": 0.88},
  ...
]

Where "index" matches the E# label above, "reason" is the explanation, and "pathwayScore" is your 0-1 score for fit.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }, { apiVersion: "v1beta" });
    const result = await model.generateContent(prompt);
    const rawText = result.response.text();

    let aiRankings: Array<{ index: string; reason: string; pathwayScore: number }> = [];
    try {
      aiRankings = JSON.parse(rawText.trim());
    } catch {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        try { aiRankings = JSON.parse(match[0]); } catch {}
      }
    }

    // Map E# indices back to elective recs
    const rankedElectives = aiRankings
      .map((r) => {
        const idx = parseInt(r.index.replace("E", ""), 10) - 1;
        if (idx < 0 || idx >= electiveRecs.length) return null;
        return {
          ...electiveRecs[idx],
          reason: r.reason,
          confidenceScore: Math.round(
            (electiveRecs[idx].confidenceScore * 0.4 + r.pathwayScore * 0.6) * 100
          ) / 100,
          pathwayScore: r.pathwayScore,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.confidenceScore - a.confidenceScore)
      .slice(0, electiveSlots);

    // Combine required + ranked electives, capped at MAX_COURSES_PER_YEAR
    const enhanced = [
      ...requiredRecs,
      ...(rankedElectives.length >= 1 ? rankedElectives : electiveRecs.slice(0, electiveSlots)),
    ].slice(0, MAX_COURSES_PER_YEAR);

    const finalRecs = enhanced.length >= 2 ? enhanced : catalogRecs.slice(0, MAX_COURSES_PER_YEAR);

    return NextResponse.json({ recommendations: finalRecs, aiEnhanced: rankedElectives.length >= 1 });
  } catch (err: any) {
    console.error("[RECOMMEND_POST]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
