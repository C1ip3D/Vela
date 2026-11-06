import XCTest
@testable import VelaKit

final class GradingTests: XCTestCase {
    func testPercentageToLetterBoundaries() {
        XCTAssertEqual(percentageToLetter(97), "A+")
        XCTAssertEqual(percentageToLetter(93), "A")
        XCTAssertEqual(percentageToLetter(90), "A-")
        XCTAssertEqual(percentageToLetter(59.9), "F")
        XCTAssertEqual(percentageToLetter(0), "F")
    }

    func testCourseTypeBoosts() {
        XCTAssertEqual(letterToGpaPoints("A", courseType: "AP"), 5.0, accuracy: 0.001)
        XCTAssertEqual(letterToGpaPoints("A", courseType: "DUAL_ENROLLMENT"), 5.0, accuracy: 0.001)
        XCTAssertEqual(letterToGpaPoints("B", courseType: "HONORS"), 3.5, accuracy: 0.001)
        XCTAssertEqual(letterToGpaPoints("B", courseType: "STANDARD"), 3.0, accuracy: 0.001)
        XCTAssertEqual(letterToGpaPoints("F", courseType: "AP"), 0)
    }

    func testCalculateGpa() {
        XCTAssertEqual(calculateGpa([]), GpaResult(weighted: 0, unweighted: 0))
        let r = calculateGpa([
            CourseGradeInput(courseId: "1", courseName: "AP Calc", percentage: 95, courseType: "AP"),
            CourseGradeInput(courseId: "2", courseName: "English", percentage: 85, courseType: "STANDARD"),
        ])
        // weighted: (5.0 + 3.0) / 2, unweighted: (4.0 + 3.0) / 2
        XCTAssertEqual(r.weighted, 4.0, accuracy: 0.001)
        XCTAssertEqual(r.unweighted, 3.5, accuracy: 0.001)
    }
}

final class ScheduleTests: XCTestCase {
    let regular = BellSchedule(id: "reg", name: "Regular", days: [1, 2, 4, 5], periods: [
        BellPeriod(period: "1", start: "08:00", end: "08:50"),
        BellPeriod(period: "2", start: "08:55", end: "09:45"),
        BellPeriod(period: "3", start: "09:50", end: "10:40"),
    ])
    let lateStart = BellSchedule(id: "late", name: "Late start", days: [3], periods: [
        BellPeriod(period: "1", start: "09:00", end: "09:40"),
        BellPeriod(period: "2", start: "09:45", end: "10:25"),
    ])
    var bells: [BellSchedule] { [regular, lateStart] }
    let entries = [
        ScheduleEntry(period: "1", courseName: "Calc"),
        ScheduleEntry(period: "2", courseName: "Chem", days: [1, 3]),
        ScheduleEntry(period: "3", courseName: "Lit", source: .manual),
        ScheduleEntry(period: "7", courseName: "No bell"),
    ]

    func testParseClockTime() {
        XCTAssertEqual(parseClockTime("08:05"), 485)
        XCTAssertEqual(parseClockTime("8:05"), 485)
        XCTAssertNil(parseClockTime("24:00"))
        XCTAssertNil(parseClockTime("nope"))
    }

    func testDaySlotsFilterAndSort() {
        XCTAssertEqual(getDaySlots(entries, bells: bells, day: 1).map(\.entry.courseName), ["Calc", "Chem", "Lit"])
        XCTAssertEqual(getDaySlots(entries, bells: bells, day: 2).map(\.entry.courseName), ["Calc", "Lit"])
        let wed = getDaySlots(entries, bells: bells, day: 3)
        XCTAssertEqual(wed.map(\.entry.courseName), ["Calc", "Chem"])
        XCTAssertEqual(wed.map(\.startMinutes), [540, 585])
    }

    func testCurrentAndNextStates() {
        let slots = getDaySlots(entries, bells: bells, day: 1)
        XCTAssertEqual(getCurrentAndNext([], nowMinutes: 500).state, .noSchool)
        XCTAssertEqual(getCurrentAndNext(slots, nowMinutes: 7 * 60).state, .before)
        let inClass = getCurrentAndNext(slots, nowMinutes: 8 * 60 + 10)
        XCTAssertEqual(inClass.state, .inClass)
        XCTAssertEqual(inClass.minutesRemaining, 40)
        XCTAssertEqual(getCurrentAndNext(slots, nowMinutes: 8 * 60 + 52).state, .passing)
        XCTAssertEqual(getCurrentAndNext(slots, nowMinutes: 12 * 60).state, .after)
    }

    func testDatePinnedBellWinsAndIgnoresEntryWeekdays() {
        let finals = BellSchedule(id: "f", name: "Finals", days: [], dates: ["2026-12-16"], periods: [
            BellPeriod(period: "2", start: "08:30", end: "10:30"),
        ])
        let slots = getDaySlots(entries, bells: bells + [finals], day: 3, dateKey: "2026-12-16")
        XCTAssertEqual(slots.map(\.entry.courseName), ["Chem"])
        // Not pinned on another date: weekday rule applies.
        XCTAssertEqual(getDaySlots(entries, bells: bells + [finals], day: 3, dateKey: "2026-12-02").count, 2)
    }

    func testLocalPartsRespectTimeZone() {
        // 2026-11-05 01:30 UTC is still Nov 4, 5:30 PM in Los Angeles (PST).
        let date = Date(timeIntervalSince1970: 1_793_842_200)
        let la = getLocalParts(date, timeZone: "America/Los_Angeles")
        XCTAssertEqual(la.dateKey, "2026-11-04")
        XCTAssertEqual(la.day, 3)
        XCTAssertEqual(la.minutes, 17 * 60 + 30)
    }

    func testEmeraldPresetCoversEverySchoolDay() {
        for day in 1...5 {
            XCTAssertNotNil(pickBellSchedule(BellPresets.emeraldHighBells, day: day), "day \(day)")
        }
        XCTAssertNil(pickBellSchedule(BellPresets.emeraldHighBells, day: 0))
        XCTAssertEqual(pickBellSchedule(BellPresets.emeraldHighBells, day: 3, dateKey: "2026-12-16")?.name, "Finals")
        XCTAssertNotNil(defaultsForHostname("icampus.dublinusd.org"))
        XCTAssertNil(defaultsForHostname("example.infinitecampus.org"))
    }

    func testUpsertPeriodTimes() {
        let edited = upsertPeriodTimes(bells, day: 1, times: [
            BellPeriod(period: "1", start: "08:05", end: "08:55"),
            BellPeriod(period: "9", start: "16:00", end: "16:30"),
        ])
        XCTAssertEqual(edited[0].periods.first { $0.period == "1" }?.start, "08:05")
        XCTAssertEqual(edited[0].periods.last?.period, "9")
        XCTAssertEqual(edited[1], lateStart)
        // No schedule for Saturday: a custom one is appended.
        XCTAssertEqual(upsertPeriodTimes(bells, day: 6, times: []).last?.id, "custom-day-6")
    }

    func testEntriesForDayCollapsesRepeatedFlexPeriods() {
        let flex = [
            ScheduleEntry(period: "Access", courseName: "ACCESS", teacher: "A", room: "1", days: [1]),
            ScheduleEntry(period: "Access", courseName: "ACCESS", teacher: "B", room: "2", days: [1]),
            ScheduleEntry(period: "2", courseName: "Chem", days: [1]),
        ]
        let out = entriesForDay(flex, day: 1)
        XCTAssertEqual(out.map(\.period), ["2", "Access"])
        XCTAssertNil(out[1].teacher)
        XCTAssertNil(out[1].room)
    }
}
