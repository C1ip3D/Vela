import Foundation

/// Port of packages/ic-client/src/parsers.ts.
///
/// Infinite Campus's undocumented APIs return differently-shaped JSON per
/// district and IC version, so these hunt through the response recursively
/// rather than assuming one fixed shape. Key iteration order matters (it
/// decides which duplicate wins), which is why `JSON` preserves it.
public enum Parsers {

    // MARK: Courses

    static func detectCourseType(_ name: String) -> String {
        let u = name.uppercased()
        if u.contains("AP ") || u.contains("ADVANCED PLACEMENT") { return "AP" }
        if u.contains("HONORS") || u.contains("HON ") || u.contains("(H)") || u.contains("(HP)") { return "HONORS" }
        return "STANDARD"
    }

    private static func extractCourses(_ obj: JSON, into found: inout [JSON]) {
        switch obj {
        case .array(let items):
            for item in items { extractCourses(item, into: &found) }
        case .object(let o):
            let isCourse = obj["courseName"].string != nil
                || obj["courseNumber"].string != nil
                || (obj["name"].string != nil
                    && (obj["teacherDisplay"].truthy || obj["roomID"].truthy || obj["sectionID"].truthy))
            if isCourse {
                found.append(obj)
            } else {
                for key in o.keys { extractCourses(obj[key], into: &found) }
            }
        default:
            break
        }
    }

    /// Academic year runs Aug–Jul.
    static func currentAcademicTerm(now: Date = Date()) -> String {
        let cal = Calendar(identifier: .gregorian)
        let year = cal.component(.year, from: now)
        let month = cal.component(.month, from: now)
        let start = month >= 8 ? year : year - 1
        return "\(start)-\(start + 1)"
    }

    private static func isMissing(_ a: JSON) -> Bool {
        if (a["missing"] ?? a["isMissing"]).truthy { return true }
        if let s = a["turnInStatus"].string, s.uppercased() == "MISSING" { return true }
        if let s = a["status"].string, s.uppercased() == "MISSING" { return true }
        if a["scoreMarkingCode"].string == "M" { return true }
        if let flags = a["flags"].array, flags.contains(where: { $0.string?.uppercased() == "MISSING" }) { return true }
        return false
    }

    private struct GradeScan {
        var currentGrade: Double?
        var letterGrade: String?
        var missingCount = 0
        var assignments: [(key: String, value: ICAssignment)] = []

        mutating func upsert(_ a: ICAssignment) {
            if let i = assignments.firstIndex(where: { $0.key == a.key }) { assignments[i].value = a }
            else { assignments.append((a.key, a)) }
        }
    }

    private static func findGrades(_ node: JSON, courseId: String, scan: inout GradeScan) {
        guard node.isObject || node.isArray else { return }

        let score = node["score"] ?? node["percent"] ?? node["grade"]["percent"]
            ?? node["currentGrade"]["percent"] ?? node["progressPercent"] ?? node["progressScore"]
        let letter = node["gradeCalculated"] ?? node["grade"]["letter"] ?? node["letter"]
            ?? node["currentGrade"]["letter"] ?? node["progressGrade"]
        if score.number != nil, let parsed = score.parsedFloat {
            scan.currentGrade = parsed
            if letter.truthy, let l = letter.string { scan.letterGrade = l }
        }

        let list = node["assignments"] ?? node["tasks"] ?? node["gradebookEntries"] ?? node["items"]
        if let items = list.array {
            for a in items {
                let nameJSON = a["assignmentName"] ?? a["name"] ?? a["title"]
                guard let name = nameJSON.string, !name.isEmpty else { continue }
                let dueJSON = a["dueDate"] ?? a["due"]
                let due = dueJSON.truthy ? dueJSON.stringified : nil
                let key = (a["assignmentID"] ?? a["id"]).stringified ?? "\(courseId)_\(name)_\(dueJSON.stringified ?? "")"
                let aScore: Double? = a["score"].isNull ? nil : (a["score"].number != nil ? a["score"].parsedFloat : nil)
                let maxJSON = a["totalPoints"] ?? a["pointsPossible"] ?? a["maxScore"]
                let aMax: Double? = maxJSON.number != nil ? maxJSON.parsedFloat : nil
                if isMissing(a) { scan.missingCount += 1 }
                scan.upsert(ICAssignment(key: key, name: name, score: aScore, maxScore: aMax, dueDate: due))
            }
        }

        switch node {
        case .array(let items):
            for item in items { findGrades(item, courseId: courseId, scan: &scan) }
        case .object(let o):
            for key in o.keys {
                let child = node[key]
                if key == "postingPeriods" || key == "terms" || key == "gradingTasks" || child.isArray {
                    findGrades(child, courseId: courseId, scan: &scan)
                }
            }
        default: break
        }
    }

