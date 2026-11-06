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

/// What the student chose to keep with "Stay signed in", so an expired IC session can be replaced silently.
/// Lives only in this device's Keychain and is only ever typed into the district's own IC login page.
struct StoredCredentials: Codable, Equatable {
    var username: String
    var password: String
    /// The district these were saved for: never replayed against another one.
    var baseUrl: String
}

@MainActor
@Observable
final class AppModel {
    enum Phase { case launching, signedOut, signedIn }
    enum Load: Equatable { case idle, loading, loaded, failed(String) }

    private enum Key {
        static let session = "vela_ic_session"
        static let credentials = "vela_ic_credentials"
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
    private(set) var hasSavedLogin = false

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
        if let base = DemoData.mockBase {
            let root = base + "/campus/mock"
            let district = District(name: "Mock District", baseURL: root, appName: "mock", stateCode: "CA")
            lastDistrict = district
            KeychainStore.delete(Key.session)
            KeychainStore.delete(Key.credentials)
            hasSavedLogin = false
            if DemoData.mockStale {
                let stale = StoredSession(
                    ic: IcSession(cookies: "JSESSIONID=stale; appName=mock", baseUrl: root, appName: "mock", personId: "1", displayName: "Mock Student"),
                    districtName: district.name, stateCode: "CA")
                KeychainStore.save(stale, for: Key.session)
                KeychainStore.save(StoredCredentials(username: DemoData.mockUser, password: DemoData.mockPassword, baseUrl: root), for: Key.credentials)
                hasSavedLogin = true
                session = stale
                phase = .signedIn
            } else {
                phase = .signedOut
            }
            return
        }
        #endif
        FirebaseSession.shared.configure()
        lastDistrict = Persistence.load(District.self, for: Key.district)
        courses = Persistence.load([ICCourse].self, for: Key.courses) ?? []
        scheduleEntries = Persistence.load([ScheduleEntry].self, for: Key.schedule) ?? []
        customBells = Persistence.load([BellSchedule].self, for: Key.bells)
        session = KeychainStore.load(StoredSession.self, for: Key.session)
        hasSavedLogin = KeychainStore.load(StoredCredentials.self, for: Key.credentials) != nil
        phase = session == nil ? .signedOut : .signedIn
        if session == nil { courses = []; scheduleEntries = [] }
    }

    // MARK: Login

