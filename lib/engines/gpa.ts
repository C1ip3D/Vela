import { percentageToLetter, letterToGpaPoints } from "@/lib/utils";

export interface CourseGradeInput {
  courseId: string;
  courseName: string;
  percentage: number;
  courseType: string;
  creditHours: number;
}

export interface GpaResult {
  weighted: number;
  unweighted: number;
  breakdown: Array<{
    courseId: string;
    courseName: string;
    percentage: number;
    letter: string;
    weightedPoints: number;
    unweightedPoints: number;
    creditHours: number;
  }>;
}

export function calculateGpa(courses: CourseGradeInput[]): GpaResult {
  if (courses.length === 0) return { weighted: 0, unweighted: 0, breakdown: [] };

  let totalWeightedPoints = 0;
  let totalUnweightedPoints = 0;
  let totalCredits = 0;

  const breakdown = courses.map((c) => {
    const letter = percentageToLetter(c.percentage);
    const weightedPts = letterToGpaPoints(letter, c.courseType);
    const unweightedPts = letterToGpaPoints(letter, "STANDARD");

    totalWeightedPoints += weightedPts * c.creditHours;
    totalUnweightedPoints += unweightedPts * c.creditHours;
    totalCredits += c.creditHours;

    return {
      courseId: c.courseId,
      courseName: c.courseName,
      percentage: c.percentage,
      letter,
      weightedPoints: weightedPts,
      unweightedPoints: unweightedPts,
      creditHours: c.creditHours,
    };
  });

  return {
    weighted:   totalCredits > 0 ? Math.round((totalWeightedPoints / totalCredits) * 100) / 100 : 0,
    unweighted: totalCredits > 0 ? Math.round((totalUnweightedPoints / totalCredits) * 100) / 100 : 0,
    breakdown,
  };
}
