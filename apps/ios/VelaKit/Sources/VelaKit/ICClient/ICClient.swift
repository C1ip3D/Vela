import Foundation

/// Port of packages/ic-client/src/{api,client,loginSignals,hostValidation}.ts (read-only calls).
///
/// Talks to Infinite Campus directly from the device. IC credentials never
/// pass through here — only the cookie jar the login WebView produced.
public struct ICClient: Sendable {
    public enum ICError: LocalizedError, Sendable {
        case sessionExpired(String)
        /// IC understood the request and said no (seat full, session closed, teacher-placed).
        case refused(String)
        public var errorDescription: String? {
            switch self { case .sessionExpired(let m), .refused(let m): return m }
        }
    }

    public enum AuthState: Sendable { case valid, expired, unknown }

    private static let userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"

    public var session: IcSession
    private let urlSession: URLSession

    public init(session: IcSession, urlSession: URLSession? = nil) {
        self.session = session
        if let urlSession {
            self.urlSession = urlSession
        } else {
            // We attach the Cookie header ourselves; the shared jar must not interfere.
            let config = URLSessionConfiguration.ephemeral
            config.httpShouldSetCookies = false
            config.httpCookieAcceptPolicy = .never
            config.timeoutIntervalForRequest = 30
            self.urlSession = URLSession(configuration: config)
        }
    }

    // MARK: Request plumbing

    public static func headers(for session: IcSession) -> [String: String] {
        let xsrf = session.cookies.split(separator: ";")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .first { $0.hasPrefix("XSRF-TOKEN=") }
            .flatMap { $0.split(separator: "=", maxSplits: 1).last.map(String.init) } ?? ""
        var h: [String: String] = [
            "Cookie": session.cookies,
            "Accept": "application/json",
            "User-Agent": userAgent,
        ]
        if !xsrf.isEmpty { h["X-XSRF-TOKEN"] = xsrf }
        if !session.appName.isEmpty {
            h["appName"] = session.appName
            h["X-Campus-AppName"] = session.appName
            h["Referer"] = "\(session.baseUrl)/portal/students/\(session.appName)"
        }
        return h
    }

    static func appQuery(_ s: IcSession) -> String {
        s.appName.isEmpty ? "" : "?appName=\(s.appName.addingPercentEncoding(withAllowedCharacters: .urlQueryValueAllowed) ?? s.appName)"
    }

    static func appParam(_ s: IcSession) -> String {
        s.appName.isEmpty ? "" : "&appName=\(s.appName.addingPercentEncoding(withAllowedCharacters: .urlQueryValueAllowed) ?? s.appName)"
    }

    private func request(_ path: String, session: IcSession? = nil, noCache: Bool = false) -> URLRequest? {
        let s = session ?? self.session
        guard let url = URL(string: s.baseUrl + path) else { return nil }
        var req = URLRequest(url: url)
        for (k, v) in Self.headers(for: s) { req.setValue(v, forHTTPHeaderField: k) }
        if noCache {
            req.cachePolicy = .reloadIgnoringLocalCacheData
            req.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        }
        return req
    }

    /// GET returning parsed JSON, or nil on any network, status or parse failure (IC answers an expired session with an HTML login page).
    private func getJSON(_ path: String, session: IcSession? = nil, noCache: Bool = false) async -> JSON? {
        guard let req = request(path, session: session, noCache: noCache),
              let (data, resp) = try? await urlSession.data(for: req),
              let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { return nil }
        return try? JSON(data: data)
    }

    // MARK: Courses

