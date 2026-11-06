import XCTest
@testable import VelaKit

private func json(_ s: String) -> JSON { try! JSON(data: Data(s.utf8)) }

final class JSONTests: XCTestCase {
    func testPreservesKeyOrderAndLooseAccess() {
        let j = json(#"{"b":1,"a":{"x":[1,"2",null,true]},"c":"éé😀"}"#)
        XCTAssertEqual(j.object?.keys, ["b", "a", "c"])
        XCTAssertEqual(j["a"]["x"][1].number, 2)
        XCTAssertTrue(j["a"]["x"][2].isNull)
        XCTAssertTrue(j["missing"]["deeper"].isNull)
        XCTAssertEqual(j["c"].string, "éé😀")
    }

    func testJSSemantics() {
        XCTAssertEqual(JSON.string("12.5abc").parsedFloat, 12.5)
        XCTAssertNil(JSON.string("abc").parsedFloat)
        XCTAssertNil(JSON.string("12.5abc").number)
        XCTAssertEqual(JSON.number(42).stringified, "42")
        XCTAssertFalse(JSON.string("").truthy)
        XCTAssertFalse(JSON.number(0).truthy)
        XCTAssertTrue(JSON.array([]).truthy)
        XCTAssertEqual((JSON.null ?? JSON.string("x")).string, "x")
        XCTAssertEqual((JSON.number(0) ?? JSON.string("x")).number, 0)
    }

    func testRejectsGarbage() {
        XCTAssertThrowsError(try JSON(data: Data("<html>login</html>".utf8)))
        XCTAssertThrowsError(try JSON(data: Data(#"{"a":1,}"#.utf8)))
    }
}

final class CourseParserTests: XCTestCase {
    // Parity note: like the TypeScript parser, any node's `score` (including an assignment's)
    // can set the course grade, so the last one visited wins. The grade task comes last here.
    func testParsesNestedGradesPayload() {
        let payload = json("""
        [{"terms":[{"courses":[
          {"courseName":"AP Calculus BC","courseNumber":"MA101","sectionID":501,"teacherDisplay":"Smith, J","sectionNumber":2,
           "gradingTasks":[{"assignments":[
              {"assignmentName":"HW 1","score":"9","totalPoints":10,"dueDate":"2026-10-01","missing":false},
              {"assignmentName":"HW 2","score":null,"totalPoints":10,"dueDate":"2026-10-08","turnInStatus":"missing"}]},
              {"progressPercent":94.5,"progressGrade":"A"}]},
          {"courseName":"English 10 Honors","courseNumber":"EN10","sectionID":502}
        ]}]}]
        """)
        let courses = Parsers.parseCoursesResilient(payload)
        XCTAssertEqual(courses.map(\.id), ["501", "502"])
        let calc = courses[0]
        XCTAssertEqual(calc.courseType, "AP")
        XCTAssertEqual(calc.currentGrade, 94.5)
        XCTAssertEqual(calc.letterGrade, "A")
        XCTAssertEqual(calc.teacher, "Smith, J")
        XCTAssertEqual(calc.period, "2")
        XCTAssertEqual(calc.missingCount, 1)
        XCTAssertEqual(calc.assignments.map(\.name), ["HW 1", "HW 2"])
        XCTAssertEqual(calc.assignments[0].score, 9)
        XCTAssertNil(calc.assignments[1].score)
        XCTAssertEqual(courses[1].courseType, "HONORS")
        XCTAssertNil(courses[1].currentGrade)
    }

    func testDuplicateSectionPrefersTheGradedEntry() {
        let payload = json("""
        [{"courseName":"Chem","sectionID":7},{"courseName":"Chem","sectionID":7,"score":88.0}]
        """)
        let courses = Parsers.parseCoursesResilient(payload)
        XCTAssertEqual(courses.count, 1)
        XCTAssertEqual(courses[0].currentGrade, 88)
    }

    func testJunkInput() {
        XCTAssertEqual(Parsers.parseCoursesResilient(json("null")), [])
        XCTAssertEqual(Parsers.parseCoursesResilient(json("{\"a\":[1,2,{}]}")), [])
    }
}

final class AssignmentParserTests: XCTestCase {
    func testPrismShape() {
        let g = Parsers.parsePrismAssignments(json("""
        {"data":[{"categoryID":3,"categoryName":"Tests","weight":"40","score":{"percent":91.234},
          "assignments":[{"assignmentID":9,"assignmentName":"Unit 1","totalPoints":50,
            "score":{"points":45,"percent":90},"dueDate":"2026-10-20T00:00:00.000-07","late":true}]}]}
        """))
        XCTAssertEqual(g.count, 1)
        XCTAssertEqual(g[0].name, "Tests")
        XCTAssertEqual(g[0].weight, 40)
        XCTAssertEqual(g[0].score ?? 0, 91.234, accuracy: 0.0001)
        XCTAssertEqual(g[0].assignments[0].grade, "90.00%")
        XCTAssertEqual(g[0].assignments[0].score, 45)
        XCTAssertTrue(g[0].assignments[0].late)
    }

    func testLegacyDetailsMergesCategoriesAndSortsNewestFirst() {
        let g = Parsers.parseLegacyAssignments(json("""
        {"details":[{"categories":[{"groupID":1,"name":"HW","weight":20,"assignments":[
           {"assignmentID":1,"assignmentName":"Old","totalPoints":10,"score":8,"dueDate":"2026-09-01"},
           {"assignmentID":2,"assignmentName":"New","totalPoints":10,"score":9,"scorePercentage":90,"dueDate":"2026-10-01"}]}]}]}
        """))
        XCTAssertEqual(g.count, 1)
        XCTAssertEqual(g[0].assignments.map(\.name), ["New", "Old"])
        XCTAssertEqual(g[0].assignments[0].grade, "90.00%")
    }

    func testSemesterFilterDropsOldAssignmentsAndEmptyGroups() {
        let old = ICDetailAssignment(id: "1", name: "Old", pointsPossible: 1, score: nil, grade: nil, submittedAt: nil, missing: false, late: false, dueAt: "2025-01-01")
        let recent = ICDetailAssignment(id: "2", name: "Recent", pointsPossible: 1, score: nil, grade: nil, submittedAt: nil, missing: false, late: false, dueAt: "2026-10-01")
        let undated = ICDetailAssignment(id: "3", name: "Undated", pointsPossible: 1, score: nil, grade: nil, submittedAt: nil, missing: false, late: false, dueAt: nil)
        let now = ISO8601DateFormatter().date(from: "2026-11-05T12:00:00Z")!
        let out = Parsers.filterToCurrentSemester([
            ICAssignmentGroup(id: "a", name: "A", weight: 0, score: nil, assignments: [old, recent, undated]),
            ICAssignmentGroup(id: "b", name: "B", weight: 0, score: nil, assignments: [old]),
        ], now: now)
        XCTAssertEqual(out.count, 1)
        XCTAssertEqual(out[0].assignments.map(\.name), ["Recent", "Undated"])
    }

    func testExtractFromGradesPayloadByAnyId() {
        let data = json("""
        [{"terms":[{"courses":[{"sectionID":10,"rosterID":99,"gradingTasks":[{"taskName":"Q1","categories":[
           {"name":"Quizzes","weight":30,"assignments":[{"assignmentID":1,"assignmentName":"Quiz","totalPoints":5,"score":4}]}]}]}]}]}]
        """)
        XCTAssertEqual(Parsers.extractAssignmentsFromGrades(data, courseId: "99").first?.name, "Quizzes")
        XCTAssertEqual(Parsers.extractAssignmentsFromGrades(data, courseId: "10").first?.assignments.count, 1)
        XCTAssertEqual(Parsers.extractAssignmentsFromGrades(data, courseId: "nope"), [])
    }
}

final class RosterParserTests: XCTestCase {
    let dayTypeDays = BellPresets.emeraldDayTypeDays

    func roster() throws -> JSON {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "roster", withExtension: "json", subdirectory: "Fixtures"))
        return try JSON(data: Data(contentsOf: url))
    }

    func testMirrorsTypeScriptRosterTests() throws {
        let r = try roster()
        let entries = Parsers.parseRosterSchedule(r, today: "2026-11-05", dayTypeDays: dayTypeDays)

        XCTAssertFalse(entries.map(\.courseName).contains("Last Year Art"))
        XCTAssertEqual(entries.first { $0.courseName == "Test Calculus" }?.term, "Semester 1")
        XCTAssertEqual(entries.first { $0.courseName == "Test Calculus" }?.days, [1, 2, 3, 5])
        XCTAssertEqual(entries.first { $0.courseName == "Test Chemistry" }?.days, [1, 2, 4, 5])
        XCTAssertEqual(entries.first { $0.period == "Access" }?.days, [1, 3, 4])
        XCTAssertEqual(entries.count, 3)
        XCTAssertTrue(entries.allSatisfy { $0.source == .ic })
        XCTAssertEqual(entries.map(\.period), ["2", "5", "Access"])

        let next = Parsers.parseRosterSchedule(r, today: "2027-02-01", dayTypeDays: dayTypeDays)
        XCTAssertEqual(next.map(\.courseName), ["Test Calculus"])
        XCTAssertEqual(next.first?.term, "Semester 2")
    }

    func testJunkInput() {
        XCTAssertEqual(Parsers.parseRosterSchedule(.null, today: "2026-11-05", dayTypeDays: dayTypeDays), [])
        XCTAssertEqual(Parsers.parseRosterSchedule(json("[{}]"), today: "2026-11-05", dayTypeDays: dayTypeDays), [])
    }
}

final class ClientHeaderTests: XCTestCase {
    func testHeadersIncludeXsrfAndAppName() {
        let s = IcSession(cookies: "JSESSIONID=a; XSRF-TOKEN=tok123; appName=x", baseUrl: "https://ic.example.org", appName: "x")
        let h = ICClient.headers(for: s)
        XCTAssertEqual(h["X-XSRF-TOKEN"], "tok123")
        XCTAssertEqual(h["appName"], "x")
        XCTAssertEqual(h["Referer"], "https://ic.example.org/portal/students/x")
    }

    func testLoginSignals() {
        XCTAssertTrue(IcLoginSignals.isFailedRedirectURL("https://x/portal/students/a.jsp?status=Login-Failed"))
        XCTAssertFalse(IcLoginSignals.isFailedRedirectURL("https://x/campus/nav-wrapper/student"))
        XCTAssertTrue(IcLoginSignals.containsFailureMarkers("Invalid Username and/or Password"))
    }
}
