import Foundation

// Port of packages/domain/src/schedule.ts, bellEdit.ts and apps/mobile/lib/scheduleView.ts

public enum DayState: String, Sendable { case noSchool, before, inClass, passing, after }

public struct CurrentAndNext: Equatable, Sendable {
    public var state: DayState
    public var current: ScheduleSlot?
    public var next: ScheduleSlot?
    /// In class: minutes until the period ends. Before/passing: minutes until next starts.
    public var minutesRemaining: Int?
}

public struct LocalParts: Equatable, Sendable {
    /// 0 = Sunday
    public var day: Int
    /// "YYYY-MM-DD"
    public var dateKey: String
    public var minutes: Int
}

/// "HH:mm" → minutes since midnight; nil if malformed.
public func parseClockTime(_ value: String) -> Int? {
    let parts = value.trimmingCharacters(in: .whitespaces).split(separator: ":", omittingEmptySubsequences: false)
    guard parts.count == 2, (1...2).contains(parts[0].count), parts[1].count == 2,
          let h = Int(parts[0]), let m = Int(parts[1]), h <= 23, m <= 59 else { return nil }
    return h * 60 + m
}

/// Day of week (0 = Sunday), calendar date and minutes since midnight for `date` in `timeZone` (device zone when nil).
public func getLocalParts(_ date: Date, timeZone: String? = nil) -> LocalParts {
    var cal = Calendar(identifier: .gregorian)
    if let timeZone, let tz = TimeZone(identifier: timeZone) { cal.timeZone = tz }
    let c = cal.dateComponents([.year, .month, .day, .hour, .minute, .weekday], from: date)
    return LocalParts(
        day: (c.weekday ?? 1) - 1,
        dateKey: String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0),
        minutes: (c.hour ?? 0) * 60 + (c.minute ?? 0)
    )
}

/// Bell variant for a day. A variant pinned to `dateKey` (finals, minimum day) wins; otherwise the first weekday match.
public func pickBellSchedule(_ bells: [BellSchedule], day: Int, dateKey: String? = nil) -> BellSchedule? {
    if let dateKey, let pinned = bells.first(where: { $0.dates?.contains(dateKey) == true }) {
        return pinned
    }
    return bells.first { ($0.dates ?? []).isEmpty && $0.days.contains(day) }
}

/// Joins a day's entries with that day's bell times; sorted by start. Entries without a bell period are dropped.
public func getDaySlots(_ entries: [ScheduleEntry], bells: [BellSchedule], day: Int, dateKey: String? = nil) -> [ScheduleSlot] {
    guard let bell = pickBellSchedule(bells, day: day, dateKey: dateKey) else { return [] }
    var byPeriod = [String: BellPeriod]()
    for p in bell.periods { byPeriod[p.period] = p }

    // A date-pinned variant defines its own meetings, so an entry's usual weekdays don't apply.
    let pinned = !(bell.dates ?? []).isEmpty
    var slots = [ScheduleSlot]()
    for entry in entries {
        if !pinned, let days = entry.days, !days.isEmpty, !days.contains(day) { continue }
        guard let bp = byPeriod[entry.period],
              let start = parseClockTime(bp.start), let end = parseClockTime(bp.end), end > start else { continue }
        slots.append(ScheduleSlot(entry: entry, period: entry.period, startMinutes: start, endMinutes: end))
    }
    return slots.enumerated().sorted { ($0.element.startMinutes, $0.offset) < ($1.element.startMinutes, $1.offset) }.map(\.element)
}

/// Classifies `nowMinutes` against a sorted day's slots. Start inclusive, end exclusive.
public func getCurrentAndNext(_ slots: [ScheduleSlot], nowMinutes: Int) -> CurrentAndNext {
    guard let first = slots.first else {
        return CurrentAndNext(state: .noSchool, current: nil, next: nil, minutesRemaining: nil)
    }
    let current = slots.first { nowMinutes >= $0.startMinutes && nowMinutes < $0.endMinutes }
    let next = slots.first { $0.startMinutes > nowMinutes }
    if let current {
        return CurrentAndNext(state: .inClass, current: current, next: next, minutesRemaining: current.endMinutes - nowMinutes)
    }
    guard let next else {
        return CurrentAndNext(state: .after, current: nil, next: nil, minutesRemaining: nil)
    }
    return CurrentAndNext(
        state: nowMinutes < first.startMinutes ? .before : .passing,
        current: nil, next: next, minutesRemaining: next.startMinutes - nowMinutes
    )
}

public func resolveNow(_ entries: [ScheduleEntry], bells: [BellSchedule], now: Date, timeZone: String? = nil) -> CurrentAndNext {
    let p = getLocalParts(now, timeZone: timeZone ?? bells.first?.timezone)
    return getCurrentAndNext(getDaySlots(entries, bells: bells, day: p.day, dateKey: p.dateKey), nowMinutes: p.minutes)
}

// MARK: Day view helpers

public func periodSort(_ a: String, _ b: String) -> Bool {
    a.compare(b, options: .numeric) == .orderedAscending
}

/// Entries meeting on `day`, one row per period+course (IC repeats flex periods per session).
public func entriesForDay(_ entries: [ScheduleEntry], day: Int) -> [ScheduleEntry] {
    let sorted = entries
        .filter { ($0.days ?? []).isEmpty || $0.days!.contains(day) }
        .enumerated()
        .sorted { l, r in
            let c = l.element.period.compare(r.element.period, options: .numeric)
            return c == .orderedSame ? l.offset < r.offset : c == .orderedAscending
        }
        .map(\.element)
    var out = [ScheduleEntry]()
    for e in sorted {
        if let i = out.firstIndex(where: { $0.period == e.period && $0.courseName == e.courseName }) {
            if out[i].teacher != e.teacher || out[i].room != e.room {
                out[i].teacher = nil
                out[i].room = nil
            }
        } else {
            out.append(e)
        }
    }
    return out
}

// MARK: Bell editing

private let dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

/// Sets the given periods' times on the bell schedule that applies to `day`, leaving others alone.
/// With no schedule covering that day, appends a custom one. Editing a shared schedule (e.g. Tues/Fri) changes all its days.
public func upsertPeriodTimes(_ bells: [BellSchedule], day: Int, times: [BellPeriod]) -> [BellSchedule] {
    guard let target = pickBellSchedule(bells, day: day) else {
        return bells + [BellSchedule(id: "custom-day-\(day)", name: "Custom (\(dayNames[day]))", days: [day], periods: times)]
    }
    var incoming = times
    var merged = target.periods.map { p -> BellPeriod in
        guard let i = incoming.firstIndex(where: { $0.period == p.period }) else { return p }
        let t = incoming.remove(at: i)
        var q = p
        q.start = t.start
        q.end = t.end
        return q
    }
    merged.append(contentsOf: incoming)
    return bells.map { $0.id == target.id ? { var b = $0; b.periods = merged; return b }($0) : $0 }
}