    public func fetchCourses() async throws -> [ICCourse] {
        let q = Self.appQuery(session)

        // Endpoint 1: prism API (newer IC versions)
        if let json = await getJSON("/prism/api/portal/grades\(q)") {
            let parsed = Parsers.parseCoursesResilient(json)
            if !parsed.isEmpty { return parsed }
        }
        // Endpoint 2: legacy resources/portal/grades
        if let json = await getJSON("/resources/portal/grades\(q)") {
            let parsed = Parsers.parseCoursesResilient(json)
            if !parsed.isEmpty { return parsed }
        }
        // Endpoint 3: /api/portal/students -> /api/portal/students/{id}/grades
        if let req = request("/api/portal/students\(q)"), let (data, resp) = try? await urlSession.data(for: req),
           let http = resp as? HTTPURLResponse {
            if (200..<300).contains(http.statusCode), let json = try? JSON(data: data) {
                let courses = await coursesForStudents(json, session: session)
                if !courses.isEmpty { return courses }
            } else if http.statusCode == 400 {
                // Self-healing: IC sometimes tells us the correct appName in the error body.
                let text = String(decoding: data, as: UTF8.self)
                if text.contains("conflicting app name values"),
                   let recovered = (try? JSON(data: data))?["appName"].string, !recovered.isEmpty {
                    var retry = session
                    retry.appName = recovered
                    if let json = await getJSON("/api/portal/students\(Self.appQuery(retry))", session: retry) {
                        let courses = await coursesForStudents(json, session: retry)
                        if !courses.isEmpty { return courses }
                    }
                }
            }
        }
        throw ICError.sessionExpired("Session expired or unable to fetch grades. Please log in again.")
    }

    private func coursesForStudents(_ studentsData: JSON, session s: IcSession) async -> [ICCourse] {
        let list = studentsData.array ?? studentsData["data"].array ?? []
        let q = Self.appQuery(s)
        var courses = [ICCourse]()
        for student in list {
            guard let personId = (student["personID"] ?? student["personId"] ?? student["id"]).stringified, !personId.isEmpty else { continue }
            if let grades = await getJSON("/api/portal/students/\(personId)/grades\(q)", session: s) {
                courses.append(contentsOf: Parsers.parseCoursesResilient(grades))
            }
        }
        return courses
    }

    // MARK: Assignments

    public func fetchAssignments(courseId: String) async throws -> [ICAssignmentGroup] {
        let q = Self.appQuery(session)
        let aq = Self.appParam(session)
        var groups = [ICAssignmentGroup]()
        // Distinguishes "session expired" from "IC responded but this course has no assignment data yet".
        var gotSuccessfulResponse = false

        // Endpoint 1: prism assignmentDetail
        if let json = await getJSON("/prism/api/portal/grades/assignmentDetail?courseSectionID=\(courseId)\(aq)") {
            gotSuccessfulResponse = true
            let parsed = Parsers.parsePrismAssignments(json)
            if !parsed.isEmpty { groups = parsed }
        }
        // Endpoint 2: legacy resources assignment
        if groups.isEmpty, let json = await getJSON("/resources/portal/assignment?courseSectionID=\(courseId)\(aq)") {
            gotSuccessfulResponse = true
            let parsed = Parsers.parseLegacyAssignments(json)
            if !parsed.isEmpty { groups = parsed }
        }

        // Fetch the grades payload once — used for alternate IDs and as a fallback source.
        var rosterID: String?
        var altID: String?
        var gradesData: JSON?
        if let json = await getJSON("/resources/portal/grades\(q)") {
            gotSuccessfulResponse = true
            gradesData = json
            let all = (json.array ?? []).flatMap { e in
                (e["terms"].array ?? []).flatMap { t in t["courses"].array ?? [] }
            }
            if let match = all.first(where: { c in
                ["sectionID", "courseSectionID", "_id", "rosterID"].contains { c[$0].stringified == courseId }
            }) {
                rosterID = match["rosterID"].stringified
                altID = match["_id"].stringified
            }
        }

        // Endpoint 3: detail endpoint with alternate IDs
        if groups.isEmpty {
            var seen = Set<String>()
            for id in [courseId, rosterID, altID].compactMap({ $0 }) where seen.insert(id).inserted {
                if let json = await getJSON("/resources/portal/grades/detail/\(id)\(q)") {
                    gotSuccessfulResponse = true
                    let parsed = Parsers.parseLegacyAssignments(json)
                    if !parsed.isEmpty { groups = parsed; break }
                }
            }
        }
        // Endpoint 4: extract from the grades payload already fetched
        if groups.isEmpty, let gradesData {
            let extracted = Parsers.extractAssignmentsFromGrades(gradesData, courseId: courseId)
            if !extracted.isEmpty { groups = extracted }
        }
        // Endpoint 5/6: student-specific assignment endpoints (legacy + prism)
        if groups.isEmpty, let personId = session.personId {
            var seen = Set<String>()
            let ids = [rosterID, altID, courseId].compactMap { $0 }.filter { seen.insert($0).inserted }
            for id in ids where groups.isEmpty {
                if let json = await getJSON("/api/portal/students/\(personId)/assignments?courseSectionID=\(id)\(aq)") {
                    gotSuccessfulResponse = true
                    let parsed = Parsers.parseLegacyAssignments(json)
                    if !parsed.isEmpty { groups = parsed }
                }
            }
            for id in ids where groups.isEmpty {
                if let json = await getJSON("/prism/api/portal/students/\(personId)/assignments?courseSectionID=\(id)\(aq)") {
                    gotSuccessfulResponse = true
                    let parsed = Parsers.parsePrismAssignments(json)
                    if !parsed.isEmpty { groups = parsed }
                }
            }
        }

        // Only throw if IC never answered successfully (token fully expired).
        guard gotSuccessfulResponse else {
            throw ICError.sessionExpired("Session expired or could not reach Infinite Campus.")
        }
        return Parsers.filterToCurrentSemester(groups)
    }

