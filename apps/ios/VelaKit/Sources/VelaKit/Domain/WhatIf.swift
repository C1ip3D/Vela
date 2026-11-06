import Foundation

// Port of the what-if grade math in apps/mobile/app/(tabs)/courses/[courseId].tsx

/// A hypothetical change to one assignment: a different score, and/or dropped from the grade.
public struct WhatIfMod: Equatable, Sendable {
    public var editedScore: Double?
    public var dropped: Bool

    public init(editedScore: Double? = nil, dropped: Bool = false) {
        self.editedScore = editedScore
        self.dropped = dropped
    }
}

/// An imaginary assignment added to a category.
public struct CustomAssignment: Equatable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var score: Double
    public var pointsPossible: Double

    public init(id: String = UUID().uuidString, name: String, score: Double, pointsPossible: Double) {
        self.id = id; self.name = name; self.score = score; self.pointsPossible = pointsPossible
    }
}

/// Percent for one category: points earned / points possible over scored, non-dropped assignments plus extras.
/// Nil when nothing in the category counts yet.
public func calcGroupScore(
    _ assignments: [ICDetailAssignment],
    mods: [String: WhatIfMod],
    extras: [CustomAssignment] = []
) -> Double? {
    var earned = 0.0, possible = 0.0, counted = 0
    for a in assignments {
        let mod = mods[a.id]
        if mod?.dropped == true { continue }
        guard let score = mod?.editedScore ?? a.score, a.pointsPossible > 0 else { continue }
        earned += score
        possible += a.pointsPossible
        counted += 1
    }
    if counted == 0 && extras.isEmpty { return nil }
    for e in extras {
        earned += e.score
        possible += e.pointsPossible
    }
    return possible > 0 ? earned / possible * 100 : nil
}

/// Course percent: weighted by category weight when any category has one, else a plain average of category percents.
public func calcCourseGrade(
    _ groups: [ICAssignmentGroup],
    mods: [String: WhatIfMod],
    added: [String: [CustomAssignment]] = [:]
) -> Double? {
    if groups.contains(where: { $0.weight > 0 }) {
        var weightedSum = 0.0, totalWeight = 0.0
        for g in groups {
            if let s = calcGroupScore(g.assignments, mods: mods, extras: added[g.id] ?? []), g.weight > 0 {
                weightedSum += s * g.weight
                totalWeight += g.weight
            }
        }
        return totalWeight > 0 ? weightedSum / totalWeight : nil
    }
    let scores = groups.compactMap { calcGroupScore($0.assignments, mods: mods, extras: added[$0.id] ?? []) }
    return scores.isEmpty ? nil : scores.reduce(0, +) / Double(scores.count)
}

/// Score needed on a final worth `finalWeightPercent` of the grade to finish at `target`.
/// Nil unless the weight is strictly between 0 and 100 and a current grade is known.
public func requiredFinalScore(currentGrade: Double?, finalWeightPercent: Double, target: Double) -> Double? {
    guard let currentGrade, finalWeightPercent > 0, finalWeightPercent < 100 else { return nil }
    let w = finalWeightPercent / 100
    return (target - currentGrade * (1 - w)) / w
}
