import { Hono } from "hono";
import { extractUid } from "@vela/auth";
import { prisma } from "@vela/db";
import { defaultsForHostname } from "@vela/domain";
import { parseBellSchedules } from "../lib/bellValidation";

export const schedule = new Hono();

/**
 * GET /api/schedule — the signed-in student's classes plus the bell schedules
 * to use: their own if saved, else their district's preset, else none.
 */
schedule.get("/", async (c) => {
  const uid = await extractUid(c.req.header("authorization") ?? null);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);

  const user = await prisma.user.findUnique({
    where: { firebaseUid: uid },
    select: { id: true, district: { select: { hostname: true } }, bellConfig: { select: { schedules: true } } },
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

  // Stored JSON is re-validated on the way out so a bad row can't break clients.
  const custom = user.bellConfig ? parseBellSchedules(user.bellConfig.schedules) : null;
  if (custom?.ok) return c.json({ entries, bells: custom.value, bellsSource: "custom" });

  const preset = defaultsForHostname(user.district?.hostname);
  if (preset) return c.json({ entries, bells: preset.bells, bellsSource: "preset" });
  return c.json({ entries, bells: [], bellsSource: "none" });
});

/** PUT /api/schedule/bell — saves the student's bell schedules. Body: { bells: BellSchedule[] } */
schedule.put("/bell", async (c) => {
  const uid = await extractUid(c.req.header("authorization") ?? null);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);

  let raw: unknown;
  try {
    raw = (await c.req.json())?.bells;
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const parsed = parseBellSchedules(raw);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);

  const user = await prisma.user.findUnique({ where: { firebaseUid: uid }, select: { id: true } });
  if (!user) return c.json({ error: "User not found" }, 404);

  // Single upsert: atomic, and concurrent saves just last-write-wins.
  await prisma.bellConfig.upsert({
    where: { userId: user.id },
    create: { userId: user.id, schedules: parsed.value as object[] },
    update: { schedules: parsed.value as object[] },
  });
  return c.json({ count: parsed.value.length });
});
