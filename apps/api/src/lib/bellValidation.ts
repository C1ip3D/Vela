import { parseClockTime } from "@vela/domain";
import type { BellSchedule } from "@vela/types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_VARIANTS = 40;
const MAX_PERIODS = 20;

function validTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() !== "" && v.length <= max ? v.trim() : null;

/** Validates and normalizes untrusted input into BellSchedule[]. Never trusts the shape of `input`. */
export function parseBellSchedules(input: unknown): { ok: true; value: BellSchedule[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length > MAX_VARIANTS) {
    return { ok: false, error: `bells must be an array of at most ${MAX_VARIANTS} schedules` };
  }
  const out: BellSchedule[] = [];
  const ids = new Set<string>();
  for (const raw of input) {
    const id = str(raw?.id, 100);
    const name = str(raw?.name, 100);
    if (!id || !name || ids.has(id)) return { ok: false, error: "Each schedule needs a unique id and a name" };
    ids.add(id);

    const days: unknown = raw.days;
    if (!Array.isArray(days) || days.length > 7 || !days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
      return { ok: false, error: `${name}: days must be weekday numbers 0-6` };
    }
    let dates: string[] | undefined;
    if (raw.dates !== undefined) {
      if (!Array.isArray(raw.dates) || raw.dates.length > 366 || !raw.dates.every((d: unknown) => typeof d === "string" && DATE.test(d))) {
        return { ok: false, error: `${name}: dates must be YYYY-MM-DD` };
      }
      dates = raw.dates;
    }
    if (raw.timezone !== undefined && (typeof raw.timezone !== "string" || !validTimezone(raw.timezone))) {
      return { ok: false, error: `${name}: unknown timezone` };
    }
    if (!Array.isArray(raw.periods) || raw.periods.length > MAX_PERIODS) {
      return { ok: false, error: `${name}: at most ${MAX_PERIODS} periods` };
    }
    const seen = new Set<string>();
    const periods = [];
    for (const p of raw.periods) {
      const period = str(p?.period, 50);
      const start = typeof p?.start === "string" ? parseClockTime(p.start) : null;
      const end = typeof p?.end === "string" ? parseClockTime(p.end) : null;
      if (!period || start === null || end === null || end <= start || seen.has(period)) {
        return { ok: false, error: `${name}: invalid period ${period ?? ""}` };
      }
      seen.add(period);
      const label = p.label === undefined ? undefined : str(p.label, 100) ?? undefined;
      periods.push({ period, start: p.start.trim(), end: p.end.trim(), ...(label ? { label } : {}) });
    }
    out.push({ id, name, days, ...(dates ? { dates } : {}), periods, ...(raw.timezone ? { timezone: raw.timezone } : {}) });
  }
  return { ok: true, value: out };
}