    public static func parseCoursesResilient(_ data: JSON) -> [ICCourse] {
        var raw = [JSON]()
        extractCourses(data, into: &raw)

        var order = [String]()
        var map = [String: ICCourse]()

        for cs in raw {
            let name = (cs["courseName"] ?? cs["name"]).string ?? "Unknown Course"
            let code = (cs["courseNumber"] ?? cs["code"] ?? cs["number"]).stringified ?? ""
            let id = (cs["courseSectionID"] ?? cs["sectionID"] ?? cs["id"]).stringified ?? code

            var scan = GradeScan()
            findGrades(cs, courseId: id, scan: &scan)
            let assignments = scan.assignments.map(\.value)
            let currentGrade = scan.currentGrade

            let replacesExisting = map[id].map { ($0.currentGrade ?? 0) == 0 && (currentGrade ?? 0) != 0 } ?? true
            if replacesExisting {
                if map[id] == nil { order.append(id) }
                map[id] = ICCourse(
                    id: id,
                    name: name,
                    courseCode: code,
                    term: (cs["calendarName"] ?? cs["termName"] ?? cs["term"]).string ?? currentAcademicTerm(),
                    courseType: detectCourseType(name),
                    currentGrade: currentGrade,
                    letterGrade: scan.letterGrade,
                    missingCount: scan.missingCount,
                    teacher: (cs["teacherDisplay"] ?? cs["teacher"] ?? cs["teacherName"]
                        ?? cs["staffDisplayName"] ?? cs["instructorName"]).string,
                    period: (cs["sectionNumber"] ?? cs["period"]).stringified,
                    assignments: assignments
                )
            } else if var e = map[id] {
                e.missingCount += scan.missingCount
                for a in assignments where !e.assignments.contains(where: { $0.key == a.key }) {
                    e.assignments.append(a)
                }
                map[id] = e
            }
        }
        return order.compactMap { map[$0] }
    }

    // MARK: Assignment groups

    /// "YYYY-MM-DD" prefix of an IC timestamp such as "2026-10-29T00:00:00.000-07".
    public static func datePrefix(_ s: String?) -> String? {
        guard let s, s.count >= 10 else { return nil }
        let p = String(s.prefix(10))
        let ok = p.enumerated().allSatisfy { i, c in (i == 4 || i == 7) ? c == "-" : c.isASCII && c.isNumber }
        return ok ? p : nil
    }

    static func currentSemesterStartKey(now: Date = Date()) -> String {
        let cal = Calendar(identifier: .gregorian)
        let year = cal.component(.year, from: now)
        let month = cal.component(.month, from: now) // 1-based
        return month >= 8 ? "\(year)-08-01" : "\(year)-01-01"
    }

    public static func filterToCurrentSemester(_ groups: [ICAssignmentGroup], now: Date = Date()) -> [ICAssignmentGroup] {
        let cutoff = currentSemesterStartKey(now: now)
        return groups.compactMap { g in
            var g = g
            g.assignments = g.assignments.filter { a in
                guard let key = datePrefix(a.dueAt) else { return true }
                return key >= cutoff
            }
            return g.assignments.isEmpty ? nil : g
        }
    }

    private static func sortByDueDesc(_ groups: inout [ICAssignmentGroup]) {
        for i in groups.indices {
            groups[i].assignments = groups[i].assignments.enumerated().sorted { l, r in
                let a = datePrefix(l.element.dueAt) ?? "", b = datePrefix(r.element.dueAt) ?? ""
                return a == b ? l.offset < r.offset : a > b
            }.map(\.element)
        }
    }

    private static func percentString(_ v: JSON) -> String? {
        v.parsedFloat.map { String(format: "%.2f%%", $0) }
    }

