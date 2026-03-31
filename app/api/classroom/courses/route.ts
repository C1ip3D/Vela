// app/api/classroom/courses/route.ts
// Proxies to the Google Classroom API and returns a normalized course list.
// POST { token: string } → { courses: NormalizedCourse[] }

import { NextRequest, NextResponse } from "next/server";
import { classroomClient, ClassroomCourse } from "@/lib/classroom/client";

function scoreToLetter(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const rawCourses: ClassroomCourse[] = await classroomClient.getCourses(token);

    // Normalize each course into the same shape as Canvas courses
    const normalized = rawCourses.map((c: ClassroomCourse) => ({
      id: c.id,                          // Google Classroom courseId
      name: c.name,
      courseCode: c.section ?? c.id,     // Classroom has no course code — use section or id
      term: "Current",                   // Classroom has no term concept
      courseType: "STANDARD",
      creditHours: 1,
      apBoost: 0,
      currentGrade: null,                // Grade is computed client-side from submissions + weight templates
      letterGrade: null,
      missingCount: 0,
      source: "CLASSROOM",
      hasWeights: false,                 // Will be set by the client after fetching templates
    }));

    return NextResponse.json({ courses: normalized });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[classroom/courses]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
