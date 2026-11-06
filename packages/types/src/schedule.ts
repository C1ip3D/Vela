/** Wall-clock time of day as "HH:mm" (24h), in the school's local timezone. */
export type ClockTime = string;

export type ScheduleSource = "ic" | "manual" | "upload";

export interface BellPeriod {
  /** Matches ScheduleEntry.period (e.g. "1", "2", "Flex", "Lunch"). */
  period: string;
  label?: string;
  start: ClockTime;
  end: ClockTime;
}

/** One bell schedule variant. Multiple variants support late-start / A-B days. */
export interface BellSchedule {
  id: string;
  name: string;
  /** Days of week this variant applies to, 0 = Sunday ... 6 = Saturday. */
  days: number[];
  /**
   * One-off calendar dates ("YYYY-MM-DD") this variant applies to instead of
   * its weekday rule (finals, minimum days). A date match beats a weekday match.
   */
  dates?: string[];
  periods: BellPeriod[];
  /** IANA timezone, e.g. "America/Chicago". Falls back to the device zone. */
  timezone?: string;
}

export interface ScheduleEntry {
  period: string;
  courseName: string;
  teacher?: string;
  room?: string;
  /** Days of week this meets (0 = Sunday). Empty/omitted means every school day. */
  days?: number[];
  term?: string;
  source: ScheduleSource;
}

/** An entry placed on a concrete day. Times are minutes since local midnight. */
export interface ScheduleSlot {
  entry: ScheduleEntry;
  period: string;
  startMinutes: number;
  endMinutes: number;
}
