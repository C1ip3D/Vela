import type { ScheduleEntry } from "@vela/types";

export const periodSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export function entriesForDay(entries: ScheduleEntry[], day: number): ScheduleEntry[] {
  const sorted = entries
    .filter((e) => !e.days?.length || e.days.includes(day))
    .sort((a, b) => periodSort(a.period, b.period));
  // IC lists flex periods (Access) as one row per session, each with its own
  // teacher and room, and can repeat a class per term. Show each period+course
  // once, dropping teacher/room when they differed (they change per session).
  const out: ScheduleEntry[] = [];
  for (const e of sorted) {
    const i = out.findIndex((x) => x.period === e.period && x.courseName === e.courseName);
    if (i === -1) {
      out.push(e);
    } else if (out[i].teacher !== e.teacher || out[i].room !== e.room) {
      out[i] = { ...out[i], teacher: undefined, room: undefined };
    }
  }
  return out;
}