    // MARK: Person

    private static func person(from data: JSON) -> (personId: String, displayName: String)? {
        let person = data.array != nil ? data[0] : (data["data"][0].isNull ? data : data["data"][0])
        guard !person.isNull, let id = (person["personID"] ?? person["personId"] ?? person["id"]).stringified, !id.isEmpty else { return nil }
        let first = person["firstName"].string, last = person["lastName"].string
        let name: String
        if let first, let last, !first.isEmpty, !last.isEmpty { name = "\(first) \(last)" }
        else { name = (person["displayName"] ?? person["name"]).string ?? "" }
        return (id, name)
    }

    /// Resolves the IC personId + display name for a freshly authenticated session.
    public func fetchPersonInfo() async -> (personId: String, displayName: String)? {
        let q = Self.appQuery(session)

        if let json = await getJSON("/prism/api/portal/person\(q)"), let p = Self.person(from: json) { return p }

        if let json = await getJSON("/api/portal/students\(q)") {
            let students = json.array ?? json["data"].array ?? []
            if let first = students.first, let p = Self.person(from: first) { return p }
        }

        if let json = await getJSON("/resources/portal/grades\(q)") {
            let enrollment = json.array != nil ? json[0] : json
            if let id = (enrollment["personID"] ?? enrollment["personId"] ?? enrollment["student"]["personID"] ?? enrollment["student"]["personId"]).stringified, !id.isEmpty {
                let name = (enrollment["student"]["displayName"] ?? enrollment["displayName"] ?? enrollment["student"]["name"]).string ?? ""
                return (id, name)
            }
        }

        if let json = await getJSON("/prism/api/portal/grades\(q)") {
            let item = json.array != nil ? json[0] : (json["data"][0].isNull ? json : json["data"][0])
            if let id = (item["personID"] ?? item["personId"] ?? item["student"]["personID"]).stringified, !id.isEmpty {
                let name = (item["student"]["displayName"] ?? item["displayName"]).string ?? ""
                return (id, name)
            }
        }
        return nil
    }

    // MARK: Schedule

    /// Fetches the class schedule (course, period, room, teacher, weekdays) from IC's portal roster. IC's roster has no bell times.
    public func fetchSchedule(today: String, dayTypeDays: [String: [Int]]) async throws -> [ScheduleEntry] {
        // IC answers 400 when the roster call also carries `appName`, so it's omitted.
        // `_expand` spelling varies by IC version; try the known forms, plain last.
        for expand in ["sectionPlacements", "{sectionPlacements-term}", ""] {
            let expandPart = expand.isEmpty ? "" : "_expand=\(expand.addingPercentEncoding(withAllowedCharacters: .urlQueryValueAllowed) ?? expand)&"
            if let json = await getJSON("/resources/portal/roster?\(expandPart)_crossSite=true", noCache: true) {
                return Parsers.parseRosterSchedule(json, today: today, dayTypeDays: dayTypeDays)
            }
        }
        throw ICError.sessionExpired("Session expired or unable to fetch the schedule. Please log in again.")
    }

