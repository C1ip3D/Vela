import { NextResponse } from "next/server";
import { getMockCourses, getMockGpaHistory, getMockStudent } from "@/lib/canvas/client";
import { calculateGpa } from "@/lib/engines/gpa";

export async function GET() {
  const courses = getMockCourses();
  const student = getMockStudent();
  const history = getMockGpaHistory();

  const gpa = calculateGpa(courses.map((c) => ({
    courseId: c.id, courseName: c.name,
    percentage: c.currentGrade, courseType: c.courseType, creditHours: c.creditHours,
  })));

  return NextResponse.json({ gpa, student, history });
}