    public static func parsePrismAssignments(_ data: JSON) -> [ICAssignmentGroup] {
        let categories = (data["data"] ?? data["categories"]).array ?? []
        return categories.enumerated().map { i, cat in
            let assignments = cat["assignments"].array ?? []
            return ICAssignmentGroup(
                id: (cat["categoryID"] ?? cat["id"]).stringified ?? String(i),
                name: (cat["categoryName"] ?? cat["name"]).string ?? "Category \(i + 1)",
                weight: cat["weight"].floatOrZero,
                score: cat["score"]["percent"].parsedFloat,
                assignments: assignments.enumerated().map { j, a in
                    ICDetailAssignment(
                        id: (a["assignmentID"] ?? a["id"]).stringified ?? String(j),
                        name: (a["assignmentName"] ?? a["name"]).string ?? "Assignment",
                        pointsPossible: (a["totalPoints"] ?? a["pointsPossible"]).floatOrZero,
                        score: a["score"]["points"].parsedFloat,
                        grade: percentString(a["score"]["percent"]),
                        submittedAt: (a["turnInDate"] ?? a["submittedAt"]).string,
                        missing: (a["missing"] ?? a["isMissing"]).truthy,
                        late: (a["late"] ?? a["isLate"]).truthy,
                        dueAt: (a["dueDate"] ?? a["dueAt"]).string
                    )
                }
            )
        }
    }

    private static func legacyAssignment(_ a: JSON, index j: Int, idKeys: [String], gradeKeys: [String], submittedKeys: [String]) -> ICDetailAssignment {
        func first(_ keys: [String]) -> JSON {
            for k in keys where !a[k].isNull { return a[k] }
            return .null
        }
        let percentSource = first(gradeKeys)
        return ICDetailAssignment(
            id: first(idKeys).stringified ?? String(j),
            name: (a["assignmentName"] ?? a["name"]).string ?? "Assignment",
            pointsPossible: (a["totalPoints"] ?? a["pointsPossible"]).floatOrZero,
            score: a["score"].parsedFloat,
            grade: percentString(percentSource),
            submittedAt: first(submittedKeys).string,
            missing: (a["missing"] ?? a["isMissing"]).truthy,
            late: (a["late"] ?? a["isLate"]).truthy,
            dueAt: a["dueDate"].string
        )
    }

    public static func parseLegacyAssignments(_ data: JSON) -> [ICAssignmentGroup] {
        if let details = data["details"].array {
            var order = [String]()
            var map = [String: ICAssignmentGroup]()
            for detail in details {
                for cat in detail["categories"].array ?? [] {
                    let id = (cat["groupID"] ?? cat["id"] ?? cat["name"]).stringified ?? "Category"
                    let assigns = (cat["assignments"] ?? cat["Assignments"]).array ?? []
                    if map[id] == nil {
                        order.append(id)
                        map[id] = ICAssignmentGroup(
                            id: id,
                            name: (cat["name"] ?? cat["categoryName"]).string ?? "Category",
                            weight: cat["weight"].floatOrZero,
                            score: nil,
                            assignments: []
                        )
                    }
                    for (j, a) in assigns.enumerated() {
                        map[id]!.assignments.append(legacyAssignment(
                            a, index: j,
                            idKeys: ["assignmentID", "objectSectionID", "id"],
                            gradeKeys: ["scorePercentage", "percent"],
                            submittedKeys: ["turnInDate", "scoreModifiedDate"]
                        ))
                    }
                }
            }
            var groups = order.compactMap { map[$0] }
            sortByDueDesc(&groups)
            return groups
        }

        let tasks = (data["Task"] ?? data["tasks"] ?? data["GradingTask"]).array ?? []
        return tasks.enumerated().map { i, task in
            let assignments = (task["Assignments"] ?? task["assignments"]).array ?? []
            return ICAssignmentGroup(
                id: (task["taskID"] ?? task["id"]).stringified ?? String(i),
                name: (task["taskName"] ?? task["name"]).string ?? "Category \(i + 1)",
                weight: task["weight"].floatOrZero,
                score: task["score"].parsedFloat,
                assignments: assignments.enumerated().map { j, a in
                    legacyAssignment(a, index: j, idKeys: ["assignmentID", "id"], gradeKeys: ["percent"], submittedKeys: ["turnInDate"])
                }
            )
        }
    }

