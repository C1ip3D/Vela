import type { BellSchedule } from "@vela/types";
import { upsertPeriodTimes } from "../bellEdit";
import { defaultsForHostname } from "../bellDefaults";

const base: BellSchedule[] = [
  { id: "tf", name: "Tue/Fri", days: [2, 5], periods: [{ period: "1", start: "08:30", end: "09:26" }, { period: "2", start: "09:34", end: "10:30" }] },
];

describe("upsertPeriodTimes", () => {
  test("updates matching periods and keeps the rest, without mutating input", () => {
    const out = upsertPeriodTimes(base, 2, [{ period: "1", start: "08:00", end: "09:00" }, { period: "3", start: "11:00", end: "12:00" }]);
    expect(out[0].periods.map((p) => [p.period, p.start])).toEqual([["1", "08:00"], ["2", "09:34"], ["3", "11:00"]]);
    expect(base[0].periods[0].start).toBe("08:30");
  });
  test("creates a custom schedule when no variant covers the day", () => {
    const out = upsertPeriodTimes(base, 1, [{ period: "1", start: "08:00", end: "09:00" }]);
    expect(out).toHaveLength(2);
    expect(out[1].days).toEqual([1]);
  });
});

describe("defaultsForHostname", () => {
  test("matches Dublin USD hosts only", () => {
    expect(defaultsForHostname("icampus.dublinusd.org")?.timezone).toBe("America/Los_Angeles");
    expect(defaultsForHostname("evil-dublinusd.org.example.com")).toBeNull();
    expect(defaultsForHostname(null)).toBeNull();
  });
});
