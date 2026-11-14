import { Hono } from "hono";
import { extractUid, deleteFirebaseUser } from "@vela/auth";
import { prisma } from "@vela/db";
import { createLimiter } from "../lib/rateLimit";

export const account = new Hono();

const deleteLimit = createLimiter(5, 60_000);

/**
 * DELETE /api/account — permanently deletes the signed-in student's Vela account and everything stored for it:
 * the user row, enrollments, grade history, GPA snapshots, advisor logs, assignment grades, schedule entries and
 * saved bell times, then the Firebase Auth user. (App Store Review Guideline 5.1.1(v): an app that creates accounts
 * must let people delete them from inside the app.)
 *
 * Idempotent: with no database row left it still removes the Firebase user, so a request that failed halfway can
 * simply be repeated. Shared rows (District, Course) hold no student data and are kept.
 */
account.delete("/", async (c) => {
  const uid = await extractUid(c.req.header("authorization") ?? null);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const retry = deleteLimit(uid);
  if (retry !== null) {
    c.header("Retry-After", String(retry));
    return c.json({ error: "Too many requests" }, 429);
  }

  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: uid }, select: { id: true } });
    if (user) {
      const where = { userId: user.id };
      // These relations have no ON DELETE CASCADE, so they go first, in the same transaction as the user row.
      await prisma.$transaction([
        prisma.assignmentGrade.deleteMany({ where }),
        prisma.advisorLog.deleteMany({ where }),
        prisma.gpaSnapshot.deleteMany({ where }),
        prisma.gradeHistory.deleteMany({ where }),
        prisma.enrollment.deleteMany({ where }),
        prisma.scheduleEntry.deleteMany({ where }),
        prisma.bellConfig.deleteMany({ where }),
        prisma.user.delete({ where: { id: user.id } }),
      ]);
    }
    await deleteFirebaseUser(uid);
    return c.json({ deleted: true });
  } catch (err) {
    console.error("[Account] Deletion failed:", err);
    return c.json({ error: "Could not delete your account. Please try again." }, 500);
  }
});
