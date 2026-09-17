import { prisma } from "@vela/db";

export interface SyncableAssignment {
  key: string;
  name: string;
  score: number | null;
  maxScore: number | null;
  dueDate?: string;
}

export interface SyncableCourse {
  id: string;
  name: string;
  courseCode: string;
  term: string;
  courseType: string;
  currentGrade: number | null;
  letterGrade: string | null;
  missingCount: number;
  teacher?: string | null;
  period?: string | null;
  assignments?: SyncableAssignment[];
}

/**
 * Upserts the Firebase user, then upserts courses + enrollments from an IC fetch.
 * Records a GradeHistory snapshot only when grade actually changes.
 * Detects newly-graded assignments and logs them to the advisor feed.
 */
export async function syncICCoursesToDB(
  firebaseUid: string,
  email: string,
  displayName: string,
  courses: SyncableCourse[]
) {
  // 1. Upsert the user (keyed on Firebase UID stored in canvasUserId)
  const user = await prisma.user.upsert({
    where: { canvasUserId: firebaseUid },
    create: {
      canvasUserId: firebaseUid,
      email,
      displayName,
    },
    update: {
      email,
      displayName,
      updatedAt: new Date(),
    },
  });

  const now = new Date();

  // 2. Upsert each course and enrollment
  for (const c of courses) {
    const courseType = normalizeCourseType(c.courseType);

    const course = await prisma.course.upsert({
      where: { canvasCourseId: c.id },
      create: {
        canvasCourseId: c.id,
        externalId: c.id,
        name: c.name,
        courseCode: c.courseCode,
        term: c.term,
        courseType,
        teacher: c.teacher ?? null,
        source: "INFINITE_CAMPUS",
      },
      update: {
        name: c.name,
        courseCode: c.courseCode,
        term: c.term,
        courseType,
        teacher: c.teacher ?? null,
        updatedAt: now,
      },
    });

    const enrollId = `${user.id}_${course.id}`;
    await prisma.enrollment.upsert({
      where: { canvasEnrollId: enrollId },
      create: {
        canvasEnrollId: enrollId,
        userId: user.id,
        courseId: course.id,
        currentGrade: c.currentGrade,
        letterGrade: c.letterGrade,
        enrolledAt: now,
        isActive: true,
      },
      update: {
        currentGrade: c.currentGrade,
        letterGrade: c.letterGrade,
        isActive: true,
      },
    });

    // 3. Record a grade snapshot only when the grade actually changed
    if (c.currentGrade != null) {
      const prevHistory = await prisma.gradeHistory.findFirst({
        where: { userId: user.id, courseId: course.id },
        orderBy: { recordedAt: "desc" },
      });

      const gradeChanged =
        prevHistory === null ||
        Math.abs(prevHistory.percentageGrade - c.currentGrade) >= 0.01;

      if (gradeChanged) {
        await prisma.gradeHistory.create({
          data: {
            userId: user.id,
            courseId: course.id,
            percentageGrade: c.currentGrade,
            gpaPoints: gradeToGpaPoints(c.letterGrade ?? ""),
            letterGrade: c.letterGrade ?? "",
            missingCount: c.missingCount,
            recordedAt: now,
          },
        });

        // Log meaningful grade changes to the advisor feed
        if (prevHistory !== null && Math.abs(prevHistory.percentageGrade - c.currentGrade) >= 1) {
          await prisma.advisorLog.create({
            data: {
              userId: user.id,
              logType: "GRADE_ALERT",
              severity: c.currentGrade < prevHistory.percentageGrade ? "WARNING" : "INFO",
              title: `Grade updated in ${c.name}`,
              body: {
                courseName: c.name,
                newGrade: c.currentGrade,
                prevGrade: prevHistory.percentageGrade,
              },
              triggerData: { courseId: c.id },
            },
          });
        }
      }
    }

    // 4. Upsert assignment grades and notify on newly graded assignments
    if (c.assignments?.length) {
      for (const a of c.assignments) {
        const prev = await prisma.assignmentGrade.findUnique({
          where: {
            userId_courseId_assignmentKey: {
              userId: user.id,
              courseId: course.id,
              assignmentKey: a.key,
            },
          },
        });

        await prisma.assignmentGrade.upsert({
          where: {
            userId_courseId_assignmentKey: {
              userId: user.id,
              courseId: course.id,
              assignmentKey: a.key,
            },
          },
          create: {
            userId: user.id,
            courseId: course.id,
            assignmentKey: a.key,
            name: a.name,
            score: a.score,
            maxScore: a.maxScore,
            dueDate: a.dueDate,
            gradedAt: now,
          },
          update: {
            score: a.score,
            maxScore: a.maxScore,
            gradedAt: now,
          },
        });

        // Log to the advisor feed when an assignment transitions from ungraded to graded
        const wasUngraded = prev === null || prev.score === null;
        const isNowGraded = a.score !== null;
        if (wasUngraded && isNowGraded) {
          await prisma.advisorLog.create({
            data: {
              userId: user.id,
              logType: "ASSIGNMENT_GRADED",
              severity: "INFO",
              title: `Assignment graded in ${c.name}`,
              body: {
                courseName: c.name,
                assignmentName: a.name,
                score: a.score,
                maxScore: a.maxScore,
              },
              triggerData: { courseId: c.id, assignmentKey: a.key },
            },
          });
        }
      }
    }
  }

  // 5. Save a GPA snapshot when GPA changes meaningfully
  const gradedForGpa = courses.filter((c) => c.currentGrade != null);
  if (gradedForGpa.length > 0) {
    const computed = computeGpaFromSyncable(gradedForGpa);
    const lastSnap = await prisma.gpaSnapshot.findFirst({
      where: { userId: user.id },
      orderBy: { recordedAt: "desc" },
    });
    const changed =
      !lastSnap ||
      Math.abs(lastSnap.unweightedGpa - computed.unweighted) >= 0.01 ||
      Math.abs(lastSnap.weightedGpa - computed.weighted) >= 0.01;
    if (changed) {
      const term = gradedForGpa[0].term ?? "";
      await prisma.gpaSnapshot.create({
        data: {
          userId: user.id,
          unweightedGpa: computed.unweighted,
          weightedGpa: computed.weighted,
          cumulativeGpa: computed.unweighted,
          termGpa: computed.weighted,
          term,
          recordedAt: now,
        },
      });
    }
  }

  // Prune history older than 30 days, but only on Sundays to avoid running on every sync
  if (new Date().getDay() === 0) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await prisma.gradeHistory.deleteMany({
      where: { userId: user.id, recordedAt: { lt: thirtyDaysAgo } },
    });
  }

  return user;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Returns cached enrollments for a user from the DB.
 * Always returns data if it exists; isStale=true means a background refresh is warranted.
 * Returns null only if no enrollments are stored at all.
 */
