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
    /// Public pages served by the backend (apps/api/src/routes/legal.ts).
    static var privacyURL: URL? { apiBaseURL.flatMap { URL(string: "/privacy", relativeTo: $0)?.absoluteURL } }
    static var supportURL: URL? { apiBaseURL.flatMap { URL(string: "/support", relativeTo: $0)?.absoluteURL } }
    static var appVersion: String {
        let v = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
        let b = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""
        return b.isEmpty ? v : "\(v) (\(b))"
    }
    static var firebaseAPIKey: String? { string("VelaFirebaseAPIKey") }
    static var firebaseAppID: String? { string("VelaFirebaseAppID") }
    static var firebaseProjectID: String? { string("VelaFirebaseProjectID") }
    static var firebaseSenderID: String? { string("VelaFirebaseSenderID") }
}

/// Firebase Auth. Uses GoogleService-Info.plist when it is bundled; otherwise falls back to
/// the FIREBASE_* values from Config/*.xcconfig (so CI/demo builds work without the plist).
/// When neither is present, `isAvailable` is false and the app runs IC-only.
@MainActor
final class FirebaseSession {
    static let shared = FirebaseSession()
    private(set) var isAvailable = false

    func configure() {
        // Don't call FirebaseApp.app() here: it logs the "default app not configured" error when nil.
        guard !isAvailable else { return }
        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
            isAvailable = true
            return
        }
        guard let key = AppConfig.firebaseAPIKey, let appID = AppConfig.firebaseAppID,
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

/// The Vela backend (Hono, apps/api).
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

    /// Backend re-verifies the IC cookies against the district server, then mints a Firebase custom token.
    func mintToken(session: IcSession, districtName: String, stateCode: String) async throws -> MintResponse {
        struct Body: Encodable { let cookies, baseUrl, appName, districtName, stateCode: String }
        let data = try await post("/api/ic/mint-token", body: Body(
            cookies: session.cookies, baseUrl: session.baseUrl, appName: session.appName,
            districtName: districtName, stateCode: stateCode))
        return try JSONDecoder().decode(MintResponse.self, from: data)
    }

    /// Permanently deletes the Vela account and everything the server stores for it.
    func deleteAccount(idToken: String) async throws {
        _ = try await send("DELETE", "/api/account", body: nil as String?, bearer: idToken)
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
