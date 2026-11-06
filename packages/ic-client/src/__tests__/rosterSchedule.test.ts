import { parseRosterSchedule } from "../parsers";
import roster from "./fixtures/roster.json";

// Mirrors @vela/domain's EMERALD_DAY_TYPE_DAYS (ic-client doesn't depend on domain).
const dayTypeDays = { mon: [1], "tues/fri": [2, 5], "odd/wed": [3], "even/thur": [4] };

describe("parseRosterSchedule", () => {
  const entries = parseRosterSchedule(roster, { today: "2026-11-05", dayTypeDays });

  test("keeps only the current year and the term covering today", () => {
    expect(entries.map((e) => e.courseName)).not.toContain("Last Year Art");
    const calc = entries.find((e) => e.courseName === "Test Calculus");
    expect(calc?.term).toBe("Semester 1"); // not the Semester 2 placement
  });

  test("merges day types into one entry per section+period with weekdays", () => {
    expect(entries.find((e) => e.courseName === "Test Calculus")?.days).toEqual([1, 2, 3, 5]);
    expect(entries.find((e) => e.courseName === "Test Chemistry")?.days).toEqual([1, 2, 4, 5]);
    expect(entries.find((e) => e.period === "Access")?.days).toEqual([1, 3, 4]);
  });

  test("skips unknown day types (Min) and tags source", () => {
    expect(entries).toHaveLength(3);
    expect(entries.every((e) => e.source === "ic")).toBe(true);
  });

  test("sorts numerically by period, non-numeric last", () => {
    expect(entries.map((e) => e.period)).toEqual(["2", "5", "Access"]);
  });

  test("uses the next term once today passes the current one", () => {
    const next = parseRosterSchedule(roster, { today: "2027-02-01", dayTypeDays });
    expect(next.map((e) => e.courseName)).toEqual(["Test Calculus"]);
    expect(next[0].term).toBe("Semester 2");
  });

  test("tolerates junk input", () => {
    expect(parseRosterSchedule(null, { today: "2026-11-05", dayTypeDays })).toEqual([]);
    expect(parseRosterSchedule([{}], { today: "2026-11-05", dayTypeDays })).toEqual([]);
  });
});
