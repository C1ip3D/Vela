import type { BellPeriod, BellSchedule } from "@vela/types";
import { pickBellSchedule } from "./schedule";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Sets the given periods' times on the bell schedule that applies to weekday
 * `day`, leaving its other periods alone. If no schedule covers that day, adds
 * a custom one. Returns a new array; the input is not mutated. Editing a
 * schedule shared by several weekdays (e.g. Tues/Fri) changes all of them.
 */
export function upsertPeriodTimes(bells: BellSchedule[], day: number, times: BellPeriod[]): BellSchedule[] {
  const target = pickBellSchedule(bells, day);
  if (!target) {
    return [
      ...bells,
      { id: `custom-day-${day}`, name: `Custom (${DAY_NAMES[day]})`, days: [day], periods: times },
    ];
  }
  const incoming = new Map(times.map((t) => [t.period, t]));
  const merged = target.periods.map((p) => {
    const t = incoming.get(p.period);
    if (!t) return p;
    incoming.delete(p.period);
    return { ...p, start: t.start, end: t.end };
  });
  merged.push(...incoming.values());
  return bells.map((b) => (b === target ? { ...b, periods: merged } : b));
}
