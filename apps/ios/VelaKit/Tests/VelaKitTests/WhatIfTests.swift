import XCTest
@testable import VelaKit

final class WhatIfTests: XCTestCase {
    private func a(_ id: String, _ score: Double?, _ possible: Double) -> ICDetailAssignment {
        ICDetailAssignment(id: id, name: id, pointsPossible: possible, score: score)
    }

    func testGroupScoreSkipsUnscoredAndZeroPointAssignments() {
        let list = [a("1", 8, 10), a("2", nil, 10), a("3", 5, 0)]
        XCTAssertEqual(try XCTUnwrap(calcGroupScore(list, mods: [:])), 80, accuracy: 0.001)
        XCTAssertNil(calcGroupScore([a("x", nil, 10)], mods: [:]))
    }

    func testEditedScoreDropAndExtras() {
        let list = [a("1", 8, 10), a("2", 10, 10)]
        XCTAssertEqual(try XCTUnwrap(calcGroupScore(list, mods: ["1": WhatIfMod(editedScore: 10)])), 100, accuracy: 0.001)
        XCTAssertEqual(try XCTUnwrap(calcGroupScore(list, mods: ["1": WhatIfMod(dropped: true)])), 100, accuracy: 0.001)
        XCTAssertNil(calcGroupScore(list, mods: ["1": WhatIfMod(dropped: true), "2": WhatIfMod(dropped: true)]))
        // An edited score also fills in a currently-missing (nil) one.
        XCTAssertEqual(try XCTUnwrap(calcGroupScore([a("m", nil, 10)], mods: ["m": WhatIfMod(editedScore: 9)])), 90, accuracy: 0.001)
        // Extras count even when nothing else does.
        let extra = CustomAssignment(name: "Hypothetical", score: 45, pointsPossible: 50)
        XCTAssertEqual(try XCTUnwrap(calcGroupScore([], mods: [:], extras: [extra])), 90, accuracy: 0.001)
        XCTAssertEqual(try XCTUnwrap(calcGroupScore(list, mods: [:], extras: [extra])), 63 / 70 * 100, accuracy: 0.001)
    }

    func testCourseGradeWeightedAndUnweighted() {
        let tests = ICAssignmentGroup(id: "t", name: "Tests", weight: 60, assignments: [a("t1", 90, 100)])
        let hw = ICAssignmentGroup(id: "h", name: "HW", weight: 40, assignments: [a("h1", 100, 100)])
        XCTAssertEqual(try XCTUnwrap(calcCourseGrade([tests, hw], mods: [:])), 94, accuracy: 0.001)
        // A category with nothing scored drops out of the weighting.
        let empty = ICAssignmentGroup(id: "e", name: "E", weight: 50, assignments: [a("e1", nil, 10)])
        XCTAssertEqual(try XCTUnwrap(calcCourseGrade([tests, empty], mods: [:])), 90, accuracy: 0.001)

        var t0 = tests; t0.weight = 0
        var h0 = hw; h0.weight = 0
        XCTAssertEqual(try XCTUnwrap(calcCourseGrade([t0, h0], mods: [:])), 95, accuracy: 0.001)
        XCTAssertNil(calcCourseGrade([], mods: [:]))

        // What-if: raising the test to 100 lifts the weighted grade to 100.
        XCTAssertEqual(try XCTUnwrap(calcCourseGrade([tests, hw], mods: ["t1": WhatIfMod(editedScore: 100)])), 100, accuracy: 0.001)
        XCTAssertEqual(
            try XCTUnwrap(calcCourseGrade([tests, hw], mods: [:], added: ["h": [CustomAssignment(name: "x", score: 0, pointsPossible: 100)]])),
            (90 * 60 + 50 * 40) / 100, accuracy: 0.001)
    }

    func testRequiredFinalScore() {
        // 90% now, final worth 20%, want 90% overall → need 90%.
        XCTAssertEqual(try XCTUnwrap(requiredFinalScore(currentGrade: 90, finalWeightPercent: 20, target: 90)), 90, accuracy: 0.001)
        XCTAssertEqual(try XCTUnwrap(requiredFinalScore(currentGrade: 80, finalWeightPercent: 25, target: 90)), 120, accuracy: 0.001)
        XCTAssertNil(requiredFinalScore(currentGrade: 80, finalWeightPercent: 0, target: 90))
        XCTAssertNil(requiredFinalScore(currentGrade: 80, finalWeightPercent: 100, target: 90))
        XCTAssertNil(requiredFinalScore(currentGrade: nil, finalWeightPercent: 20, target: 90))
    }
}
