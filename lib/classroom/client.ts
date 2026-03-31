// lib/classroom/client.ts
// Wraps the Google Classroom REST API v1.
// Falls back to mock data when no access token is present (demo mode).

const CLASSROOM_BASE = "https://classroom.googleapis.com/v1";

// ── API Response Types ─────────────────────────────────────────────────────

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  description?: string;
  courseState: "ACTIVE" | "ARCHIVED" | "PROVISIONED" | "DECLINED";
  enrollmentCode?: string;
  alternateLink?: string;
}

export interface ClassroomCourseWorkDueDate {
  year: number;
  month: number;
  day: number;
}

export interface ClassroomCourseWork {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  maxPoints?: number;
  dueDate?: ClassroomCourseWorkDueDate;
  state: "PUBLISHED" | "DRAFT" | "DELETED";
  workType: "ASSIGNMENT" | "SHORT_ANSWER_QUESTION" | "MULTIPLE_CHOICE_QUESTION";
  alternateLink?: string;
  creationTime?: string;
  updateTime?: string;
}

export interface ClassroomStudentSubmission {
  id: string;
  courseId: string;
  courseWorkId: string;
  userId: string;
  state: "NEW" | "CREATED" | "TURNED_IN" | "RETURNED" | "RECLAIMED_BY_STUDENT";
  late?: boolean;
  assignedGrade?: number;    // points earned (null = ungraded)
  draftGrade?: number;
  alternateLink?: string;
  submissionHistory?: Array<{ gradeHistory?: { gradeTimestamp?: string } }>;
}

// ── Fetch Helper ───────────────────────────────────────────────────────────

async function classroomGet<T>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${CLASSROOM_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Classroom API ${res.status}: ${path} — ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── API Client ─────────────────────────────────────────────────────────────

export const classroomClient = {
  /** List all active courses the user is enrolled in or teaches. */
  getCourses: async (accessToken: string): Promise<ClassroomCourse[]> => {
    const data = await classroomGet<{ courses?: ClassroomCourse[] }>(
      "/courses",
      accessToken,
      { courseStates: "ACTIVE", pageSize: "50" }
    );
    return data.courses ?? [];
  },

  /** List all published courseWork items for a course. */
  getCourseWork: async (
    courseId: string,
    accessToken: string
  ): Promise<ClassroomCourseWork[]> => {
    const data = await classroomGet<{ courseWork?: ClassroomCourseWork[] }>(
      `/courses/${courseId}/courseWork`,
      accessToken,
      { courseWorkStates: "PUBLISHED", pageSize: "100" }
    );
    return data.courseWork ?? [];
  },

  /** List this student's own submissions across all courseWork in a course. */
  getSubmissions: async (
    courseId: string,
    accessToken: string
  ): Promise<ClassroomStudentSubmission[]> => {
    const data = await classroomGet<{
      studentSubmissions?: ClassroomStudentSubmission[];
    }>(
      `/courses/${courseId}/courseWork/-/studentSubmissions`,
      accessToken,
      { userId: "me", pageSize: "100" }
    );
    return data.studentSubmissions ?? [];
  },
};

// ── Mock Data (demo / dev mode) ────────────────────────────────────────────

export function getMockClassroomCourses() {
  return [
    {
      id: "gc1",
      name: "Pre-Calculus",
      courseCode: "MATH110",
      term: "Spring 2026",
      courseType: "STANDARD",
      creditHours: 1,
      apBoost: 0,
      currentGrade: 87.5,
      letterGrade: "B+",
      missingCount: 1,
      source: "CLASSROOM" as const,
      hasWeights: true,
    },
    {
      id: "gc2",
      name: "World Literature",
      courseCode: "ENG11",
      term: "Spring 2026",
      courseType: "HONORS",
      creditHours: 1,
      apBoost: 0.5,
      currentGrade: 92.1,
      letterGrade: "A-",
      missingCount: 0,
      source: "CLASSROOM" as const,
      hasWeights: true,
    },
    {
      id: "gc3",
      name: "Chemistry",
      courseCode: "SCI150",
      term: "Spring 2026",
      courseType: "STANDARD",
      creditHours: 1,
      apBoost: 0,
      currentGrade: null,
      letterGrade: null,
      missingCount: 0,
      source: "CLASSROOM" as const,
      hasWeights: false, // prompts weight setup
    },
  ];
}

export function getMockClassroomAssignments(courseId: string) {
  const defaultCategories = [
    { id: "gcat1", name: "Tests", weight: 0.6 },
    { id: "gcat2", name: "Homework", weight: 0.25 },
    { id: "gcat3", name: "Participation", weight: 0.15 },
  ];

  const assignmentData = [
    { title: "Chapter 1 Test", pts: 100, score: 82, catIdx: 0, dueDate: "2026-01-16", missing: false, late: false },
    { title: "Homework 1", pts: 30, score: 28, catIdx: 1, dueDate: "2026-01-11", missing: false, late: false },
    { title: "Chapter 2 Test", pts: 100, score: 90, catIdx: 0, dueDate: "2026-02-06", missing: false, late: false },
    { title: "Homework 2", pts: 30, score: 25, catIdx: 1, dueDate: "2026-01-29", missing: false, late: false },
    { title: "Midterm", pts: 150, score: 128, catIdx: 0, dueDate: "2026-02-21", missing: false, late: false },
    { title: "Homework 3", pts: 30, score: null, catIdx: 1, dueDate: "2026-03-01", missing: true, late: false },
    { title: "Daily Participation", pts: 20, score: 18, catIdx: 2, dueDate: "2026-03-10", missing: false, late: false },
  ];

  return {
    categories: defaultCategories,
    assignments: assignmentData.map((a, i) => ({
      id: `${courseId}-ga${i}`,
      courseId,
      title: a.title,
      pointsPossible: a.pts,
      dueDate: a.dueDate,
      weightCategory: defaultCategories[a.catIdx],
      submission: {
        score: a.score,
        missing: a.missing,
        late: a.late,
        excused: false,
        gradedAt: a.score !== null ? "2026-01-20" : null,
      },
      source: "CLASSROOM" as const,
    })),
  };
}

export function getMockClassroomWeightPresets() {
  return [
    {
      id: "preset1",
      name: "Standard (Tests 60/HW 40)",
      categories: [
        { name: "Tests", weight: 0.6, dropLowest: 0 },
        { name: "Homework", weight: 0.4, dropLowest: 1 },
      ],
    },
    {
      id: "preset2",
      name: "Science Lab Heavy",
      categories: [
        { name: "Labs", weight: 0.4 , dropLowest: 0 },
        { name: "Tests", weight: 0.45, dropLowest: 0 },
        { name: "Homework", weight: 0.15, dropLowest: 0 },
      ],
    },
    {
      id: "preset3",
      name: "Humanities",
      categories: [
        { name: "Essays", weight: 0.5, dropLowest: 0 },
        { name: "Reading Responses", weight: 0.3, dropLowest: 0 },
        { name: "Participation", weight: 0.2, dropLowest: 0 },
      ],
    },
  ];
}
