import type { ICAssignment, ICAssignmentGroup, ICCourse } from "./types";

// Infinite Campus's undocumented APIs return differently-shaped JSON per
// district and IC version. These parsers hunt through the response
// recursively rather than assuming one fixed shape.

function detectCourseType(name: string): string {
  const u = name.toUpperCase();
  if (u.includes("AP ") || u.includes("ADVANCED PLACEMENT")) return "AP";
  if (u.includes("HONORS") || u.includes("HON ") || u.includes("(H)") || u.includes("(HP)")) return "HONORS";
  return "STANDARD";
}

function extractCoursesRecursive(obj: any, found: any[] = []): any[] {
  if (!obj || typeof obj !== "object") return found;
  const isCourse =
    typeof obj.courseName === "string" ||
    typeof obj.courseNumber === "string" ||
    (typeof obj.name === "string" && (obj.teacherDisplay || obj.roomID || obj.sectionID));
  if (isCourse) {
    found.push(obj);
  } else if (Array.isArray(obj)) {
    for (const item of obj) extractCoursesRecursive(item, found);
  } else {
    for (const key of Object.keys(obj)) extractCoursesRecursive(obj[key], found);
  }
  return found;
}

function extractTerm(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // Academic year: Aug–Jul
  const startYear = month >= 8 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

export function parseCoursesResilient(data: any): ICCourse[] {
  const rawCourses = extractCoursesRecursive(data);
  const coursesMap = new Map<string, ICCourse>();

  for (const cs of rawCourses) {
    const name = cs.courseName ?? cs.name ?? "Unknown Course";
    const code = cs.courseNumber ?? cs.code ?? cs.number ?? "";
    const id = String(cs.courseSectionID ?? cs.sectionID ?? cs.id ?? code ?? Math.random());

    let currentGrade: number | null = null;
    let letterGrade: string | null = null;
    let missingCount = 0;
    const assignmentsMap = new Map<string, ICAssignment>();

    function findGrades(node: any) {
      if (!node || typeof node !== "object") return;
      const score = node.score ?? node.percent ?? node.grade?.percent ?? node.currentGrade?.percent ?? node.progressPercent ?? node.progressScore;
      const letter = node.gradeCalculated ?? node.grade?.letter ?? node.letter ?? node.currentGrade?.letter ?? node.progressGrade;
      if (score != null && !isNaN(Number(score))) {
        currentGrade = parseFloat(score);
        if (letter) letterGrade = letter;
      }
      const assignmentList = node.assignments ?? node.tasks ?? node.gradebookEntries ?? node.items;
      if (Array.isArray(assignmentList)) {
        for (const a of assignmentList) {
          const aName = a.assignmentName ?? a.name ?? a.title ?? "";
          if (!aName) continue;
          const aDue = a.dueDate ?? a.due ?? null;
          const aKey = String(a.assignmentID ?? a.id ?? `${id}_${aName}_${aDue ?? ""}`);
          const aScore = a.score != null && !isNaN(Number(a.score)) ? parseFloat(a.score) : null;
          const aMax = a.totalPoints ?? a.pointsPossible ?? a.maxScore ?? null;
          const isMissing =
            !!(a.missing ?? a.isMissing) ||
            (typeof a.turnInStatus === "string" && a.turnInStatus.toUpperCase() === "MISSING") ||
            (typeof a.status === "string" && a.status.toUpperCase() === "MISSING") ||
            a.scoreMarkingCode === "M" ||
            (Array.isArray(a.flags) && a.flags.some((f: unknown) => typeof f === "string" && f.toUpperCase() === "MISSING"));
          if (isMissing) missingCount += 1;
          assignmentsMap.set(aKey, {
            key: aKey,
            name: aName,
            score: aScore,
            maxScore: aMax != null && !isNaN(Number(aMax)) ? parseFloat(aMax) : null,
            dueDate: aDue ? String(aDue) : undefined,
          });
        }
      }
      if (Array.isArray(node)) {
        for (const item of node) findGrades(item);
      } else if (typeof node === "object") {
        for (const key of Object.keys(node)) {
          if (key === "postingPeriods" || key === "terms" || key === "gradingTasks" || Array.isArray(node[key])) {
            findGrades(node[key]);
          }
        }
      }
    }

    findGrades(cs);

    const assignments = Array.from(assignmentsMap.values());
    const existing = coursesMap.get(id);
    if (!existing || (!existing.currentGrade && currentGrade)) {
      coursesMap.set(id, {
        id,
        name,
        courseCode: code,
        term: cs.calendarName ?? cs.termName ?? cs.term ?? extractTerm(),
        courseType: detectCourseType(name),
        currentGrade,
        letterGrade,
        missingCount,
        teacher: cs.teacherDisplay ?? cs.teacher ?? cs.teacherName ?? cs.staffDisplayName ?? cs.instructorName ?? null,
        period: cs.sectionNumber ?? cs.period ?? null,
        assignments,
      });
    } else {
      existing.missingCount += missingCount;
      if (!existing.currentGrade && currentGrade) {
        existing.currentGrade = currentGrade;
        existing.letterGrade = letterGrade;
      }
      for (const a of assignments) {
        if (!existing.assignments.some((ea) => ea.key === a.key)) {
          existing.assignments.push(a);
        }
      }
    }
  }

  return Array.from(coursesMap.values());
}

// ── Assignment group parsing ──────────────────────────────────────────────────

function currentSemesterStart(): Date {
  const now = new Date();
  const month = now.getMonth();
  if (month >= 7) return new Date(now.getFullYear(), 7, 1);
  return new Date(now.getFullYear(), 0, 1);
}

export function filterToCurrentSemester(groups: ICAssignmentGroup[]): ICAssignmentGroup[] {
  const cutoff = currentSemesterStart();
  return groups
    .map((g) => ({
      ...g,
      assignments: g.assignments.filter((a) => {
        if (!a.dueAt) return true;
        return new Date(a.dueAt) >= cutoff;
      }),
    }))
    .filter((g) => g.assignments.length > 0);
}

export function parsePrismAssignments(data: any): ICAssignmentGroup[] {
  const categories: any[] = data?.data ?? data?.categories ?? [];
  return categories.map((cat: any, i: number) => {
    const assignments: any[] = cat?.assignments ?? [];
    return {
      id: String(cat?.categoryID ?? cat?.id ?? i),
      name: cat?.categoryName ?? cat?.name ?? `Category ${i + 1}`,
      weight: parseFloat(cat?.weight ?? 0) || 0,
      score: cat?.score?.percent != null ? parseFloat(cat.score.percent) : null,
      assignments: assignments.map((a: any, j: number) => ({
        id: String(a?.assignmentID ?? a?.id ?? j),
        name: a?.assignmentName ?? a?.name ?? "Assignment",
        pointsPossible: parseFloat(a?.totalPoints ?? a?.pointsPossible ?? 0),
        score: a?.score?.points != null ? parseFloat(a.score.points) : null,
        grade: a?.score?.percent != null ? `${parseFloat(a.score.percent).toFixed(2)}%` : null,
        submittedAt: a?.turnInDate ?? a?.submittedAt ?? null,
        missing: !!(a?.missing ?? a?.isMissing),
        late: !!(a?.late ?? a?.isLate),
        dueAt: a?.dueDate ?? a?.dueAt ?? null,
      })),
    };
  });
}

export function parseLegacyAssignments(data: any): ICAssignmentGroup[] {
  if (data?.details && Array.isArray(data.details)) {
    const categoryMap = new Map<string, ICAssignmentGroup>();
    data.details.forEach((detail: any) => {
      const cats = detail.categories ?? [];
      cats.forEach((cat: any) => {
        const id = String(cat.groupID ?? cat.id ?? cat.name);
        const assigns = cat.assignments ?? cat.Assignments ?? [];
        let group = categoryMap.get(id);
        if (!group) {
          group = {
            id,
            name: cat.name ?? cat.categoryName ?? "Category",
            weight: parseFloat(cat.weight ?? 0) || 0,
            score: null,
            assignments: [],
          };
          categoryMap.set(id, group);
        }
        assigns.forEach((a: any, j: number) => {
          group!.assignments.push({
            id: String(a?.assignmentID ?? a?.objectSectionID ?? a?.id ?? j),
            name: a?.assignmentName ?? a?.name ?? "Assignment",
            pointsPossible: parseFloat(a?.totalPoints ?? a?.pointsPossible ?? 0),
            score: a?.score != null ? parseFloat(a.score) : null,
            grade: a?.scorePercentage != null ? `${parseFloat(a.scorePercentage).toFixed(2)}%` : a?.percent != null ? `${parseFloat(a.percent).toFixed(2)}%` : null,
            submittedAt: a?.turnInDate ?? a?.scoreModifiedDate ?? null,
            missing: !!(a?.missing ?? a?.isMissing ?? false),
            late: !!(a?.late ?? a?.isLate ?? false),
            dueAt: a?.dueDate ?? null,
          });
        });
      });
    });
    const groups = Array.from(categoryMap.values());
    groups.forEach((g) => {
      g.assignments.sort((a, b) => {
        const dA = a.dueAt ? new Date(a.dueAt).getTime() : 0;
        const dB = b.dueAt ? new Date(b.dueAt).getTime() : 0;
        return dB - dA;
      });
    });
    return groups;
  }

  const tasks: any[] = data?.Task ?? data?.tasks ?? data?.GradingTask ?? [];
  return tasks.map((task: any, i: number) => {
    const assignments: any[] = task?.Assignments ?? task?.assignments ?? [];
    return {
      id: String(task?.taskID ?? task?.id ?? i),
      name: task?.taskName ?? task?.name ?? `Category ${i + 1}`,
      weight: parseFloat(task?.weight ?? 0) || 0,
      score: task?.score != null ? parseFloat(task.score) : null,
      assignments: assignments.map((a: any, j: number) => ({
        id: String(a?.assignmentID ?? a?.id ?? j),
        name: a?.assignmentName ?? a?.name ?? "Assignment",
        pointsPossible: parseFloat(a?.totalPoints ?? a?.pointsPossible ?? 0),
        score: a?.score != null ? parseFloat(a.score) : null,
        grade: a?.percent != null ? `${parseFloat(a.percent).toFixed(2)}%` : null,
        submittedAt: a?.turnInDate ?? null,
        missing: !!(a?.missing ?? a?.isMissing ?? false),
        late: !!(a?.late ?? a?.isLate ?? false),
        dueAt: a?.dueDate ?? null,
      })),
    };
  });
}

export function extractAssignmentsFromGrades(data: any, courseId: string): ICAssignmentGroup[] {
  const enrollments: any[] = Array.isArray(data) ? data : (data?.enrollments ?? data?.data ?? []);
  for (const enrollment of enrollments) {
    const terms: any[] = enrollment?.terms ?? [];
    for (const term of terms) {
      const courses: any[] = term?.courses ?? [];
      for (const course of courses) {
        const sid = String(course?.sectionID ?? "");
        const csid = String(course?.courseSectionID ?? "");
        const id = String(course?._id ?? "");
        const rid = String(course?.rosterID ?? "");
        if (sid !== courseId && csid !== courseId && id !== courseId && rid !== courseId) continue;

        const groups: ICAssignmentGroup[] = [];
        const gradingTasks: any[] = course?.gradingTasks ?? course?.GradingTask ?? course?.tasks ?? [];
        for (const task of gradingTasks) {
          const categories: any[] = task?.categories ?? task?.Categories ?? [];
          if (categories.length > 0) {
            for (const cat of categories) {
              const assignments: any[] = cat?.assignments ?? cat?.Assignments ?? [];
              groups.push({
                id: String(cat?.groupID ?? cat?.categoryID ?? cat?.id ?? cat?.name),
                name: cat?.name ?? cat?.categoryName ?? task?.taskName ?? "Category",
                weight: parseFloat(cat?.weight ?? task?.weight ?? 0) || 0,
                score: cat?.score != null ? parseFloat(cat.score) : null,
                assignments: assignments.map((a: any, j: number) => ({
                  id: String(a?.assignmentID ?? a?.objectSectionID ?? a?.id ?? j),
                  name: a?.assignmentName ?? a?.name ?? "Assignment",
                  pointsPossible: parseFloat(a?.totalPoints ?? a?.pointsPossible ?? 0),
                  score: a?.score != null ? parseFloat(a.score) : null,
                  grade: a?.scorePercentage != null ? `${parseFloat(a.scorePercentage).toFixed(2)}%` : a?.percent != null ? `${parseFloat(a.percent).toFixed(2)}%` : null,
                  submittedAt: a?.turnInDate ?? a?.scoreModifiedDate ?? null,
                  missing: !!(a?.missing ?? a?.isMissing ?? false),
                  late: !!(a?.late ?? a?.isLate ?? false),
                  dueAt: a?.dueDate ?? null,
                })),
              });
            }
          } else {
            const assignments: any[] = task?.assignments ?? task?.Assignments ?? [];
            groups.push({
              id: String(task?.taskID ?? task?.id ?? groups.length),
              name: task?.taskName ?? task?.name ?? "Assignments",
              weight: parseFloat(task?.weight ?? 0) || 0,
              score: task?.score != null ? parseFloat(task.score) : null,
              assignments: assignments.map((a: any, j: number) => ({
                id: String(a?.assignmentID ?? a?.objectSectionID ?? a?.id ?? j),
                name: a?.assignmentName ?? a?.name ?? "Assignment",
                pointsPossible: parseFloat(a?.totalPoints ?? a?.pointsPossible ?? 0),
                score: a?.score != null ? parseFloat(a.score) : null,
                grade: a?.scorePercentage != null ? `${parseFloat(a.scorePercentage).toFixed(2)}%` : a?.percent != null ? `${parseFloat(a.percent).toFixed(2)}%` : null,
                submittedAt: a?.turnInDate ?? null,
                missing: !!(a?.missing ?? a?.isMissing ?? false),
                late: !!(a?.late ?? a?.isLate ?? false),
                dueAt: a?.dueDate ?? null,
              })),
            });
          }
        }

        if (groups.length === 0) {
          const categories: any[] = course?.categories ?? course?.Categories ?? [];
          for (const cat of categories) {
            const assignments: any[] = cat?.assignments ?? cat?.Assignments ?? [];
            groups.push({
              id: String(cat?.groupID ?? cat?.categoryID ?? cat?.id ?? cat?.name),
              name: cat?.name ?? cat?.categoryName ?? "Category",
              weight: parseFloat(cat?.weight ?? 0) || 0,
              score: cat?.score != null ? parseFloat(cat.score) : null,
              assignments: assignments.map((a: any, j: number) => ({
                id: String(a?.assignmentID ?? a?.id ?? j),
                name: a?.assignmentName ?? a?.name ?? "Assignment",
                pointsPossible: parseFloat(a?.totalPoints ?? a?.pointsPossible ?? 0),
                score: a?.score != null ? parseFloat(a.score) : null,
                grade: a?.percent != null ? `${parseFloat(a.percent).toFixed(2)}%` : null,
                submittedAt: a?.turnInDate ?? null,
                missing: !!(a?.missing ?? a?.isMissing ?? false),
                late: !!(a?.late ?? a?.isLate ?? false),
                dueAt: a?.dueDate ?? null,
              })),
            });
          }
        }

        groups.forEach((g) => {
          g.assignments.sort((a, b) => {
            const dA = a.dueAt ? new Date(a.dueAt).getTime() : 0;
            const dB = b.dueAt ? new Date(b.dueAt).getTime() : 0;
            return dB - dA;
          });
        });

        return groups;
      }
    }
  }
  return [];
}