export async function getCachedCourses(
  firebaseUid: string
): Promise<{ courses: SyncableCourse[]; isStale: boolean } | null> {
  const user = await prisma.user.findUnique({
    where: { canvasUserId: firebaseUid },
    include: {
      enrollments: {
        where: { isActive: true },
        include: { course: true },
        orderBy: { course: { name: "asc" } },
      },
    },
  });

  if (!user || user.enrollments.length === 0) return null;

  const mostRecent = await prisma.gradeHistory.findFirst({
    where: { userId: user.id },
    orderBy: { recordedAt: "desc" },
  });

  const isStale = !mostRecent || Date.now() - mostRecent.recordedAt.getTime() > CACHE_TTL_MS;

  const courseIds = user.enrollments.map((e) => e.courseId);
  const recentHistories = await prisma.gradeHistory.findMany({
    where: { userId: user.id, courseId: { in: courseIds } },
    orderBy: { recordedAt: "desc" },
    distinct: ["courseId"],
    select: { courseId: true, missingCount: true },
  });
  const missingMap = new Map(recentHistories.map((h) => [h.courseId, h.missingCount]));

  return {
    courses: user.enrollments.map((e) => ({
      id: e.course.externalId ?? e.course.canvasCourseId,
      name: e.course.name,
      courseCode: e.course.courseCode,
      term: e.course.term,
      courseType: e.course.courseType,
      currentGrade: e.currentGrade,
      letterGrade: e.letterGrade,
      missingCount: missingMap.get(e.courseId) ?? 0,
      teacher: e.course.teacher ?? null,
    })),
    isStale,
  };
}

function normalizeCourseType(type: string): "STANDARD" | "ADVANCED" | "HONORS" | "AP" | "DUAL_ENROLLMENT" {
  switch (type) {
    case "AP": return "AP";
    case "HONORS": return "HONORS";
    case "ADVANCED": return "ADVANCED";
    case "DUAL_ENROLLMENT": return "DUAL_ENROLLMENT";
    default: return "STANDARD";
  }
}

function syncScoreToLetter(score: number): string {
  if (score >= 89.5) return "A";
  if (score >= 79.5) return "B";
  if (score >= 69.5) return "C";
  if (score >= 59.5) return "D";
  return "F";
}

function computeGpaFromSyncable(courses: SyncableCourse[]): { unweighted: number; weighted: number } {
  let totalU = 0, totalW = 0;
  for (const c of courses) {
    const letter = c.letterGrade ?? syncScoreToLetter(c.currentGrade!);
    const base = gradeToGpaPoints(letter);
    totalU += base;
    const boost = c.courseType === "AP" || c.courseType === "HONORS" ? 1 : 0;
    totalW += base + boost;
  }
  return {
    unweighted: parseFloat((totalU / courses.length).toFixed(2)),
    weighted: parseFloat((totalW / courses.length).toFixed(2)),
  };
}

function gradeToGpaPoints(letter: string): number {
  const map: Record<string, number> = {
    "A+": 4, A: 4, "A-": 4,
    "B+": 3, B: 3, "B-": 3,
    "C+": 2, C: 2, "C-": 2,
    "D+": 1, D: 1, "D-": 1,
    F: 0,
  };
  return map[letter] ?? 0;
}
