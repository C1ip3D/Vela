import Foundation
import Observation
import VelaKit
import WebKit

struct District: Codable, Hashable, Identifiable {
    var name: String
    var baseURL: String
    var appName: String
    var stateCode: String
    var id: String { baseURL + "|" + appName }
}

/// The persisted IC session plus the district it belongs to (needed to re-verify custom-domain districts on the backend).
struct StoredSession: Codable, Equatable {
    var ic: IcSession
    var districtName: String?
    var stateCode: String?
}

@MainActor
@Observable
final class AppModel {
    enum Phase { case launching, signedOut, signedIn }
    enum Load: Equatable { case idle, loading, loaded, failed(String) }

    private enum Key {
        static let session = "vela_ic_session"
        static let district = "vela_ic_last_district"
        static let courses = "vela_cached_courses"
        static let schedule = "vela_schedule_entries"
        static let bells = "vela_custom_bells"
    }

    // Auth
    private(set) var phase: Phase = .launching
    private(set) var session: StoredSession?
    private(set) var lastDistrict: District?
    var loginError: String?
    private(set) var isFinishingLogin = false

    // Courses
    private(set) var courses: [ICCourse] = []
    private(set) var coursesState: Load = .idle
    private(set) var assignmentGroups: [String: [ICAssignmentGroup]] = [:]

    // Schedule
    private(set) var scheduleEntries: [ScheduleEntry] = []
    private(set) var customBells: [BellSchedule]?
    enum BellSaveResult { case synced, localOnly }
    private(set) var scheduleState: Load = .idle

    // Flex periods (responsive scheduling)
    private(set) var flexSessions: [ICResponsiveSession] = []
    private(set) var flexState: Load = .idle

    private let backend = BackendClient()
    private var lastSessionCheck = Date.distantPast

    // MARK: Derived

    var districtDefaults: DistrictScheduleDefaults? {
        defaultsForHostname(session.flatMap { URL(string: $0.ic.baseUrl)?.host })
    }
    var bells: [BellSchedule] { customBells ?? districtDefaults?.bells ?? [] }
    var usingPresetBells: Bool { customBells == nil && districtDefaults != nil }
    var gradedCourses: [ICCourse] { courses.filter { $0.currentGrade != nil } }
    var gpa: GpaResult { courses.gpa }
    var displayName: String? { session?.ic.displayName }

    // MARK: Lifecycle

    func bootstrap() {
        #if DEBUG
        if DemoData.isEnabled {
            session = DemoData.session
            courses = DemoData.courses
            scheduleEntries = DemoData.entries
            DemoData.courses.forEach { assignmentGroups[$0.id] = DemoData.groups }
            coursesState = .loaded
            scheduleState = .loaded
            phase = .signedIn
            return
        }
        #endif
        FirebaseSession.shared.configure()
        lastDistrict = Persistence.load(District.self, for: Key.district)
        courses = Persistence.load([ICCourse].self, for: Key.courses) ?? []
        scheduleEntries = Persistence.load([ScheduleEntry].self, for: Key.schedule) ?? []
        customBells = Persistence.load([BellSchedule].self, for: Key.bells)
        session = KeychainStore.load(StoredSession.self, for: Key.session)
        phase = session == nil ? .signedOut : .signedIn
        if session == nil { courses = []; scheduleEntries = [] }
    }

    // MARK: Login

    /// Called once the login web view has produced a live IC cookie jar.
    func completeLogin(cookies: String, district: District) async {
        isFinishingLogin = true
        loginError = nil
        defer { isFinishingLogin = false }

        let base = district.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        var ic = IcSession(cookies: cookies, baseUrl: base, appName: district.appName)
        guard let person = await ICClient(session: ic).fetchPersonInfo() else {
            loginError = "Signed in, but couldn't verify your student profile. Please try again."
            return
        }
        ic.personId = person.personId
        ic.displayName = person.displayName.isEmpty ? nil : person.displayName

        let stored = StoredSession(ic: ic, districtName: district.name, stateCode: district.stateCode)
        KeychainStore.save(stored, for: Key.session)
        Persistence.save(district, for: Key.district)
        session = stored
        lastDistrict = district
        courses = []
        scheduleEntries = []
        assignmentGroups = [:]
        coursesState = .idle
        scheduleState = .idle
        flexSessions = []
        flexState = .idle
        phase = .signedIn

        // Vela identity is best-effort: IC data loads on-device either way.
        Task { await signInToVela(stored) }
    }

