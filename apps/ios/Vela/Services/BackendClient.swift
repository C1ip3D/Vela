import Foundation
import VelaKit
import FirebaseCore
import FirebaseAuth

/// Runtime config injected through Info.plist from Config/*.xcconfig.
enum AppConfig {
    private static func string(_ key: String) -> String? {
        let v = Bundle.main.object(forInfoDictionaryKey: key) as? String
        return (v?.isEmpty == false && v?.hasPrefix("$(") == false) ? v : nil
    }

    static var apiBaseURL: URL? { string("VelaAPIBaseURL").flatMap(URL.init(string:)) }
    static var firebaseAPIKey: String? { string("VelaFirebaseAPIKey") }
    static var firebaseAppID: String? { string("VelaFirebaseAppID") }
    static var firebaseProjectID: String? { string("VelaFirebaseProjectID") }
    static var firebaseSenderID: String? { string("VelaFirebaseSenderID") }
}

/// Firebase Auth, configured programmatically so no GoogleService-Info.plist is needed.
/// When the keys are absent, `isAvailable` is false and the app runs IC-only.
@MainActor
final class FirebaseSession {
    static let shared = FirebaseSession()
    private(set) var isAvailable = false

    func configure() {
        guard FirebaseApp.app() == nil,
              let key = AppConfig.firebaseAPIKey, let appID = AppConfig.firebaseAppID,
              let project = AppConfig.firebaseProjectID, let sender = AppConfig.firebaseSenderID else { return }
        let options = FirebaseOptions(googleAppID: appID, gcmSenderID: sender)
        options.apiKey = key
        options.projectID = project
        FirebaseApp.configure(options: options)
        isAvailable = true
    }

    func signIn(customToken: String) async throws {
        guard isAvailable else { return }
        _ = try await Auth.auth().signIn(withCustomToken: customToken)
    }

    func idToken() async -> String? {
        guard isAvailable, let user = Auth.auth().currentUser else { return nil }
        return try? await user.getIDToken()
    }

    func signOut() {
        guard isAvailable else { return }
        try? Auth.auth().signOut()
    }
}

/// The Vela backend (Next.js today, Hono soon — same routes and contract).
struct BackendClient {
    struct MintResponse: Decodable {
        let firebaseCustomToken: String
        let personId: String
        let displayName: String?
    }

    enum BackendError: Error { case notConfigured, badStatus(Int) }

    private var base: URL? { AppConfig.apiBaseURL }

    private func send<B: Encodable>(_ method: String, _ path: String, body: B?, bearer: String? = nil) async throws -> Data {
        guard let base, let url = URL(string: path, relativeTo: base) else { throw BackendError.notConfigured }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.timeoutInterval = 15
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let bearer { req.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization") }
        if let body { req.httpBody = try JSONEncoder().encode(body) }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw BackendError.badStatus(status) }
        return data
    }

    private func post<B: Encodable>(_ path: String, body: B, bearer: String? = nil) async throws -> Data {
        try await send("POST", path, body: body, bearer: bearer)
    }

    /// The student's saved bell schedules, or nil when they haven't customised any (the backend then serves a preset).
    func customBells(idToken: String) async throws -> [BellSchedule]? {
        struct Response: Decodable { let bellsSource: String; let bells: [BellSchedule] }
        let data = try await send("GET", "/api/schedule", body: Optional<String>.none, bearer: idToken)
        let r = try JSONDecoder().decode(Response.self, from: data)
        return r.bellsSource == "custom" ? r.bells : nil
    }

    func saveBells(_ bells: [BellSchedule], idToken: String) async throws {
        struct Body: Encodable { let bells: [BellSchedule] }
        _ = try await send("PUT", "/api/schedule/bell", body: Body(bells: bells), bearer: idToken)
    }

    /// Backend re-verifies the IC cookies against the district server, then mints a Firebase custom token.
    func mintToken(session: IcSession, districtName: String, stateCode: String) async throws -> MintResponse {
        struct Body: Encodable { let cookies, baseUrl, appName, districtName, stateCode: String }
        let data = try await post("/api/ic/mint-token", body: Body(
            cookies: session.cookies, baseUrl: session.baseUrl, appName: session.appName,
            districtName: districtName, stateCode: stateCode))
        return try JSONDecoder().decode(MintResponse.self, from: data)
    }

    /// Best-effort grade snapshot. Failure never affects what the app shows.
    func syncCourses(session: IcSession, districtName: String?, stateCode: String?, idToken: String) async {
        struct Body: Encodable {
            let authToken, baseUrl, appName: String
            let personId, districtName, stateCode: String?
        }
        _ = try? await post("/api/ic/courses", body: Body(
            authToken: session.cookies, baseUrl: session.baseUrl, appName: session.appName,
            personId: session.personId, districtName: districtName, stateCode: stateCode), bearer: idToken)
    }
}
