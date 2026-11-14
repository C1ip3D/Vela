import { Hono } from "hono";
import { extractUid } from "@vela/auth";
import { prisma } from "@vela/db";
import { defaultsForHostname } from "@vela/domain";

export const schedule = new Hono();

/**
 * GET /api/schedule — the signed-in student's classes plus the bell schedules
 * to use: their district's preset, else none. Bell times are not user-editable.
 */
schedule.get("/", async (c) => {
  const uid = await extractUid(c.req.header("authorization") ?? null);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);

  const user = await prisma.user.findUnique({
    where: { firebaseUid: uid },
    select: { id: true, district: { select: { hostname: true } } },
  });
  if (!user) return c.json({ entries: [], bells: [], bellsSource: "none" });

  const rows = await prisma.scheduleEntry.findMany({
    where: { userId: user.id },
    select: { period: true, courseName: true, teacher: true, room: true, days: true, term: true, source: true },
  });
  const entries = rows.map((r) => ({
    period: r.period,
    courseName: r.courseName,
    ...(r.teacher ? { teacher: r.teacher } : {}),
    ...(r.room ? { room: r.room } : {}),
    days: r.days,
    ...(r.term ? { term: r.term } : {}),
    source: r.source === "INFINITE_CAMPUS" ? "ic" : r.source === "UPLOAD" ? "upload" : "manual",
  }));

  const preset = defaultsForHostname(user.district?.hostname);
  if (preset) return c.json({ entries, bells: preset.bells, bellsSource: "preset" });
  return c.json({ entries, bells: [], bellsSource: "none" });
});
