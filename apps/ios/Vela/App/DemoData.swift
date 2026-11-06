#if DEBUG
import Foundation
import VelaKit

/// Launch with `-VelaDemo` to skip sign-in and show fixture data (no network). Debug builds only.
enum DemoData {
    static var isEnabled: Bool { ProcessInfo.processInfo.arguments.contains("-VelaDemo") }

    static let session = StoredSession(
        ic: IcSession(cookies: "demo", baseUrl: "https://icampus.dublinusd.org/campus/dublinusd", appName: "dublinusd",
                      personId: "1", displayName: "Alex Student"),
        districtName: "Dublin Unified", stateCode: "CA")

    static let courses: [ICCourse] = [
        ICCourse(id: "1", name: "AP Calculus BC", courseCode: "MA301", courseType: "AP", currentGrade: 94.5, letterGrade: "A", teacher: "Smith, J", period: "2"),
        ICCourse(id: "2", name: "English 11 Honors (H)", courseCode: "EN201", courseType: "HONORS", currentGrade: 88.2, letterGrade: "B+", missingCount: 2, teacher: "Rivera, M", period: "3"),
        ICCourse(id: "3", name: "Chemistry", courseCode: "SC210", currentGrade: 76.9, letterGrade: "C", missingCount: 1, teacher: "Chen, L", period: "5"),
        ICCourse(id: "4", name: "US History", courseCode: "SS110", currentGrade: nil, teacher: "Okafor, T", period: "6"),
    ]

    static let entries: [ScheduleEntry] = [
        ScheduleEntry(period: "2", courseName: "AP Calculus BC", teacher: "Smith, J", room: "B12", days: [1, 2, 4, 5]),
        ScheduleEntry(period: "3", courseName: "English 11 Honors", teacher: "Rivera, M", room: "A4", days: [1, 2, 3, 5]),
        ScheduleEntry(period: "5", courseName: "Chemistry", teacher: "Chen, L", room: "S2", days: [1, 2, 3, 5]),
        ScheduleEntry(period: "6", courseName: "US History", teacher: "Okafor, T", room: "C9", days: [1, 2, 4, 5]),
        ScheduleEntry(period: "Access", courseName: "ACCESS", days: [1, 3, 4]),
    ]

    static let groups: [ICAssignmentGroup] = [
        ICAssignmentGroup(id: "t", name: "Tests", weight: 60, score: 92.1, assignments: [
            ICDetailAssignment(id: "1", name: "Unit 4 Test: Integrals", pointsPossible: 50, score: 46, grade: "92.00%", submittedAt: nil, missing: false, late: false, dueAt: "2026-11-02"),
            ICDetailAssignment(id: "2", name: "Unit 3 Test", pointsPossible: 50, score: 48.5, grade: "97.00%", submittedAt: nil, missing: false, late: true, dueAt: "2026-10-12"),
        ]),
        ICAssignmentGroup(id: "h", name: "Homework", weight: 40, score: 97, assignments: [
            ICDetailAssignment(id: "3", name: "Section 6.2 Practice", pointsPossible: 10, score: nil, grade: nil, submittedAt: nil, missing: true, late: false, dueAt: "2026-10-30"),
            ICDetailAssignment(id: "4", name: "Section 6.1 Practice", pointsPossible: 10, score: 10, grade: "100.00%", submittedAt: nil, missing: false, late: false, dueAt: "2026-10-28"),
        ]),
    ]

    private static func offering(_ id: String, _ name: String, teacher: String, room: String, max: Double, current: Double,
                                 description: String? = nil, selected: Bool = false, placed: Bool = false) -> ICResponsiveOffering {
        ICResponsiveOffering(id: id, name: name, description: description, teacher: teacher, room: room, maxStudents: max,
                             currentStudents: current, seatsLeft: Int(Swift.max(0, max - current)), isSelected: selected,
                             teacherAssigned: placed, teacherReason: placed ? "Missing unit test" : nil)
    }

    /// Today and next Tuesday relative to the device date, so the "upcoming" filter never hides them.
    static var flex: [ICResponsiveSession] {
        func key(_ days: Int) -> String { getLocalParts(Date().addingTimeInterval(Double(days) * 86400)).dateKey }
        let offerings = [
            offering("1", "Chemistry Help", teacher: "Chen, L", room: "S2", max: 25, current: 18, description: "Drop-in help for chemistry students."),
            offering("2", "Math Help / Study Hall", teacher: "Smith, J", room: "B12", max: 30, current: 30),
            offering("3", "Robotics Club", teacher: "Park, D", room: "Shop", max: 20, current: 18, description: "Build and test this season's robot."),
            offering("4", "Study Hall", teacher: "Okafor, T", room: "C9", max: 40, current: 12, selected: true),
            offering("5", "Art Studio", teacher: "Rivera, M", room: "A4", max: 15, current: 14),
            offering("6", "Peer Tutoring", teacher: "Nguyen, K", room: "Library", max: 12, current: 3),
        ]
        return [
            ICResponsiveSession(id: "d1", name: "Today ACCESS; \(key(0))", startDate: key(0), endDate: key(0), isOpen: true,
                                personId: "1", calendarId: "1", offerings: offerings, selectedOffering: offerings.first { $0.isSelected }),
            ICResponsiveSession(id: "d2", name: "Next ACCESS; \(key(4))", startDate: key(4), endDate: key(4), isOpen: false,
                                personId: "1", calendarId: "1", offerings: Array(offerings.prefix(2)), selectedOffering: nil),
        ]
    }
}
#endif
