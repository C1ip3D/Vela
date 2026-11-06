import type { BellPeriod, BellSchedule } from "@vela/types";

/**
 * Emerald High School (Dublin USD, CA) 2026-27 bell schedule, from
 * https://ehs.dublinusd.org/apps/bell_schedules/ (transcribed 2026-11-05).
 * Re-check the page each year; the school revises these.
 *
 * Period ids match IC's `periodName` ("0".."7", "Access"). Lunch/brunch are
 * included so UIs can show them, but only periods a student has an entry for
 * become schedule slots.
 */
export const EMERALD_TIMEZONE = "America/Los_Angeles";

const p = (period: string, start: string, end: string, label?: string): BellPeriod => ({
  period,
  start,
  end,
  ...(label ? { label } : {}),
});

const P0 = p("0", "07:15", "08:20");

/** IC `periodScheduleName` -> weekdays (0 = Sunday) for Emerald's day types. */
export const EMERALD_DAY_TYPE_DAYS: Record<string, number[]> = {
  mon: [1],
  "tues/fri": [2, 5],
  "odd/wed": [3],
  "even/thur": [4],
};

const emeraldBase = { timezone: EMERALD_TIMEZONE };

export const EMERALD_HIGH_BELLS: BellSchedule[] = [
  {
    ...emeraldBase,
    id: "emerald-mon",
    name: "Monday: All Periods",
    days: [1],
    periods: [
      P0,
      p("1", "08:30", "09:20"),
      p("2", "09:28", "10:18"),
      p("3", "10:26", "11:16"),
      p("4", "11:24", "12:14"),
      p("Lunch", "12:14", "12:49", "Lunch"),
      p("Access", "12:57", "13:29", "ACCESS"),
      p("5", "13:37", "14:27"),
      p("6", "14:35", "15:25"),
      p("7", "15:33", "16:38"),
    ],
  },
  {
    ...emeraldBase,
    id: "emerald-tues-fri",
    name: "Tuesday/Friday: All Periods",
    days: [2, 5],
    periods: [
      P0,
      p("1", "08:30", "09:26"),
      p("2", "09:34", "10:30"),
      p("3", "10:38", "11:38"),
      p("4", "11:46", "12:42"),
      p("Lunch", "12:42", "13:17", "Lunch"),
      p("5", "13:25", "14:21"),
      p("6", "14:29", "15:25"),
      p("7", "15:33", "16:38"),
    ],
  },
  {
    ...emeraldBase,
    id: "emerald-wed-odd",
    name: "Wednesday: Odd Periods",
    days: [3],
    periods: [
      p("1", "09:00", "10:28"),
      p("3", "10:36", "12:04"),
      p("Lunch", "12:04", "12:39", "Lunch"),
      p("Access", "12:47", "13:49", "ACCESS"),
      p("5", "13:57", "15:25"),
    ],
  },
  {
    ...emeraldBase,
    id: "emerald-thu-even",
    name: "Thursday: Even Periods",
    days: [4],
    periods: [
      P0,
      p("2", "08:30", "09:58"),
      p("4", "10:06", "11:34"),
      p("Lunch", "11:34", "12:09", "Lunch"),
      p("Access", "12:17", "13:09", "ACCESS"),
      p("6", "13:17", "14:45"),
      p("7", "14:53", "15:58"),
    ],
  },
  {
    ...emeraldBase,
    id: "emerald-minimum-2027-04-02",
    name: "Minimum Day",
    days: [],
    dates: ["2027-04-02"],
    periods: [
      P0,
      p("1", "08:30", "09:00"),
      p("2", "09:07", "09:37"),
      p("3", "09:44", "10:14"),
      p("4", "10:21", "10:51"),
      p("Brunch", "10:51", "11:06", "Brunch"),
      p("5", "11:13", "11:43"),
      p("6", "11:50", "12:20"),
      p("7", "12:27", "12:57"),
    ],
  },
  ...(
    [
      ["2026-12-16", ["6", "08:30", "10:30"], ["5", "10:52", "12:52"]],
      ["2026-12-17", ["4", "08:30", "10:30"], ["3", "10:52", "12:52"]],
      ["2026-12-18", ["2", "08:30", "10:30"], ["1", "10:52", "12:52"]],
    ] as const
  ).map(
    ([date, a, b]): BellSchedule => ({
      ...emeraldBase,
      id: `emerald-finals-${date}`,
      name: "Finals",
      days: [],
      dates: [date],
      periods: [
        p(a[0], a[1], a[2], `Period ${a[0]} Final`),
        p("Break", "10:30", "10:45", "Break"),
        p(b[0], b[1], b[2], `Period ${b[0]} Final`),
      ],
    }),
  ),
];
