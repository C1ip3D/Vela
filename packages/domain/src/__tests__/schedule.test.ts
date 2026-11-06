import type { BellSchedule, ScheduleEntry } from "@vela/types";
import {
  getCurrentAndNext,
  getDaySlots,
  getLocalParts,
  parseClockTime,
  resolveNow,
} from "../schedule";

const regular: BellSchedule = {
  id: "reg",
  name: "Regular",
  days: [1, 2, 4, 5],
  periods: [
    { period: "1", start: "08:00", end: "08:50" },
    { period: "2", start: "08:55", end: "09:45" },
    { period: "3", start: "09:50", end: "10:40" },
  ],
};
const lateStart: BellSchedule = {
  id: "late",
  name: "Late start",
  days: [3],
  periods: [
    { period: "1", start: "09:00", end: "09:40" },
    { period: "2", start: "09:45", end: "10:25" },
  ],
};
const bells = [regular, lateStart];

const entries: ScheduleEntry[] = [
  { period: "1", courseName: "Calc", source: "ic" },
  { period: "2", courseName: "Chem", days: [1, 3], source: "ic" },
  { period: "3", courseName: "Lit", source: "manual" },
  { period: "7", courseName: "No bell", source: "ic" },
];

describe("parseClockTime", () => {
  test("parses valid and rejects invalid", () => {
    expect(parseClockTime("08:05")).toBe(485);
    expect(parseClockTime("8:05")).toBe(485);
    expect(parseClockTime("24:00")).toBeNull();
    expect(parseClockTime("nope")).toBeNull();
  });
});

describe("getDaySlots", () => {
  test("joins entries to bell times, drops unmatched and day-filtered, sorts", () => {
    const monday = getDaySlots(entries, bells, 1);
    expect(monday.map((s) => s.entry.courseName)).toEqual(["Calc", "Chem", "Lit"]);
    const tuesday = getDaySlots(entries, bells, 2);
    expect(tuesday.map((s) => s.entry.courseName)).toEqual(["Calc", "Lit"]);
  });

  test("uses the late-start variant on its day", () => {
    const wed = getDaySlots(entries, bells, 3);
    expect(wed.map((s) => [s.entry.courseName, s.startMinutes])).toEqual([
      ["Calc", 540],
      ["Chem", 585],
    ]);
  });

  test("weekend has no bell -> no slots", () => {
    expect(getDaySlots(entries, bells, 0)).toEqual([]);
    expect(getDaySlots(entries, bells, 6)).toEqual([]);
  });

  test("skips periods with bad or inverted times", () => {
    const bad: BellSchedule = {
      ...regular,
      periods: [
        { period: "1", start: "09:00", end: "08:00" },
        { period: "3", start: "xx", end: "10:00" },
      ],
    };
    expect(getDaySlots(entries, [bad], 1)).toEqual([]);
  });
});

describe("getCurrentAndNext", () => {
  const slots = getDaySlots(entries, bells, 1); // 480-530, 535-585, 590-640

  test("no school", () => {
    expect(getCurrentAndNext([], 600).state).toBe("no-school");
  });
  test("before school", () => {
    const r = getCurrentAndNext(slots, 470);
    expect(r.state).toBe("before");
    expect(r.next?.entry.courseName).toBe("Calc");
    expect(r.minutesRemaining).toBe(10);
  });
  test("in class, start inclusive / end exclusive", () => {
    const r = getCurrentAndNext(slots, 480);
    expect(r.state).toBe("in-class");
    expect(r.current?.entry.courseName).toBe("Calc");
    expect(r.next?.entry.courseName).toBe("Chem");
    expect(r.minutesRemaining).toBe(50);
    expect(getCurrentAndNext(slots, 530).state).toBe("passing");
  });
  test("passing period", () => {
    const r = getCurrentAndNext(slots, 532);
    expect(r.state).toBe("passing");
    expect(r.next?.entry.courseName).toBe("Chem");
    expect(r.minutesRemaining).toBe(3);
  });
  test("last period then after school", () => {
    const last = getCurrentAndNext(slots, 600);
    expect(last.state).toBe("in-class");
    expect(last.next).toBeNull();
    const after = getCurrentAndNext(slots, 640);
    expect(after.state).toBe("after");
    expect(after.minutesRemaining).toBeNull();
  });
  test("midnight is before school", () => {
    expect(getCurrentAndNext(slots, 0).state).toBe("before");
  });
});

describe("timezones", () => {
  // 2026-11-04 (Wed) 15:30Z = 09:30 in Chicago (CST, UTC-6)
  const instant = new Date("2026-11-04T15:30:00Z");

  test("getLocalParts honors the timezone", () => {
    expect(getLocalParts(instant, "America/Chicago")).toEqual({ day: 3, dateKey: "2026-11-04", minutes: 570 });
    expect(getLocalParts(instant, "Asia/Tokyo")).toEqual({ day: 4, dateKey: "2026-11-05", minutes: 30 });
  });

  test("resolveNow uses the bell timezone and the day's variant", () => {
    const tzBells = bells.map((b) => ({ ...b, timezone: "America/Chicago" }));
    const r = resolveNow(entries, tzBells, instant);
    expect(r.state).toBe("in-class"); // Wed late-start: Calc 09:00-09:40
    expect(r.current?.entry.courseName).toBe("Calc");
    expect(r.minutesRemaining).toBe(10);
  });

  test("midnight rollover: late Friday in Chicago is Saturday in Tokyo -> no school", () => {
    const fri = new Date("2026-11-06T15:50:00Z"); // Fri 09:50 Chicago, Sat 00:50 Tokyo
    expect(resolveNow(entries, bells, fri, "America/Chicago").state).toBe("in-class");
    expect(resolveNow(entries, bells, fri, "Asia/Tokyo").state).toBe("no-school");
  });
});

describe("date-pinned bell variants", () => {
  const finals: BellSchedule = {
    id: "f", name: "Finals", days: [], dates: ["2026-11-04"],
    periods: [{ period: "2", start: "08:30", end: "10:30" }],
  };
  const e2: ScheduleEntry = { period: "2", courseName: "Chem", days: [1, 4], source: "ic" };

  test("beats the weekday rule and ignores the entry's usual weekdays", () => {
    const slots = getDaySlots([e2], [finals, regular, lateStart], 3, "2026-11-04");
    expect(slots.map((s) => [s.entry.courseName, s.startMinutes])).toEqual([["Chem", 510]]);
  });

  test("a pinned variant does not apply on other dates or as a weekday fallback", () => {
    expect(getDaySlots([e2], [finals], 3, "2026-11-11")).toEqual([]);
  });
});
