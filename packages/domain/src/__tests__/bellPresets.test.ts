import type { ScheduleEntry } from "@vela/types";
import { EMERALD_DAY_TYPE_DAYS, EMERALD_HIGH_BELLS, EMERALD_TIMEZONE } from "../bellPresets";
import { parseClockTime, resolveNow } from "../schedule";

const e = (period: string, courseName: string, days: number[]): ScheduleEntry => ({
  period, courseName, days, source: "ic",
});
const entries = [
  e("1", "Research", [1, 2, 3, 5]),
  e("2", "CS", [1, 2, 4, 5]),
  e("3", "Env Sci", [1, 2, 3, 5]),
  e("4", "History", [1, 2, 4, 5]),
  e("Access", "Homeroom", [1, 3, 4]),
  e("5", "Calc", [1, 2, 3, 5]),
  e("6", "English", [1, 2, 4, 5]),
];
// local Pacific wall-clock -> instant (PST, UTC-8, in Nov-Dec; PDT UTC-7 in Apr)
const pst = (iso: string) => new Date(`${iso}-08:00`);
const pdt = (iso: string) => new Date(`${iso}-07:00`);
const at = (d: Date) => resolveNow(entries, EMERALD_HIGH_BELLS, d, EMERALD_TIMEZONE);

describe("Emerald bell data", () => {
  test("every period has valid times with end after start, in order", () => {
    for (const b of EMERALD_HIGH_BELLS) {
      let prevEnd = 0;
      for (const p of b.periods) {
        const s = parseClockTime(p.start)!, en = parseClockTime(p.end)!;
        expect(s).not.toBeNull();
        expect(en).toBeGreaterThan(s);
        if (!b.name.startsWith("Finals")) expect(s).toBeGreaterThanOrEqual(prevEnd);
        prevEnd = en;
      }
    }
  });

  test("weekday rules cover Mon-Fri exactly once; weekend none", () => {
    const days = EMERALD_HIGH_BELLS.filter((b) => !b.dates).flatMap((b) => b.days).sort();
    expect(days).toEqual([1, 2, 3, 4, 5]);
  });

  test("IC day types map to the same weekdays the bells use", () => {
    expect(Object.values(EMERALD_DAY_TYPE_DAYS).flat().sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("Emerald now/next", () => {
  test("Monday 8:35 is period 1 (all-periods Monday)", () => {
    const r = at(pst("2026-11-02T08:35:00"));
    expect(r.state).toBe("in-class");
    expect(r.current?.entry.courseName).toBe("Research");
    expect(r.minutesRemaining).toBe(45);
  });

  test("Tuesday uses the longer 56-minute periods", () => {
    const r = at(pst("2026-11-03T09:20:00"));
    expect(r.current?.entry.courseName).toBe("Research");
    expect(r.minutesRemaining).toBe(6);
  });

  test("Wednesday 9:00 is period 1 (odd day, 88 min); no period 2", () => {
    const r = at(pst("2026-11-04T10:30:00"));
    expect(r.state).toBe("passing");
    expect(r.next?.entry.courseName).toBe("Env Sci"); // period 3, not 2
  });

  test("Thursday even day: period 2 at 8:30, ACCESS after lunch", () => {
    expect(at(pst("2026-11-05T08:30:00")).current?.entry.courseName).toBe("CS");
    expect(at(pst("2026-11-05T12:20:00")).current?.entry.courseName).toBe("Homeroom");
  });

  test("lunch is a gap: next up after Monday period 4 is ACCESS", () => {
    const r = at(pst("2026-11-02T12:30:00"));
    expect(r.state).toBe("passing");
    expect(r.next?.entry.courseName).toBe("Homeroom");
  });

  test("after school and weekends", () => {
    expect(at(pst("2026-11-02T16:00:00")).state).toBe("after");
    expect(at(pst("2026-11-07T10:00:00")).state).toBe("no-school");
  });

  test("minimum day (Fri 2027-04-02) overrides the Friday rule", () => {
    const r = at(pdt("2027-04-02T08:45:00"));
    expect(r.current?.entry.courseName).toBe("Research");
    expect(r.minutesRemaining).toBe(15); // 30-min period, not 56
  });

  test("finals day replaces the normal schedule", () => {
    // Wed 2026-12-16: only periods 6 and 5 finals; normal Wed has neither 6 nor 8:30 start
    const r = at(pst("2026-12-16T09:00:00"));
    expect(r.current?.entry.courseName).toBe("English"); // P6 final 8:30-10:30
    expect(r.minutesRemaining).toBe(90);
  });
});
