import { Hono } from "hono";
import { extractUid, deleteFirebaseUser } from "@vela/auth";
import { prisma } from "@vela/db";

export const account = new Hono();

/**
 * DELETE /api/account — in-app account deletion (App Store guideline 5.1.1(v)).
 * Removes everything stored for the signed-in student, then their Firebase user.
 * Shared rows (districts, courses) are left alone because other students use them.
 */
account.delete("/", async (c) => {
  const uid = await extractUid(c.req.header("authorization") ?? null);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);

  const user = await prisma.user.findUnique({ where: { firebaseUid: uid }, select: { id: true } });
  if (user) {
    const userId = user.id;
    await prisma.$transaction([
      prisma.assignmentGrade.deleteMany({ where: { userId } }),
      prisma.gradeHistory.deleteMany({ where: { userId } }),
      prisma.gpaSnapshot.deleteMany({ where: { userId } }),
      prisma.advisorLog.deleteMany({ where: { userId } }),
      prisma.enrollment.deleteMany({ where: { userId } }),
      prisma.scheduleEntry.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);
  }

  await deleteFirebaseUser(uid);
  return c.json({ ok: true });
});
