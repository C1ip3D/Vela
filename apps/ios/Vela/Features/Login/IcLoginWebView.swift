import SwiftUI
import WebKit
import VelaKit

/// What a successful login hands back.
struct IcLoginResult {
    var cookies: String
    /// Only set when "Stay signed in" is on and the user typed into IC's form.
    var credentials: (username: String, password: String)?
    /// The toggle's value. Can be true with no credentials when IC skipped its form (already signed in), which must
    /// not be read as a reason to forget previously saved ones.
    var remember: Bool
}

/// Observable state shared between the web view coordinator and its SwiftUI chrome.
@MainActor
@Observable
final class IcLoginState {
    /// "Stay signed in" is always on: what the user types into IC's own form is kept in this device's Keychain.
    /// Users can clear it later with "Forget saved login" in Settings.
    let remember = true
    var error: String?
    var showManualFallback = false
    var isResolving = false
    var extractNow: (() -> Void)?
}

/// Hosts the district's real Infinite Campus login page. Vela never sees the password:
/// we watch navigation and the DOM for success, then lift the session cookies.
struct IcLoginWebView: UIViewRepresentable {
    let baseURL: String
    let appName: String
    let state: IcLoginState
    let onSuccess: (IcLoginResult) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Isolated, in-memory store: nothing from a previous student's login can leak in.
        config.websiteDataStore = .nonPersistent()
        let origin = context.coordinator.origin(context.coordinator.base)
        config.userContentController.addUserScript(WKUserScript(
            source: Self.credentialCaptureScript(origin: origin), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController.add(WeakScriptHandler(context.coordinator), name: "velaCreds")
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = .clear
        context.coordinator.web = web
        state.extractNow = { [weak coordinator = context.coordinator] in coordinator?.extractAndFinish() }
        if let url = URL(string: context.coordinator.loginURL) { web.load(URLRequest(url: url)) }
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "velaCreds")
    }

    /// Mirrors what the user types into IC's login form so "Stay signed in" can save it. Listens at the document level
    /// (capture phase) so it also works when IC renders its form client-side after load. Only runs on the district's own
    /// IC origin: never on an SSO provider's page, whose password isn't an IC one.
    static func credentialCaptureScript(origin: String) -> String {
        let originLiteral = (try? String(data: JSONEncoder().encode(origin), encoding: .utf8)) ?? "\"\""
        return """
        (function () {
          if (window.__velaCredentialCapture) return;
          if (location.origin.toLowerCase() !== \(originLiteral)) return;
          window.__velaCredentialCapture = true;
          function report() {
            var pw = document.querySelector('input[type="password"]');
            if (!pw || !pw.value) return;
            var form = pw.form || document;
            var user = form.querySelector('input[name="username"], input#username, input[type="email"], input[type="text"]');
            if (!user || !user.value) return;
            window.webkit.messageHandlers.velaCreds.postMessage({ username: user.value, password: pw.value });
          }
          ["input", "change", "submit", "click"].forEach(function (evt) { document.addEventListener(evt, report, true); });
        })();
        """
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        let parent: IcLoginWebView
        weak var web: WKWebView?
        let base: String
        let loginURL: String
        private var submitted = false
        private var resolving = false
        private var initialCookieNames: Set<String>?
        private var stuckTask: Task<Void, Never>?

        init(_ parent: IcLoginWebView) {
            self.parent = parent
            base = parent.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            loginURL = "\(base)/portal/students/\(parent.appName).jsp"
        }

        private static let scanScript = """
        (function () {
          try {
            var text = document.body ? (document.body.innerText || "") : "";
            var html = document.documentElement ? (document.documentElement.outerHTML || "") : "";
            var hasLoginForm = !!document.querySelector('input[type="password"]') || /student username/i.test(text);
            return JSON.stringify({ combined: (text + " " + html).toLowerCase(), hasLoginForm: hasLoginForm });
          } catch (e) { return JSON.stringify({ combined: "", hasLoginForm: true }); }
        })();
        """

        private var captured: (username: String, password: String)?

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "velaCreds", let body = message.body as? [String: Any],
                  let u = body["username"] as? String, let p = body["password"] as? String else { return }
            // Belt and braces with the script's own origin check.
            let o = message.frameInfo.securityOrigin
            let from = "\(o.protocol)://\(o.host)\(o.port > 0 ? ":\(o.port)" : "")".lowercased()
            if from == origin(base) { captured = (u, p) }
        }

        func origin(_ url: String) -> String {
            guard let u = URL(string: url), let scheme = u.scheme, let host = u.host else { return url.lowercased() }
            return "\(scheme)://\(host)\(u.port.map { ":\($0)" } ?? "")".lowercased()
        }

        private func cookies() async -> [HTTPCookie] {
            guard let web, let host = URL(string: base)?.host?.lowercased() else { return [] }
            let all = await web.configuration.websiteDataStore.httpCookieStore.allCookies()
            return all.filter {
                let d = $0.domain.hasPrefix(".") ? String($0.domain.dropFirst()) : $0.domain
                return host == d.lowercased() || host.hasSuffix("." + d.lowercased())
            }
        }

