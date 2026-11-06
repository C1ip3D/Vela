import type { BellSchedule } from "@vela/types";
import { EMERALD_DAY_TYPE_DAYS, EMERALD_HIGH_BELLS, EMERALD_TIMEZONE } from "./bellPresets";

export interface DistrictScheduleDefaults {
  bells: BellSchedule[];
  /** IC `periodScheduleName` (lower-cased) -> weekdays, for parsing the roster. */
  dayTypeDays: Record<string, number[]>;
  timezone: string;
}

/**
 * Built-in bell schedule and day-type mapping for an IC district hostname, or
 * null when we have none (the student then enters their own bell times).
 * Currently only Dublin USD, whose preset is Emerald High's.
 */
export function defaultsForHostname(hostname: string | null | undefined): DistrictScheduleDefaults | null {
  if (hostname && /(^|\.)dublinusd\.org$/i.test(hostname)) {
    return { bells: EMERALD_HIGH_BELLS, dayTypeDays: EMERALD_DAY_TYPE_DAYS, timezone: EMERALD_TIMEZONE };
  }
  return null;
}
