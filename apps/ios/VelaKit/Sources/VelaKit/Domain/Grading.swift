import Foundation

// Port of packages/domain/src/{grading,gpa}.ts

public func percentageToLetter(_ pct: Double) -> String {
    if pct >= 97 { return "A+" }
    if pct >= 93 { return "A" }
    if pct >= 90 { return "A-" }
    if pct >= 87 { return "B+" }
    if pct >= 83 { return "B" }
    if pct >= 80 { return "B-" }
    if pct >= 77 { return "C+" }
    if pct >= 73 { return "C" }
    if pct >= 70 { return "C-" }
    if pct >= 67 { return "D+" }
    if pct >= 63 { return "D" }
    if pct >= 60 { return "D-" }
    return "F"
}

private let basePoints: [String: Double] = [
    "A+": 4.0, "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7,
    "C+": 2.3, "C": 2.0, "C-": 1.7, "D+": 1.3, "D": 1.0, "D-": 0.7, "F": 0.0,
]

public func letterToGpaPoints(_ letter: String, courseType: String = "STANDARD") -> Double {
    let pts = basePoints[letter] ?? 0
    let boost: Double = (courseType == "AP" || courseType == "DUAL_ENROLLMENT") ? 1.0 : courseType == "HONORS" ? 0.5 : 0
    return pts > 0 ? min(pts + boost, 5.0) : 0
}

public struct CourseGradeInput: Sendable {
    public var courseId: String
    public var courseName: String
    public var percentage: Double
    public var courseType: String
    public var creditHours: Double

    public init(courseId: String, courseName: String, percentage: Double, courseType: String, creditHours: Double = 1) {
        self.courseId = courseId; self.courseName = courseName; self.percentage = percentage
        self.courseType = courseType; self.creditHours = creditHours
    }
}

public struct GpaResult: Equatable, Sendable {
    public var weighted: Double
    public var unweighted: Double
}

private func round2(_ v: Double) -> Double { (v * 100).rounded() / 100 }

public func calculateGpa(_ courses: [CourseGradeInput]) -> GpaResult {
    guard !courses.isEmpty else { return GpaResult(weighted: 0, unweighted: 0) }
    var weighted = 0.0, unweighted = 0.0, credits = 0.0
    for c in courses {
        let letter = percentageToLetter(c.percentage)
        weighted += letterToGpaPoints(letter, courseType: c.courseType) * c.creditHours
        unweighted += letterToGpaPoints(letter, courseType: "STANDARD") * c.creditHours
        credits += c.creditHours
    }
    return credits > 0
        ? GpaResult(weighted: round2(weighted / credits), unweighted: round2(unweighted / credits))
        : GpaResult(weighted: 0, unweighted: 0)
}

public extension Array where Element == ICCourse {
    /// GPA over courses that have a grade, each worth one credit.
    var gpa: GpaResult {
        calculateGpa(compactMap { c in
            c.currentGrade.map {
                CourseGradeInput(courseId: c.id, courseName: c.name, percentage: $0, courseType: c.courseType)
            }
        })
    }
}
