import type {
  BellPeriod,
  BellSchedule,
  ScheduleEntry,
  ScheduleSlot,
} from "@vela/types";

export type DayState = "no-school" | "before" | "in-class" | "passing" | "after";

export interface CurrentAndNext {
  state: DayState;
  /** Slot in progress (state "in-class"). */
  current: ScheduleSlot | null;
  /** Next slot to start, if any. */
  next: ScheduleSlot | null;
  /** In-class: minutes until the period ends. Before/passing: minutes until next starts. */
  minutesRemaining: number | null;
}

/** "HH:mm" -> minutes since midnight. Returns null if malformed. */
export function parseClockTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Day of week (0 = Sunday), calendar date ("YYYY-MM-DD") and minutes since
 * midnight for `date` in `timeZone` (the device zone when omitted).
 */
export function getLocalParts(
  date: Date,
  timeZone?: string,
): { day: number; dateKey: string; minutes: number } {
  if (!timeZone) {
    return {
      day: date.getDay(),
      dateKey: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
      minutes: date.getHours() * 60 + date.getMinutes(),
    };
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    day,
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/**
 * Bell variant for a day. A variant pinned to `dateKey` (finals, minimum day)
 * wins; otherwise the first weekday match. Null if none.
 */
export function pickBellSchedule(
  bells: BellSchedule[],
  day: number,
  dateKey?: string,
): BellSchedule | null {
  if (dateKey) {
    const pinned = bells.find((b) => b.dates?.includes(dateKey));
    if (pinned) return pinned;
  }
  return bells.find((b) => !b.dates?.length && b.days.includes(day)) ?? null;
}

/**
 * Join a day's entries with that day's bell times. Entries with no matching
 * bell period (or unparseable times) are dropped; result is sorted by start.
 */
export function getDaySlots(
  entries: ScheduleEntry[],
  bells: BellSchedule[],
  day: number,
  dateKey?: string,
): ScheduleSlot[] {
  const bell = pickBellSchedule(bells, day, dateKey);
  if (!bell) return [];
  const byPeriod = new Map<string, BellPeriod>();
  for (const p of bell.periods) byPeriod.set(p.period, p);

  // A date-pinned variant (finals, minimum day) defines its own meetings, so
  // an entry's usual weekdays don't apply on it (e.g. a Period 6 final on a Wednesday).
  const pinned = !!bell.dates?.length;
  const slots: ScheduleSlot[] = [];
  for (const entry of entries) {
    if (!pinned && entry.days && entry.days.length > 0 && !entry.days.includes(day)) continue;
    const bp = byPeriod.get(entry.period);
    if (!bp) continue;
    const start = parseClockTime(bp.start);
    const end = parseClockTime(bp.end);
    if (start === null || end === null || end <= start) continue;
    slots.push({ entry, period: entry.period, startMinutes: start, endMinutes: end });
  }
  return slots.sort((a, b) => a.startMinutes - b.startMinutes);
}

/** Classify `nowMinutes` against a sorted day's slots. Start inclusive, end exclusive. */
export function getCurrentAndNext(
  slots: ScheduleSlot[],
  nowMinutes: number,
): CurrentAndNext {
  if (slots.length === 0) {
    return { state: "no-school", current: null, next: null, minutesRemaining: null };
  }
  const current = slots.find(
    (s) => nowMinutes >= s.startMinutes && nowMinutes < s.endMinutes,
  );
  const next = slots.find((s) => s.startMinutes > nowMinutes) ?? null;

  if (current) {
    return {
      state: "in-class",
      current,
      next,
      minutesRemaining: current.endMinutes - nowMinutes,
    };
  }
  if (!next) {
    return { state: "after", current: null, next: null, minutesRemaining: null };
  }
  return {
    state: nowMinutes < slots[0].startMinutes ? "before" : "passing",
    current: null,
    next,
    minutesRemaining: next.startMinutes - nowMinutes,
  };
}

/** Convenience: resolve everything for an instant. */
export function resolveNow(
  entries: ScheduleEntry[],
  bells: BellSchedule[],
  now: Date,
  timeZone?: string,
): CurrentAndNext {
  const { day, dateKey, minutes } = getLocalParts(now, timeZone ?? bells[0]?.timezone);
  return getCurrentAndNext(getDaySlots(entries, bells, day, dateKey), minutes);
}
