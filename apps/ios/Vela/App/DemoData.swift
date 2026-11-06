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
}
#endif
