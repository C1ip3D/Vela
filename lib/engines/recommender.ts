import catalog from "@/data/district_course_catalog.json";

interface CatalogCourse {
  id: string;
  name: string;
  department: string;
  agCategory: string | null;
  courseType: string;
  gradeLevel: number[];
  credits: number;
  prerequisites: string[];
  recommendedGrade?: string;
  tracks: string[];
  ucApproved: boolean;
  nextCourses: string[];
}

interface StudentProfile {
  completedCourseIds: string[];
  currentGrade?: number;
  currentCourseIds: string[];
  gradeLevel: number;
  courseGrades: Record<string, { letter: string; percentage: number }>;
}

export interface Recommendation {
  catalogCourseId: string;
  courseName: string;
  department: string;
  track: string;
  reason: string;
  prerequisitesMet: boolean;
  confidenceScore: number;
  courseType: string;
  ucApproved: boolean;
  isRequired?: boolean;
}

// Required subjects that must be filled per grade level.
// Each entry is a display label + the departments that satisfy it.
export const REQUIRED_SLOTS: Record<number, Array<{ label: string; departments: string[] }>> = {
  9: [
    { label: "English",             departments: ["English"] },
    { label: "Mathematics",         departments: ["Mathematics"] },
    { label: "Science (Biology)",   departments: ["Science"] },
    { label: "Physical Education",  departments: ["Physical Education"] },
    { label: "Health",              departments: ["Health"] },
  ],
  10: [
    { label: "English",             departments: ["English"] },
    { label: "Mathematics",         departments: ["Mathematics"] },
    { label: "Science",             departments: ["Science"] },
    { label: "World History",       departments: ["History Social Science"] },
  ],
  11: [
    { label: "English",             departments: ["English"] },
    { label: "Mathematics",         departments: ["Mathematics"] },
    { label: "Science",             departments: ["Science"] },
    { label: "US History",          departments: ["History Social Science"] },
  ],
  12: [
    { label: "English",             departments: ["English"] },
    { label: "Mathematics",         departments: ["Mathematics"] },
    { label: "Gov & Econ (semester courses)", departments: ["History Social Science"] },
    // Art and PE are conditional — handled as soft requirements in the AI prompt
  ],
};

export const MAX_COURSES_PER_YEAR = 6;

const GRADE_ORDER = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"];

function gradeGte(earned: string, required: string): boolean {
  return GRADE_ORDER.indexOf(earned) <= GRADE_ORDER.indexOf(required);
}

/** Supports "COURSE_A|COURSE_B" OR syntax in prerequisites */
function prereqsMet(prerequisites: string[], allCompleted: Set<string>): boolean {
  return prerequisites.every((p) => {
    if (p.includes("|")) {
      return p.split("|").some((alt) => allCompleted.has(alt));
    }
    return allCompleted.has(p);
  });
}

export function getRecommendations(profile: StudentProfile): Recommendation[] {
  const courses = (catalog as { courses: CatalogCourse[] }).courses;
  const allCompleted = new Set([...profile.completedCourseIds, ...profile.currentCourseIds]);
  const nextGrade = profile.gradeLevel + 1;
  const requiredSlots = REQUIRED_SLOTS[nextGrade] ?? REQUIRED_SLOTS[12];
  const electiveSlots = MAX_COURSES_PER_YEAR - requiredSlots.length;

  const results: Recommendation[] = [];

  for (const course of courses) {
    // Skip already taken
    if (allCompleted.has(course.id)) continue;

    // Must be offered at next grade level
    if (!course.gradeLevel.includes(nextGrade) && !course.gradeLevel.includes(profile.gradeLevel)) continue;

    // Skip if this course has been superseded — i.e., any of its nextCourses are already done
    const superseded = course.nextCourses.some((next) => allCompleted.has(next));
    if (superseded) continue;

    // Check prerequisites (supports OR syntax "A|B")
    const metPrereqs = prereqsMet(course.prerequisites, allCompleted);
    if (!metPrereqs) continue;

    // Check recommended grade on prerequisite courses
    let gradeOk = true;
    let gradeNote = "";
    if (course.recommendedGrade) {
      const lastPrereq = course.prerequisites
        .map((p) => (p.includes("|") ? p.split("|").find((alt) => allCompleted.has(alt)) ?? "" : p))
        .find((p) => p && profile.courseGrades[p]);
      if (lastPrereq && profile.courseGrades[lastPrereq]) {
        const earned = profile.courseGrades[lastPrereq].letter;
        gradeOk = gradeGte(earned, course.recommendedGrade);
        if (!gradeOk) gradeNote = ` Note: ${course.recommendedGrade}+ recommended in prerequisite (you earned ${earned}).`;
      }
    }

    let confidence = 0.5;
    if (course.courseType === "AP")     confidence += 0.15;
    else if (course.courseType === "HONORS") confidence += 0.08;
    if (course.ucApproved)  confidence += 0.10;
    if (gradeOk)            confidence += 0.15;
    else                    confidence -= 0.20;

    const reasons: string[] = [];
    if (course.courseType === "AP" || course.courseType === "HONORS") reasons.push("Weighted GPA boost.");
    if (metPrereqs && gradeOk) reasons.push("All prerequisites met.");
    if (gradeNote) reasons.push(gradeNote);
    if (reasons.length === 0) reasons.push("Eligible next step in this subject area.");

    results.push({
      catalogCourseId: course.id,
      courseName: course.name,
      department: course.department,
      track: course.tracks[0] ?? "GENERAL",
      reason: reasons.join(" "),
      prerequisitesMet: metPrereqs,
      confidenceScore: Math.round(Math.min(Math.max(confidence, 0), 1) * 100) / 100,
      courseType: course.courseType,
      ucApproved: course.ucApproved,
    });
  }

  const sorted = results.sort((a, b) => b.confidenceScore - a.confidenceScore);

  // Separate required-subject candidates from pure electives
  const requiredRecs: Recommendation[] = [];
  const usedDepts = new Set<string>();

  for (const slot of requiredSlots) {
    const match = sorted.find(
      (r) => slot.departments.includes(r.department) && !usedDepts.has(r.department)
    );
    if (match) {
      requiredRecs.push({ ...match, isRequired: true });
      usedDepts.add(match.department);
    }
  }

  // Fill remaining slots with electives (different department from required picks)
  const electives = sorted
    .filter((r) => !requiredRecs.find((rr) => rr.catalogCourseId === r.catalogCourseId))
    .slice(0, electiveSlots);

  return [...requiredRecs, ...electives];
}