    public static func extractAssignmentsFromGrades(_ data: JSON, courseId: String) -> [ICAssignmentGroup] {
        let enrollments = data.array ?? (data["enrollments"] ?? data["data"]).array ?? []
        for enrollment in enrollments {
            for term in enrollment["terms"].array ?? [] {
                for course in term["courses"].array ?? [] {
                    let ids = ["sectionID", "courseSectionID", "_id", "rosterID"].map { course[$0].stringified ?? "" }
                    guard ids.contains(courseId) else { continue }

                    func assignmentGroup(id: String, name: String, weight: Double, score: Double?, list: [JSON], idKeys: [String], gradeKeys: [String], submittedKeys: [String]) -> ICAssignmentGroup {
                        ICAssignmentGroup(
                            id: id, name: name, weight: weight, score: score,
                            assignments: list.enumerated().map { j, a in
                                legacyAssignment(a, index: j, idKeys: idKeys, gradeKeys: gradeKeys, submittedKeys: submittedKeys)
                            }
                        )
                    }

                    var groups = [ICAssignmentGroup]()
                    let tasks = (course["gradingTasks"] ?? course["GradingTask"] ?? course["tasks"]).array ?? []
                    for task in tasks {
                        let categories = (task["categories"] ?? task["Categories"]).array ?? []
                        if !categories.isEmpty {
                            for cat in categories {
                                groups.append(assignmentGroup(
                                    id: (cat["groupID"] ?? cat["categoryID"] ?? cat["id"] ?? cat["name"]).stringified ?? "Category",
                                    name: (cat["name"] ?? cat["categoryName"] ?? task["taskName"]).string ?? "Category",
                                    weight: (cat["weight"] ?? task["weight"]).floatOrZero,
                                    score: cat["score"].parsedFloat,
                                    list: (cat["assignments"] ?? cat["Assignments"]).array ?? [],
                                    idKeys: ["assignmentID", "objectSectionID", "id"],
                                    gradeKeys: ["scorePercentage", "percent"],
                                    submittedKeys: ["turnInDate", "scoreModifiedDate"]
                                ))
                            }
                        } else {
                            groups.append(assignmentGroup(
                                id: (task["taskID"] ?? task["id"]).stringified ?? String(groups.count),
                                name: (task["taskName"] ?? task["name"]).string ?? "Assignments",
                                weight: task["weight"].floatOrZero,
                                score: task["score"].parsedFloat,
                                list: (task["assignments"] ?? task["Assignments"]).array ?? [],
                                idKeys: ["assignmentID", "objectSectionID", "id"],
                                gradeKeys: ["scorePercentage", "percent"],
                                submittedKeys: ["turnInDate"]
                            ))
                        }
                    }

                    if groups.isEmpty {
                        for cat in (course["categories"] ?? course["Categories"]).array ?? [] {
                            groups.append(assignmentGroup(
                                id: (cat["groupID"] ?? cat["categoryID"] ?? cat["id"] ?? cat["name"]).stringified ?? "Category",
                                name: (cat["name"] ?? cat["categoryName"]).string ?? "Category",
                                weight: cat["weight"].floatOrZero,
                                score: cat["score"].parsedFloat,
                                list: (cat["assignments"] ?? cat["Assignments"]).array ?? [],
                                idKeys: ["assignmentID", "id"],
                                gradeKeys: ["percent"],
                                submittedKeys: ["turnInDate"]
                            ))
                        }
                    }
                    sortByDueDesc(&groups)
                    return groups
                }
            }
        }
        return []
    }

    // MARK: Roster schedule