    // MARK: Responsive scheduling (flex periods)

    /// Fetches the student's flex-period sessions with every offering, its seats left, and which one the student is in.
    public func fetchResponsiveSchedule() async throws -> [ICResponsiveSession] {
        let q = Self.appQuery(session)
        let aq = Self.appParam(session)
        let expired = ICError.sessionExpired("Session expired or unable to fetch the responsive schedule. Please log in again.")

        // The endpoint is keyed by enrollment (calendar + schedule structure), so look those up first.
        guard let studentsJSON = await getJSON("/api/portal/students\(q)") else { throw expired }
        let students = studentsJSON.array ?? studentsJSON["data"].array ?? []

        struct Enrollment: Hashable { var personID, calendarID, structureID: String }
        var seen = Set<Enrollment>()
        var enrollments = [Enrollment]()
        for s in students {
            for e in s["enrollments"].array ?? [] {
                guard let person = (e["personID"] ?? s["personID"]).stringified,
                      let calendar = e["calendarID"].stringified, let structure = e["structureID"].stringified else { continue }
                let item = Enrollment(personID: person, calendarID: calendar, structureID: structure)
                if seen.insert(item).inserted { enrollments.append(item) } // ask IC once per pair
            }
        }

        var byId = [String: ICResponsiveSession]()
        var unreachable = 0
        for e in enrollments {
            // Must be fresh: right after a sign-up, a cached copy would show the old pick and seat counts.
            let path = "/resources/prism/portal/responsiveSchedule?calendarID=\(e.calendarID)&personID=\(e.personID)&structureID=\(e.structureID)\(aq)"
            guard let req = request(path, noCache: true), let (data, resp) = try? await urlSession.data(for: req),
                  let http = resp as? HTTPURLResponse else { unreachable += 1; continue }
            if http.statusCode == 401 || http.statusCode == 403 { unreachable += 1; continue }
            // A school without Responsive Scheduling answers with an error: no flex periods for this enrollment.
            guard (200..<300).contains(http.statusCode) else { continue }
            // IC redirects an expired session to its HTML login page.
            guard let json = try? JSON(data: data) else { unreachable += 1; continue }
            for var s in Parsers.parseResponsiveSessions(json) {
                s.personId = e.personID
                s.calendarId = e.calendarID
                byId[s.id] = s
            }
        }

        // Report expiry (so callers can re-login) rather than "no flex periods" when no enrollment could be read.
        if !enrollments.isEmpty && unreachable == enrollments.count { throw expired }
        return byId.values.sorted { ($0.startDate ?? "") < ($1.startDate ?? "") }
    }

    /// Signs the student up for one offering of a session (or switches their pick), the same call IC's own portal makes.
    /// Throws with IC's message when it refuses (full, closed, teacher-placed, expired login).
    public func selectResponsiveOffering(personId: String, calendarId: String, responsiveSessionId: String, offeringId: String) async throws {
        guard var req = request("/resources/prism/portal/responsiveSchedule/update\(Self.appQuery(session))") else {
            throw ICError.sessionExpired("Couldn't reach Infinite Campus. Check your connection and try again.")
        }
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Int] = [
            "personID": Int(personId) ?? 0, "responsiveSessionID": Int(responsiveSessionId) ?? 0,
            "calendarID": Int(calendarId) ?? 0, "responsiveOfferingID": Int(offeringId) ?? 0,
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let data: Data, resp: URLResponse
        do { (data, resp) = try await urlSession.data(for: req) }
        catch { throw ICError.sessionExpired("Couldn't reach Infinite Campus. Check your connection and try again.") }

        // IC redirects an expired session to its HTML login page.
        guard let json = try? JSON(data: data) else { throw ICError.sessionExpired("Session expired. Please log in again.") }
        let ok = ((resp as? HTTPURLResponse).map { (200..<300).contains($0.statusCode) } ?? false) && json["success"] == .bool(true)
        if !ok {
            let message = json["message"].string.flatMap { $0.isEmpty ? nil : $0 } ?? "Infinite Campus rejected the change."
            throw ICError.refused(message)
        }
    }

