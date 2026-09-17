import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractUid } from "@vela/auth";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export interface StudyOrderItem {
  course: string;
  hours: number;
  reason: string;
}

export interface FinalsAdvisorResponse {
  studyOrder: StudyOrderItem[];
  summary: string | null;
}

interface RankedCourse {
  id: string;
  name: string;
  courseType: string;
  currentGrade: number;
  maxAchievableGrade: number;
  maxGradeImprovement: number;
  finalWeightPct: number;
  gpaMultiplier: number;
  priority: number;
}

interface TimeBudget {
  days: number;
  hoursPerDay: number;
}

function buildStudyCoachPrompt(
  rankedCourses: RankedCourse[],
  timeBudget: TimeBudget
): string {
  const totalHours = timeBudget.days * timeBudget.hoursPerDay;
  const courseList = rankedCourses
    .map(
      (c, i) =>
        `${i + 1}. ${c.name} (${c.courseType}): currently ${c.currentGrade.toFixed(1)}%, ` +
        `max achievable ${c.maxAchievableGrade.toFixed(1)}% if you ace the final ` +
        `(${(c.finalWeightPct * 100).toFixed(0)}% of grade, GPA multiplier ${c.gpaMultiplier}x). ` +
        `Priority score: ${c.priority.toFixed(3)}.`
    )
    .join("\n");

  return `You are Kepler, the Vela study coach. A student has ${timeBudget.days} day${timeBudget.days !== 1 ? "s" : ""} until finals with ${timeBudget.hoursPerDay} hour${timeBudget.hoursPerDay !== 1 ? "s" : ""} per day (${totalHours} total hours).

Their courses are ranked by GPA impact (highest priority first):
${courseList}

Create an optimal study plan. Allocate the ${totalHours} total hours across courses based on priority and GPA impact. Higher-priority courses (especially AP/Honors with big finals) should get more time.

Return a JSON object matching this exact schema:
{
  "studyOrder": [
    { "course": "<course name>", "hours": <number>, "reason": "<one sentence: current grade, what acing the final does for GPA>" }
  ],
  "summary": "<2-3 sentences: day-by-day plan, which courses today vs tomorrow>"
}

Rules:
- Total hours in studyOrder must equal ${totalHours}
- Use whole numbers for hours (round where needed)
- Keep each reason under 15 words
- Only include courses from the list above
- If a course has very low priority (improvement < 1%), you may omit it and reallocate hours`;
}

const FALLBACK: FinalsAdvisorResponse = { studyOrder: [], summary: null };

async function callGemini(
  rankedCourses: RankedCourse[],
  timeBudget: TimeBudget
): Promise<FinalsAdvisorResponse> {
  const model = genAI.getGenerativeModel(
    {
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    },
    { apiVersion: "v1beta" }
  );

  const prompt = buildStudyCoachPrompt(rankedCourses, timeBudget);
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const parsed: FinalsAdvisorResponse = JSON.parse(text);
  if (!Array.isArray(parsed.studyOrder)) throw new Error("invalid schema");
  return parsed;
}

export async function POST(req: NextRequest) {
  const uid = extractUid(req.headers.get("authorization"));
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rankedCourses: RankedCourse[];
  let timeBudget: TimeBudget;
  try {
    const body = await req.json();
    rankedCourses = body.rankedCourses;
    timeBudget = body.timeBudget;
    if (!Array.isArray(rankedCourses) || !timeBudget?.days || !timeBudget?.hoursPerDay) {
      return NextResponse.json({ error: "Missing rankedCourses or timeBudget" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (rankedCourses.length === 0) {
    return NextResponse.json(FALLBACK);
  }

  // Up to 2 attempts; on parse failure fall back to empty response rather than crashing
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await callGemini(rankedCourses, timeBudget);
      return NextResponse.json(result);
    } catch (err) {
      if (attempt === 2) {
        console.error("[ADVISOR_FINALS] Gemini failed after 2 attempts:", err);
        return NextResponse.json(FALLBACK);
      }
    }
  }

  return NextResponse.json(FALLBACK);
}
