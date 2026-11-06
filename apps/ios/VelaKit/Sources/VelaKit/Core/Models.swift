import Foundation

// MARK: IC session & data (ports of packages/ic-client/src/types.ts)

public struct IcSession: Codable, Equatable, Sendable {
    public var cookies: String
    public var baseUrl: String
    public var appName: String
    public var personId: String?
    public var displayName: String?

    public init(cookies: String, baseUrl: String, appName: String, personId: String? = nil, displayName: String? = nil) {
        self.cookies = cookies
        self.baseUrl = baseUrl
        self.appName = appName
        self.personId = personId
        self.displayName = displayName
    }
}

public struct ICAssignment: Codable, Equatable, Hashable, Sendable {
    public var key: String
    public var name: String
    public var score: Double?
    public var maxScore: Double?
    public var dueDate: String?

    public init(key: String, name: String, score: Double? = nil, maxScore: Double? = nil, dueDate: String? = nil) {
        self.key = key; self.name = name; self.score = score; self.maxScore = maxScore; self.dueDate = dueDate
    }
}

public struct ICCourse: Codable, Equatable, Hashable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var courseCode: String
    public var term: String
    public var courseType: String
    public var currentGrade: Double?
    public var letterGrade: String?
    public var missingCount: Int
    public var teacher: String?
    public var period: String?
    public var assignments: [ICAssignment]

    public init(
        id: String, name: String, courseCode: String = "", term: String = "",
        courseType: String = "STANDARD", currentGrade: Double? = nil, letterGrade: String? = nil,
        missingCount: Int = 0, teacher: String? = nil, period: String? = nil, assignments: [ICAssignment] = []
    ) {
        self.id = id; self.name = name; self.courseCode = courseCode; self.term = term
        self.courseType = courseType; self.currentGrade = currentGrade; self.letterGrade = letterGrade
        self.missingCount = missingCount; self.teacher = teacher; self.period = period
        self.assignments = assignments
    }

    /// Letter shown in the UI: IC's own, else derived from the percentage.
    public var displayLetter: String? {
        letterGrade ?? currentGrade.map(percentageToLetter)
    }

    /// Course name without a trailing "(...)" qualifier, as the dashboard shows it.
    public var shortName: String {
        name.replacingOccurrences(of: #"\s*\(.*?\)\s*$"#, with: "", options: .regularExpression)
    }
}

public struct ICDetailAssignment: Codable, Equatable, Hashable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var pointsPossible: Double
    public var score: Double?
    public var grade: String?
    public var submittedAt: String?
    public var missing: Bool
    public var late: Bool
    public var dueAt: String?

    public init(id: String, name: String, pointsPossible: Double, score: Double? = nil, grade: String? = nil,
                submittedAt: String? = nil, missing: Bool = false, late: Bool = false, dueAt: String? = nil) {
        self.id = id; self.name = name; self.pointsPossible = pointsPossible; self.score = score
        self.grade = grade; self.submittedAt = submittedAt; self.missing = missing; self.late = late; self.dueAt = dueAt
    }
}

public struct ICAssignmentGroup: Codable, Equatable, Hashable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var weight: Double
    public var score: Double?
    public var assignments: [ICDetailAssignment]

    public init(id: String, name: String, weight: Double, score: Double? = nil, assignments: [ICDetailAssignment]) {
        self.id = id; self.name = name; self.weight = weight; self.score = score; self.assignments = assignments
    }
}

public struct IcDistrictSearchResult: Codable, Equatable, Hashable, Sendable {
    public var district_name: String?
    public var district_baseurl: String?
    public var district_app_name: String?
    public var state_code: String?
    public var staff_login_url: String?
    public var student_login_url: String?
    public var parent_login_url: String?
}

// MARK: Schedule (port of packages/types/src/schedule.ts)

public enum ScheduleSource: String, Codable, Sendable { case ic, manual, upload }

public struct BellPeriod: Codable, Equatable, Hashable, Sendable {
    public var period: String
    public var label: String?
    public var start: String
    public var end: String

    public init(period: String, start: String, end: String, label: String? = nil) {
        self.period = period; self.start = start; self.end = end; self.label = label
    }
}

public struct BellSchedule: Codable, Equatable, Hashable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var days: [Int]
    public var dates: [String]?
    public var periods: [BellPeriod]
    public var timezone: String?

    public init(id: String, name: String, days: [Int], dates: [String]? = nil, periods: [BellPeriod], timezone: String? = nil) {
        self.id = id; self.name = name; self.days = days; self.dates = dates
        self.periods = periods; self.timezone = timezone
    }
}

public struct ScheduleEntry: Codable, Equatable, Hashable, Sendable {
    public var period: String
    public var courseName: String
    public var teacher: String?
    public var room: String?
    public var days: [Int]?
    public var term: String?
    public var source: ScheduleSource

    public init(period: String, courseName: String, teacher: String? = nil, room: String? = nil,
                days: [Int]? = nil, term: String? = nil, source: ScheduleSource = .ic) {
        self.period = period; self.courseName = courseName; self.teacher = teacher
        self.room = room; self.days = days; self.term = term; self.source = source
    }
}

public struct ScheduleSlot: Equatable, Sendable {
    public var entry: ScheduleEntry
    public var period: String
    public var startMinutes: Int
    public var endMinutes: Int
}