    // MARK: Session health

    public func isReachable(timeout: TimeInterval = 8) async -> Bool {
        guard var req = request("") else { return false }
        req.httpMethod = "HEAD"
        req.timeoutInterval = timeout
        return (try? await urlSession.data(for: req)) != nil
    }

    /// Asks IC directly whether the cookies are still logged in, so a 5xx, timeout or rate limit is never mistaken for an expired session.
    public func probeAuth(timeout: TimeInterval = 8) async -> AuthState {
        guard var req = request("/prism/api/portal/person\(Self.appQuery(session))") else { return .unknown }
        req.timeoutInterval = timeout
        guard let (_, resp) = try? await urlSession.data(for: req), let http = resp as? HTTPURLResponse else { return .unknown }
        if http.statusCode == 401 || http.statusCode == 403 { return .expired }
        let finalURL = http.url?.absoluteString ?? ""
        // IC usually answers an expired session by redirecting to its HTML login page rather than with a 401.
        if finalURL.range(of: #"/portal/students/|login"#, options: [.regularExpression, .caseInsensitive]) != nil,
           finalURL.range(of: "/prism/api/", options: .caseInsensitive) == nil { return .expired }
        if (200..<300).contains(http.statusCode) {
            return (http.value(forHTTPHeaderField: "Content-Type") ?? "").contains("json") ? .valid : .expired
        }
        return .unknown
    }

    // MARK: District directory

    /// Searches Infinite Campus's public district directory.
    public static func searchDistricts(query: String, stateCode: String, urlSession: URLSession = .shared) async throws -> [IcDistrictSearchResult] {
        var comps = URLComponents(string: "https://mobile.infinitecampus.com/api/district/searchDistrict")!
        comps.queryItems = [URLQueryItem(name: "query", value: query), URLQueryItem(name: "state", value: stateCode)]
        var req = URLRequest(url: comps.url!)
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue("Mozilla/5.0 (Vela Academic Navigator)", forHTTPHeaderField: "User-Agent")
        let (data, resp) = try await urlSession.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw ICError.sessionExpired("District search failed.")
        }
        let json = try JSON(data: data)
        return (json["data"].array ?? []).map { d in
            IcDistrictSearchResult(
                district_name: d["district_name"].string,
                district_baseurl: d["district_baseurl"].string,
                district_app_name: d["district_app_name"].string,
                state_code: d["state_code"].string,
                staff_login_url: d["staff_login_url"].string,
                student_login_url: d["student_login_url"].string,
                parent_login_url: d["parent_login_url"].string
            )
        }
    }
}

// MARK: Login signals (packages/ic-client/src/loginSignals.ts)

public enum IcLoginSignals {
    public static let failureURLMarkers = ["error", "failed", "verify.jsp", "login", "noappname"]
    public static let failureBodyMarkers = ["username and/or password", "error in the application", "signinform"]

    public static func isFailedRedirectURL(_ url: String) -> Bool {
        let l = url.lowercased()
        return failureURLMarkers.contains { l.contains($0) }
    }

    public static func containsFailureMarkers(_ body: String) -> Bool {
        let l = body.lowercased()
        return failureBodyMarkers.contains { l.contains($0) }
    }
}

extension CharacterSet {
    /// Allowed in a query value (stricter than `.urlQueryAllowed`, which permits `&` and `=`).
    static let urlQueryValueAllowed: CharacterSet = {
        var s = CharacterSet.urlQueryAllowed
        s.remove(charactersIn: "&=+?#/")
        return s
    }()
}