    /// Parses IC's portal roster into schedule entries, one per section + period, for the term(s) covering `today` ("YYYY-MM-DD", school timezone).
    /// `dayTypeDays` maps a placement's `periodScheduleName` (lower-cased) to weekdays; unknown day types are skipped.
    public static func parseRosterSchedule(_ raw: JSON, today: String, dayTypeDays: [String: [Int]]) -> [ScheduleEntry] {
        let rosters = raw.array ?? []
        let years = rosters.compactMap { $0["endYear"].number }
        guard let currentYear = years.max() else { return [] }

        var order = [String]()
        var byKey = [String: ScheduleEntry]()
        for roster in rosters where roster["endYear"].number == currentYear {
            for pl in roster["sectionPlacements"].array ?? [] {
                let start = (pl["term"]["startDate"] ?? pl["startDate"]).stringified ?? ""
                let end = (pl["term"]["endDate"] ?? pl["endDate"]).stringified ?? ""
                if start.isEmpty || end.isEmpty || today < start || today > end { continue }

                let dayType = (pl["periodScheduleName"].stringified ?? "").trimmingCharacters(in: .whitespaces).lowercased()
                let period = (pl["periodName"].stringified ?? "").trimmingCharacters(in: .whitespaces)
                guard let days = dayTypeDays[dayType], !period.isEmpty else { continue }

                let sectionId = (roster["sectionID"] ?? pl["sectionID"]).stringified ?? "undefined"
                let key = "\(sectionId)|\(period)"
                if var existing = byKey[key] {
                    existing.days = Array(Set((existing.days ?? []) + days)).sorted()
                    byKey[key] = existing
                    continue
                }
                order.append(key)
                byKey[key] = ScheduleEntry(
                    period: period,
                    courseName: (roster["courseName"] ?? pl["courseName"]).stringified?.trimmingCharacters(in: .whitespaces) ?? "",
                    teacher: (pl["teacherDisplay"] ?? roster["teacherDisplay"]).string,
                    room: (pl["roomName"] ?? roster["roomName"]).string,
                    days: days,
                    term: pl["termName"].string,
                    source: .ic
                )
            }
        }
        return order.compactMap { byKey[$0] }.enumerated().sorted { l, r in
            let c = l.element.period.compare(r.element.period, options: .numeric)
            return c == .orderedSame ? l.offset < r.offset : c == .orderedAscending
        }.map(\.element)
    }

    // MARK: Responsive scheduling

    private static func nonEmptyString(_ v: JSON) -> String? {
        guard let s = v.string?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty else { return nil }
        return s
    }

    private static func parseResponsiveOffering(_ raw: JSON) -> ICResponsiveOffering? {
        guard !raw["responsiveOfferingID"].isNull, let id = raw["responsiveOfferingID"].stringified else { return nil }
        let maxStudents = raw["maxStudents"].parsedFloat
        let current = raw["currentStudents"].parsedFloat
        return ICResponsiveOffering(
            id: id,
            name: nonEmptyString(raw["responsiveOfferingName"]) ?? "Untitled",
            description: nonEmptyString(raw["description"]),
            teacher: nonEmptyString(raw["teacherDisplay"]),
            room: nonEmptyString(raw["roomName"]),
            maxStudents: maxStudents,
            currentStudents: current,
            seatsLeft: (maxStudents != nil && current != nil) ? max(0, Int(maxStudents! - current!)) : nil,
            // IC's own portal treats a non-zero rosterID as "the student is enrolled here".
            isSelected: raw["rosterID"].truthy,
            teacherAssigned: raw["teacherRequest"].truthy,
            teacherReason: nonEmptyString(raw["reason"])
        )
    }

    /// Parses /resources/prism/portal/responsiveSchedule. Like IC's portal, drops sessions with no offerings and
    /// sorts offerings by name; sessions come back in date order.
    public static func parseResponsiveSessions(_ data: JSON) -> [ICResponsiveSession] {
        let list = data.array ?? data["data"].array ?? []
        var sessions = [ICResponsiveSession]()
        for raw in list {
            guard !raw["responsiveSessionID"].isNull, let id = raw["responsiveSessionID"].stringified else { continue }
            let offerings = (raw["offerings"].array ?? [])
                .compactMap(parseResponsiveOffering)
                .sorted { $0.name.lowercased() < $1.name.lowercased() }
            if offerings.isEmpty { continue }
            sessions.append(ICResponsiveSession(
                id: id,
                name: nonEmptyString(raw["sessionName"]) ?? "Flex period",
                startDate: datePrefix(raw["startDate"].string),
                endDate: datePrefix(raw["endDate"].string),
                isOpen: raw["sessionOpen"].truthy,
                personId: nil, calendarId: nil,
                offerings: offerings,
                selectedOffering: offerings.first { $0.isSelected }
            ))
        }
        return sessions.sorted { ($0.startDate ?? "") < ($1.startDate ?? "") }
    }
}