        private func fail(_ message: String) {
            parent.state.error = message
            submitted = false
            stuckTask?.cancel()
        }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
            if !submitted, action.request.url?.absoluteString.lowercased().contains("verify.jsp") == true {
                submitted = true
                parent.state.error = nil
                stuckTask?.cancel()
                stuckTask = Task { [weak self] in
                    try? await Task.sleep(for: .seconds(20))
                    if !Task.isCancelled { self?.parent.state.showManualFallback = true }
                }
            }
            return .allow
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            Task { await handleFinish(webView) }
        }

        private func handleFinish(_ webView: WKWebView) async {
            let url = webView.url?.absoluteString ?? ""

            if initialCookieNames == nil {
                initialCookieNames = Set(await cookies().map(\.name))
            }

            // IC's signed-in portal shell: a live session, even when IC skipped the form because cookies were still valid.
            if url.lowercased().contains("/nav-wrapper"), origin(url) == origin(base) {
                extractAndFinish()
                return
            }
            guard submitted, !resolving else { return }

            // Bounced back to a failure-shaped URL after submitting means bad credentials.
            if IcLoginSignals.isFailedRedirectURL(url), url.lowercased() != loginURL.lowercased() {
                fail("Invalid username or password. Please try again.")
                return
            }

            // The DOM decides the rest: a fresh anti-CSRF cookie can rotate on a *failed* attempt, so
            // "new cookie" only counts as success once the login form itself is gone.
            guard let raw = try? await webView.evaluateJavaScript(Self.scanScript) as? String,
                  let scan = try? JSON(data: Data(raw.utf8)) else { return }
            if IcLoginSignals.containsFailureMarkers(scan["combined"].string ?? "") {
                fail("Invalid username or password. Please try again.")
                return
            }
            if !scan["hasLoginForm"].truthy {
                let current = Set(await cookies().map(\.name))
                if !current.subtracting(initialCookieNames ?? []).isEmpty { extractAndFinish() }
            }
        }

        func extractAndFinish() {
            guard !resolving else { return }
            resolving = true
            parent.state.isResolving = true
            stuckTask?.cancel()
            Task {
                var jar = await cookies()
                for _ in 0..<4 where jar.isEmpty {
                    try? await Task.sleep(for: .milliseconds(400))
                    jar = await cookies()
                }
                guard !jar.isEmpty else {
                    resolving = false
                    parent.state.isResolving = false
                    parent.state.error = "Authenticated but could not read the session cookie."
                    return
                }
                var header = jar.map { "\($0.name)=\($0.value)" }.joined(separator: "; ")
                // IC needs an explicit appName cookie or later API calls fail with "conflicting app name values".
                if header.range(of: #"(^|;\s*)appName="#, options: .regularExpression) == nil {
                    header += "; appName=\(parent.appName)"
                }
                let remember = parent.state.remember
                parent.onSuccess(IcLoginResult(cookies: header, credentials: remember ? captured : nil, remember: remember))
            }
        }
    }
}

/// Full-screen sheet wrapping the IC login page with Vela chrome.
struct IcLoginSheet: View {
    let district: District
    let onSuccess: (IcLoginResult) -> Void
    let onCancel: () -> Void
    @State private var state = IcLoginState()

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button(action: onCancel) {
                    Image(systemName: "xmark")
                        .font(.body.weight(.semibold))
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Close sign in")
            }
            .padding(.leading, 20)
            .padding(.trailing, 4)
            .overlay(alignment: .bottom) { Divider().overlay(Palette.border) }

            if let error = state.error {
                ErrorBanner(message: error).padding(.horizontal, 20).padding(.top, 12)
            }

            ZStack {
                IcLoginWebView(baseURL: district.baseURL, appName: district.appName, state: state, onSuccess: onSuccess)
                if state.isResolving {
                    VStack(spacing: 12) {
                        ProgressView().controlSize(.large).tint(Palette.vela400)
                        Text("Finishing sign-in…").font(.subheadline).foregroundStyle(Palette.starDim)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Palette.void.opacity(0.85))
                }
            }

            if state.showManualFallback && !state.isResolving {
                VStack(spacing: 8) {
                    Text("Already signed in on the page above? Tap below to continue.")
                        .font(.caption).foregroundStyle(Palette.starDim)
                    Button("I'm signed in") { state.extractNow?() }
                        .buttonStyle(PrimaryButtonStyle())
                }
                .padding(20)
                .overlay(alignment: .top) { Divider().overlay(Palette.border) }
            }
        }
        .velaBackground()
    }
}


/// WKUserContentController retains its handlers; this keeps the coordinator from being retained by it.
private final class WeakScriptHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        target?.userContentController(c, didReceive: m)
    }
}