    /// Called once the login web view has produced a live IC cookie jar.
    func completeLogin(_ result: IcLoginResult, district: District) async {
        isFinishingLogin = true
        loginError = nil
        defer { isFinishingLogin = false }

        let base = district.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        var ic = IcSession(cookies: result.cookies, baseUrl: base, appName: district.appName)
        guard let person = await ICClient(session: ic).fetchPersonInfo() else {
            loginError = "Signed in, but couldn't verify your student profile. Please try again."
            return
        }
        ic.personId = person.personId
        ic.displayName = person.displayName.isEmpty ? nil : person.displayName

        let stored = StoredSession(ic: ic, districtName: district.name, stateCode: district.stateCode)
        KeychainStore.save(stored, for: Key.session)
        Persistence.save(district, for: Key.district)
        // Only saved after IC accepted them; turning "Stay signed in" off on a later login forgets saved ones.
        if let c = result.credentials {
            KeychainStore.save(StoredCredentials(username: c.username, password: c.password, baseUrl: base), for: Key.credentials)
        } else if !result.remember {
            KeychainStore.delete(Key.credentials)
        }
        hasSavedLogin = KeychainStore.load(StoredCredentials.self, for: Key.credentials) != nil
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
        KeychainStore.delete(Key.credentials)
        hasSavedLogin = false
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

    /// Forget the saved login but stay signed in until the session expires.
    func forgetSavedLogin() {
        KeychainStore.delete(Key.credentials)
        hasSavedLogin = false
    }

    // MARK: Session upkeep

    private static let reauthTimeout: Duration = .seconds(45)
    private var reauthTask: Task<StoredSession?, Never>?

    /// Confirms the session is still valid and, if not, tries to establish a new one without the user via an
    /// off-screen IC login using the saved credentials. Returns nil when that isn't possible. The session is only
    /// cleared (sending the user to sign in) when IC clearly says it has expired, never for being offline, a timeout
    /// or a server error. Concurrent callers share one attempt.
    @discardableResult
    func reauth() async -> StoredSession? {
        if let reauthTask { return await reauthTask.value }
        let task = Task { [weak self] () -> StoredSession? in
            guard let self else { return nil }
            // Upper bound on one attempt, so a hung request can't block every later reauth behind it.
            return await withTaskGroup(of: StoredSession?.self) { group in
                group.addTask { await self.attemptReauth() }
                group.addTask { try? await Task.sleep(for: Self.reauthTimeout); return nil }
                let first = await group.next() ?? nil
                group.cancelAll()
                return first
            }
        }
        reauthTask = task
        let result = await task.value
        reauthTask = nil
        return result
    }

    private func attemptReauth() async -> StoredSession? {
        guard let current = session else { return nil }
        // Anything that replaced or cleared the session meanwhile (sign-out, a manual re-login) wins over this attempt.
        func stillCurrent() -> Bool { session == current }

        let client = ICClient(session: current.ic)
        let person = await withTaskGroup(of: (personId: String, displayName: String)?.self) { group in
            group.addTask { await client.fetchPersonInfo() }
            group.addTask { try? await Task.sleep(for: .seconds(10)); return nil }
            let first = await group.next() ?? nil
            group.cancelAll()
            return first
        }
        if person != nil { return current }

        // fetchPersonInfo can't tell "offline" from "expired". Never throw away a session (or burn a login attempt)
        // just because there's no network.
        guard await client.isReachable() else { return nil }
        let authState = await client.probeAuth()
        if authState == .valid { return current }

        // Sessions without a personId predate it being required: no way to confirm a refreshed one is the same student.
        if let district = lastDistrict, let personId = current.ic.personId, stillCurrent(),
           let saved = KeychainStore.load(StoredCredentials.self, for: Key.credentials),
           Self.sameBase(saved.baseUrl, district.baseURL) {
            let ic = current.ic
            let job = SilentIcLogin(
                baseURL: district.baseURL, appName: district.appName,
                credentials: (saved.username, saved.password),
                // Must still be the same student: saved credentials or leftover cookies for someone else must never
                // swap whose grades (and whose account's data) this session shows.
                verify: { cookies in
                    var candidate = ic
                    candidate.cookies = cookies
                    return await ICClient(session: candidate).fetchPersonInfo()?.personId == personId
                })
            if let cookies = await job.run(), stillCurrent() {
                var next = current
                next.ic.cookies = cookies
                KeychainStore.save(next, for: Key.session)
                session = next
                return next
            }
        }

        if authState == .expired, stillCurrent() { expireSession() }
        return nil
    }

    private static func sameBase(_ a: String, _ b: String) -> Bool {
        func n(_ s: String) -> String { s.trimmingCharacters(in: CharacterSet(charactersIn: "/")).lowercased() }
        return n(a) == n(b)
    }

    private var lastSessionCheck = Date.distantPast

    /// Called when the app returns to the foreground and periodically while it stays there.
    func keepAlive(force: Bool = false) async {
        guard session != nil, force || Date().timeIntervalSince(lastSessionCheck) > 60 else { return }
        lastSessionCheck = Date()
        await reauth()
    }

    /// Runs `op` against the current session; on failure, repairs the session (silent re-login) and retries once.
    private func withSession<T>(_ op: (ICClient) async throws -> T) async throws -> T {
        guard let s = session else { throw ICClient.ICError.sessionExpired("Not signed in.") }
        do {
            return try await op(ICClient(session: s.ic))
        } catch {
            // IC understood and said no (seat full, closed): a fresh login won't change the answer.
            if case ICClient.ICError.refused = error { throw error }
            // @vela/ic-client folds network errors into the same "expired" error as a real 401, so check IC is
            // reachable first: otherwise being offline would trigger a pointless login attempt.
            guard await ICClient(session: s.ic).isReachable(), let fresh = await reauth() else { throw error }
            return try await op(ICClient(session: fresh.ic))
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
