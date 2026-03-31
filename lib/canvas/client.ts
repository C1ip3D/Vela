// lib/canvas/client.ts
// Wraps Canvas LMS REST API. Falls back to mock data when CANVAS_BASE_URL is not set.

export interface CanvasCourse {
  id: string;
  name: string;
  course_code: string;
  enrollment_term_id: number;
  enrollments?: Array<{ computed_current_score: number | null; computed_current_grade: string | null }>;
}

export interface CanvasAssignment {
  id: string;
  course_id: string;
  name: string;
  points_possible: number;
  due_at: string | null;
  published: boolean;
  assignment_group_id: string;
}

export interface CanvasSubmission {
  id: string;
  assignment_id: string;
  user_id: string;
  score: number | null;
  late: boolean;
  missing: boolean;
  excused: boolean;
  graded_at: string | null;
  submitted_at: string | null;
}

export interface CanvasAssignmentGroup {
  id: string;
  course_id: string;
  name: string;
  group_weight: number;
  rules: { drop_lowest?: number };
}

const BASE = process.env.CANVAS_BASE_URL ?? "";
const TOKEN = process.env.CANVAS_TOKEN ?? "";

async function canvasGet<T>(path: string): Promise<T> {
  if (!BASE) throw new Error("CANVAS_BASE_URL not configured");
  const res = await fetch(`${BASE}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Canvas API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export const canvasClient = {
  getCourses: (userId: string) =>
    canvasGet<CanvasCourse[]>(`/users/${userId}/courses?include[]=total_scores&enrollment_state=active&per_page=50`),

  getAssignments: (courseId: string) =>
    canvasGet<CanvasAssignment[]>(`/courses/${courseId}/assignments?per_page=100`),

  getSubmissions: (courseId: string, userId: string) =>
    canvasGet<CanvasSubmission[]>(`/courses/${courseId}/students/submissions?student_ids[]=${userId}&per_page=100`),

  getAssignmentGroups: (courseId: string) =>
    canvasGet<CanvasAssignmentGroup[]>(`/courses/${courseId}/assignment_groups?include[]=assignments`),
};

// ── Mock data ──────────────────────────────────────────────────────────────
// Used when CANVAS_BASE_URL is not configured (dev/demo mode)

export function getMockCourses() {
  return [
    { id: "c1", name: "AP Calculus BC", courseCode: "MATH165", term: "Spring 2026", courseType: "AP", creditHours: 1, apBoost: 1.0, currentGrade: 91.4, letterGrade: "A-", missingCount: 0 },
    { id: "c2", name: "AP English Literature", courseCode: "ENG12AP", term: "Spring 2026", courseType: "AP", creditHours: 1, apBoost: 1.0, currentGrade: 88.2, letterGrade: "B+", missingCount: 1 },
    { id: "c3", name: "AP Biology", courseCode: "SCI200AP", term: "Spring 2026", courseType: "AP", creditHours: 1, apBoost: 1.0, currentGrade: 84.7, letterGrade: "B", missingCount: 2 },
    { id: "c4", name: "AP US History", courseCode: "SS120AP", term: "Spring 2026", courseType: "AP", creditHours: 1, apBoost: 1.0, currentGrade: 79.5, letterGrade: "C+", missingCount: 1 },
    { id: "c5", name: "Spanish 4 Honors", courseCode: "SPAN4H", term: "Spring 2026", courseType: "HONORS", creditHours: 1, apBoost: 0.5, currentGrade: 94.1, letterGrade: "A", missingCount: 0 },
    { id: "c6", name: "AP Computer Science A", courseCode: "CS210AP", term: "Spring 2026", courseType: "AP", creditHours: 1, apBoost: 1.0, currentGrade: 96.3, letterGrade: "A+", missingCount: 0 },
  ];
}

export function getMockAssignments(courseId: string) {
  const categoryMap: Record<string, { categories: Array<{ id: string; name: string; weight: number }> }> = {
    c1: { categories: [{ id: "cat1", name: "Tests", weight: 0.60 }, { id: "cat2", name: "Homework", weight: 0.25 }, { id: "cat3", name: "Quizzes", weight: 0.15 }] },
    c2: { categories: [{ id: "cat1", name: "Essays", weight: 0.50 }, { id: "cat2", name: "Reading", weight: 0.30 }, { id: "cat3", name: "Participation", weight: 0.20 }] },
    c3: { categories: [{ id: "cat1", name: "Labs", weight: 0.40 }, { id: "cat2", name: "Tests", weight: 0.45 }, { id: "cat3", name: "Homework", weight: 0.15 }] },
    c4: { categories: [{ id: "cat1", name: "Essays", weight: 0.40 }, { id: "cat2", name: "Tests", weight: 0.45 }, { id: "cat3", name: "Participation", weight: 0.15 }] },
    c5: { categories: [{ id: "cat1", name: "Tests", weight: 0.50 }, { id: "cat2", name: "Speaking", weight: 0.30 }, { id: "cat3", name: "Homework", weight: 0.20 }] },
    c6: { categories: [{ id: "cat1", name: "Projects", weight: 0.50 }, { id: "cat2", name: "Labs", weight: 0.35 }, { id: "cat3", name: "Homework", weight: 0.15 }] },
  };
  const cats = categoryMap[courseId]?.categories ?? categoryMap.c1.categories;
  const assignmentsByCategory = [
    { title: "Unit 1 Test", pts: 100, score: 88, catIdx: 0, dueDate: "2026-01-15", missing: false, late: false },
    { title: "Homework Set 1", pts: 20, score: 20, catIdx: 1, dueDate: "2026-01-10", missing: false, late: false },
    { title: "Quiz 1", pts: 25, score: 22, catIdx: 2, dueDate: "2026-01-12", missing: false, late: false },
    { title: "Unit 2 Test", pts: 100, score: 91, catIdx: 0, dueDate: "2026-02-05", missing: false, late: false },
    { title: "Homework Set 2", pts: 20, score: 18, catIdx: 1, dueDate: "2026-01-28", missing: false, late: false },
    { title: "Quiz 2", pts: 25, score: null, catIdx: 2, dueDate: "2026-02-03", missing: true, late: false },
    { title: "Midterm Exam", pts: 150, score: 132, catIdx: 0, dueDate: "2026-02-20", missing: false, late: false },
    { title: "Homework Set 3", pts: 20, score: 20, catIdx: 1, dueDate: "2026-02-15", missing: false, late: false },
    { title: "Quiz 3", pts: 25, score: 21, catIdx: 2, dueDate: "2026-02-18", missing: false, late: false },
    { title: "Homework Set 4", pts: 20, score: null, catIdx: 1, dueDate: "2026-03-01", missing: true, late: false },
    { title: "Unit 3 Test", pts: 100, score: 86, catIdx: 0, dueDate: "2026-03-10", missing: false, late: false },
  ];
  return {
    categories: cats,
    assignments: assignmentsByCategory.map((a, i) => ({
      id: `${courseId}-a${i}`,
      courseId,
      title: a.title,
      pointsPossible: a.pts,
      dueDate: a.dueDate,
      weightCategory: cats[a.catIdx],
      submission: {
        score: a.score,
        missing: a.missing,
        late: a.late,
        excused: false,
        gradedAt: a.score !== null ? "2026-01-20" : null,
      },
    })),
  };
}

export function getMockGpaHistory() {
  return [
    { date: "Sep 2025", term: 3.60, gpa: 3.60 },
    { date: "Oct 2025", term: 3.65, gpa: 3.65 },
    { date: "Nov 2025", term: 3.55, gpa: 3.55 },
    { date: "Dec 2025", term: 3.50, gpa: 3.50 },
    { date: "Jan 2026", term: 3.70, gpa: 3.70 },
    { date: "Feb 2026", term: 3.72, gpa: 3.72 },
    { date: "Mar 2026", term: 3.62, gpa: 3.62 },
  ];
}

export function getMockAdvisorLogs() {
  return [
    {
      id: "log1",
      logType: "GPA_DROP_ALERT",
      severity: "CRITICAL",
      title: "GPA dropped 0.20 points in 2 weeks",
      body: { fromGpa: 4.15, toGpa: 3.95, dropAmount: 0.20, window: "14 days", coursesAffected: ["AP US History", "AP Biology"] },
      isRead: false,
      createdAt: "2026-03-05T10:00:00Z",
    },
    {
      id: "log2",
      logType: "MISSING_ASSIGNMENT_ALERT",
      severity: "WARNING",
      title: "4 missing assignments in 30 days",
      body: { missingCount: 4, totalActive: 18, missingRate: 0.22, courses: [{ name: "AP US History", count: 2 }, { name: "AP Biology", count: 2 }] },
      isRead: false,
      createdAt: "2026-03-04T08:00:00Z",
    },
    {
      id: "log3",
      logType: "COURSE_RECOMMENDATION",
      severity: "INFO",
      title: "Course recommendations ready for next term",
      body: { count: 5, topTrack: "STEM / Engineering" },
      isRead: true,
      createdAt: "2026-02-28T12:00:00Z",
    },
  ];
}

export function getMockRecommendations(courses: any[]) {
  const hasCourse = (name: string) => courses.some(c => c.name.toLowerCase().includes(name.toLowerCase()));

  const recs = [];

  // STEM / Engineering Path
  if (hasCourse("Calculus AB")) {
    recs.push({ catalogCourseId: "MATHBC", courseName: "AP Calculus BC", track: "STEM", reason: "Natural transition from Calc AB. Your current performance suggests readiness for the BC curriculum.", prerequisitesMet: true, confidenceScore: 0.98 });
  }
  if (hasCourse("Biology") || hasCourse("Chemistry")) {
    recs.push({ catalogCourseId: "PHYSC", courseName: "AP Physics C", track: "STEM", reason: "Strong science foundation. Physics C leverages your Calculus skills for engineering tracks.", prerequisitesMet: true, confidenceScore: 0.92 });
  }

  // Humanities / Arts
  if (hasCourse("English") || hasCourse("History")) {
    recs.push({ catalogCourseId: "APLIT", courseName: "AP English Literature", track: "Humanities", reason: "Continue your advanced humanities track to strengthen college writing profiles.", prerequisitesMet: true, confidenceScore: 0.85 });
  }

  // Interdisciplinary
  if (hasCourse("Seminar")) {
    recs.push({ catalogCourseId: "APRES", courseName: "AP Research", track: "Academic", reason: "Prerequisite AP Seminar completed. This completes the AP Capstone Diploma requirement.", prerequisitesMet: true, confidenceScore: 0.99 });
  }

  // Computer Science & Data
  if (hasCourse("Comp Sci") || hasCourse("Computer Science")) {
    recs.push({ catalogCourseId: "APCSA", courseName: "AP Computer Science A", track: "STEM", reason: "Deepen your programming logic with Java if you've already explored Principles.", prerequisitesMet: true, confidenceScore: 0.88 });
  }

  // Social Sciences
  if (hasCourse("History") || hasCourse("Civics")) {
    recs.push({ catalogCourseId: "APGOV", courseName: "AP US Government", track: "Social Science", reason: "Broaden your understanding of political systems and policy-making.", prerequisitesMet: true, confidenceScore: 0.82 });
  }

  // Fallbacks to reach 6
  const fallbacks = [
    { catalogCourseId: "APST", courseName: "AP Statistics", track: "STEM/Business", reason: "Gain essential data analysis skills applicable to almost any university field.", prerequisitesMet: true, confidenceScore: 0.78 },
    { catalogCourseId: "APECON", courseName: "AP Macroeconomics", track: "Business", reason: "Understand global financial systems. Complements a strong math/humanities profile.", prerequisitesMet: true, confidenceScore: 0.75 },
    { catalogCourseId: "APPSY", courseName: "AP Psychology", track: "Social Science", reason: "A popular and rigorous elective providing insight into human behavior.", prerequisitesMet: true, confidenceScore: 0.84 },
    { catalogCourseId: "APENV", courseName: "AP Environmental Science", track: "Science", reason: "Interdisciplinary science exploring human impact on the natural world.", prerequisitesMet: true, confidenceScore: 0.81 }
  ];

  for (const f of fallbacks) {
    if (recs.length < 6 && !recs.find(r => r.courseName === f.courseName)) {
      recs.push(f);
    }
  }

  return recs.slice(0, 6);
}

export function getMockStudent() {
  return {
    id: "user1",
    displayName: "Alex Chen",
    email: "alex.chen@dublin.k12.ca.us",
    role: "STUDENT",
    cumulativeGpa: 3.72,
    termGpa: { gpa: 3.62, label: "Spring 2026" },
    totalCredits: 120,
    missingAssignments: 4,
  };
}

export function getMockCounselorStudents() {
  return [
    { id: "user1", displayName: "Alex Chen", gpa: 3.95, risk: "medium", missingCount: 4, alerts: 2 },
    { id: "user2", displayName: "Priya Sharma", gpa: 4.20, risk: "low", missingCount: 0, alerts: 0 },
    { id: "user3", displayName: "Marcus Lee", gpa: 2.85, risk: "high", missingCount: 8, alerts: 3 },
    { id: "user4", displayName: "Sofia Nguyen", gpa: 3.60, risk: "low", missingCount: 1, alerts: 0 },
    { id: "user5", displayName: "Jordan Park", gpa: 3.10, risk: "medium", missingCount: 3, alerts: 1 },
  ];
}
