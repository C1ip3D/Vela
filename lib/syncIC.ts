import prisma from "@/lib/db";

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
}

/**
 * Upserts the Firebase user, then upserts courses + enrollments from an IC fetch.
 * Also records a GradeHistory snapshot for each graded course.
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
        source: "INFINITE_CAMPUS",
      },
      update: {
        name: c.name,
        courseCode: c.courseCode,
        term: c.term,
        courseType,
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

    // 3. Record a grade snapshot if there's a grade
    if (c.currentGrade != null) {
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
    }
  }

  return user;
}

/**
 * Returns cached enrollments for a user if they were synced within the last 5 minutes.
 * Returns null if the cache is stale or missing.
 */
export async function getCachedCourses(firebaseUid: string): Promise<SyncableCourse[] | null> {
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

  // Check freshness: find the most recent enrollment update
  const mostRecent = await prisma.gradeHistory.findFirst({
    where: { userId: user.id },
    orderBy: { recordedAt: "desc" },
  });

  if (!mostRecent) return null;

  const ageMs = Date.now() - mostRecent.recordedAt.getTime();
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  if (ageMs > CACHE_TTL_MS) return null;

  return user.enrollments.map((e) => ({
    id: e.course.externalId ?? e.course.canvasCourseId,
    name: e.course.name,
    courseCode: e.course.courseCode,
    term: e.course.term,
    courseType: e.course.courseType,
    currentGrade: e.currentGrade,
    letterGrade: e.letterGrade,
    missingCount: 0,
  }));
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

function gradeToGpaPoints(letter: string): number {
  const map: Record<string, number> = {
    "A+": 4.0, "A": 4.0, "A-": 3.7,
    "B+": 3.3, "B": 3.0, "B-": 2.7,
    "C+": 2.3, "C": 2.0, "C-": 1.7,
    "D+": 1.3, "D": 1.0, "D-": 0.7,
    "F": 0.0,
  };
  return map[letter] ?? 0.0;
}
