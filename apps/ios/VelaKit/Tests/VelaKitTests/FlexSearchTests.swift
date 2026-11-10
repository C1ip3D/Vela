import XCTest
@testable import VelaKit

final class FlexSearchTests: XCTestCase {
    private func offering(_ id: String, _ name: String, teacher: String?, room: String? = nil) -> ICResponsiveOffering {
        ICResponsiveOffering(id: id, name: name, teacher: teacher, room: room)
    }

    func testTeacherLastName() {
        XCTAssertEqual(teacherLastName("Chen, Li"), "Chen")
        XCTAssertEqual(teacherLastName("  De La Cruz, Ana "), "De La Cruz")
        XCTAssertEqual(teacherLastName("Li Chen"), "Chen")
        XCTAssertEqual(teacherLastName("Martin Luther King Jr."), "King")
        XCTAssertEqual(teacherLastName("Okafor"), "Okafor")
        XCTAssertNil(teacherLastName(nil))
        XCTAssertNil(teacherLastName("   "))
    }

    func testEmptyQueryReturnsEverythingInOrder() {
        let all = [offering("1", "Study Hall", teacher: "Okafor, T"), offering("2", "Art", teacher: "Rivera, M")]
        XCTAssertEqual(searchOfferings(all, query: "  ").map(\.id), ["1", "2"])
    }

    func testLastNamePrefixRanksFirst() {
        let all = [
            offering("1", "Martial Arts", teacher: "Chen, Li"),        // name only
            offering("2", "Study Hall", teacher: "Smith, Martin"),     // first name
            offering("3", "Math Help", teacher: "Martinez, Ana"),      // last name
            offering("4", "Chemistry", teacher: "Park, D"),            // no match
        ]
        XCTAssertEqual(searchOfferings(all, query: "mart").map(\.id), ["3", "2", "1"])
    }

    func testMatchesRoomAndIgnoresCaseAndAccents() {
        let all = [offering("1", "Tutoring", teacher: "Peña, R", room: "Library"), offering("2", "Art", teacher: nil, room: "A4")]
        XCTAssertEqual(searchOfferings(all, query: "PENA").map(\.id), ["1"])
        XCTAssertEqual(searchOfferings(all, query: "libr").map(\.id), ["1"])
        XCTAssertEqual(searchOfferings(all, query: "zzz").map(\.id), [])
    }
}