    private func signInToVela(_ stored: StoredSession) async {
        guard FirebaseSession.shared.isAvailable else { return }
        do {
            let minted = try await backend.mintToken(
                session: stored.ic, districtName: stored.districtName ?? "", stateCode: stored.stateCode ?? "")
            try await FirebaseSession.shared.signIn(customToken: minted.firebaseCustomToken)
        } catch {
            // Backend down or not configured; grades still work.
        }
    }

    func signOut() async {
        FirebaseSession.shared.signOut()
        KeychainStore.delete(Key.session)
        [Key.courses, Key.schedule].forEach(Persistence.remove)
        session = nil
        courses = []
        scheduleEntries = []
        assignmentGroups = [:]
        coursesState = .idle
        scheduleState = .idle
        flexSessions = []
        flexState = .idle
        loginError = nil
        phase = .signedOut
        // Don't leave the previous student's IC login in any shared web store.
        let store = WKWebsiteDataStore.default()
        let records = await store.dataRecords(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes())
        await store.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), for: records)
    }

    /// IC clearly said the session is gone: send the user back to sign in (keeping the district for a quick re-login).
    private func expireSession() {
        KeychainStore.delete(Key.session)
        session = nil
        loginError = "Your Infinite Campus session expired. Please sign in again."
        phase = .signedOut
    }

    /// Re-checks the session when the app returns to the foreground. Offline or server errors never log the user out.
    func checkSessionIfNeeded() async {
        guard let s = session, Date().timeIntervalSince(lastSessionCheck) > 60 else { return }
        lastSessionCheck = Date()
        let client = ICClient(session: s.ic)
        guard await client.isReachable() else { return }
        if await client.probeAuth() == .expired, session == s { expireSession() }
    }

    /// Runs `op` against the current session; if it fails, only an *expired* session (not offline/5xx) signs the user out.
    private func withSession<T>(_ op: (ICClient) async throws -> T) async throws -> T {
        guard let s = session else { throw ICClient.ICError.sessionExpired("Not signed in.") }
        let client = ICClient(session: s.ic)
        do {
            return try await op(client)
        } catch {
            if await client.isReachable(), await client.probeAuth() == .expired, session == s {
                expireSession()
            }
            throw error
        }
    }

    // MARK: Courses

    func loadCourses(force: Bool = false) async {
        guard session != nil else { return }
        if coursesState == .loading { return }
        if !force, coursesState == .loaded { return }
        coursesState = .loading
        do {
            let fresh = try await withSession { try await $0.fetchCourses() }
            courses = fresh.map { c in
                var c = c
                if c.letterGrade == nil, let g = c.currentGrade { c.letterGrade = percentageToLetter(g) }
                return c
            }
            Persistence.save(courses, for: Key.courses)
            coursesState = .loaded
            syncSnapshot()
        } catch {
            coursesState = .failed(error.localizedDescription)
        }
    }

    private func syncSnapshot() {
        guard let s = session, FirebaseSession.shared.isAvailable else { return }
        let backend = self.backend
        Task.detached {
            guard let token = await FirebaseSession.shared.idToken() else { return }
            await backend.syncCourses(session: s.ic, districtName: s.districtName, stateCode: s.stateCode, idToken: token)
        }
    }

    func loadAssignments(courseId: String, force: Bool = false) async throws -> [ICAssignmentGroup] {
        if !force, let cached = assignmentGroups[courseId] { return cached }
        let groups = try await withSession { try await $0.fetchAssignments(courseId: courseId) }
        assignmentGroups[courseId] = groups
        return groups
    }

    // MARK: Flex periods

    func loadFlex(force: Bool = false) async {
        guard session != nil else { return }
        if flexState == .loading { return }
        if !force, flexState == .loaded { return }
        #if DEBUG
        if DemoData.isEnabled {
            if flexSessions.isEmpty { flexSessions = DemoData.flex }
            flexState = .loaded
            return
        }
        #endif
        flexState = .loading
        do {
            flexSessions = try await withSession { try await $0.fetchResponsiveSchedule() }
            flexState = .loaded
        } catch {
            flexSessions = []
            flexState = .failed(error.localizedDescription)
        }
    }

    /// Signs up for (or switches to) an offering, then reloads so seat counts and "your pick" are IC's truth.
    /// Throws IC's own message when it refuses (full, closed, teacher-placed).
    func selectFlexOffering(in target: ICResponsiveSession, offeringId: String) async throws {
        guard let current = session else { throw ICClient.ICError.sessionExpired("Not connected to Infinite Campus.") }
        #if DEBUG
        if DemoData.isEnabled {
            try await Task.sleep(for: .milliseconds(600))
            flexSessions = flexSessions.map { s in
                guard s.id == target.id else { return s }
                var s = s
                s.offerings = s.offerings.map { o in
                    var o = o
                    if o.isSelected { o.isSelected = false; o.currentStudents = (o.currentStudents ?? 1) - 1; o.seatsLeft = o.seatsLeft.map { $0 + 1 } }
                    if o.id == offeringId { o.isSelected = true; o.currentStudents = (o.currentStudents ?? 0) + 1; o.seatsLeft = o.seatsLeft.map { max(0, $0 - 1) } }
                    return o
                }
                s.selectedOffering = s.offerings.first { $0.isSelected }
                return s
            }
            return
        }
        #endif
        guard let personId = target.personId ?? current.ic.personId, let calendarId = target.calendarId else {
            throw ICClient.ICError.refused("Missing schedule details. Pull to refresh and try again.")
        }
        try await withSession {
            try await $0.selectResponsiveOffering(
                personId: personId, calendarId: calendarId, responsiveSessionId: target.id, offeringId: offeringId)
        }
        await loadFlex(force: true)
    }

    // MARK: Schedule

    /// Saves the student's own bell times on-device, then to their Vela account (shared with web). Local save always succeeds.
    func saveBells(_ next: [BellSchedule]) async -> BellSaveResult {
        customBells = next
        #if DEBUG
        if DemoData.isEnabled { return .localOnly } // never persist demo edits
        #endif
        Persistence.save(next, for: Key.bells)
        guard FirebaseSession.shared.isAvailable, let token = await FirebaseSession.shared.idToken() else { return .localOnly }
        do {
            try await backend.saveBells(next, idToken: token)
            return .synced
        } catch {
            return .localOnly
        }
    }

    /// Best-effort: pick up bell times the student saved from another device or web.
    private func pullCustomBells() async {
        guard FirebaseSession.shared.isAvailable, let token = await FirebaseSession.shared.idToken(),
              let remote = try? await backend.customBells(idToken: token) else { return }
        customBells = remote
        Persistence.save(remote, for: Key.bells)
    }

    func loadSchedule(force: Bool = false) async {
        guard session != nil else { return }
        Task { await pullCustomBells() }
        if scheduleState == .loading { return }
        if !force, scheduleState == .loaded { return }
        guard let defaults = districtDefaults else {
            if scheduleEntries.isEmpty { scheduleState = .failed("Schedules aren't supported for your district yet.") }
            return
        }
        scheduleState = .loading
        do {
            let today = getLocalParts(Date(), timeZone: defaults.timezone).dateKey
            let fresh = try await withSession {
                try await $0.fetchSchedule(today: today, dayTypeDays: defaults.dayTypeDays)
            }
            if !fresh.isEmpty {
                scheduleEntries = fresh
                Persistence.save(fresh, for: Key.schedule)
            }
            scheduleState = .loaded
        } catch {
            // A cached schedule keeps showing; only surface the error when there's nothing to show.
            scheduleState = scheduleEntries.isEmpty ? .failed(error.localizedDescription) : .loaded
        }
    }
}
