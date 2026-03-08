import { NextResponse } from "next/server";
import { getMockCourses } from "@/lib/canvas/client";
export async function GET() {
  const courses = getMockCourses();
  return NextResponse.json({ courses });
}
