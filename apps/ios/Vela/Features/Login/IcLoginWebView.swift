import SwiftUI
import WebKit
import VelaKit

/// Observable state shared between the web view coordinator and its SwiftUI chrome.
@MainActor
@Observable
final class IcLoginState {
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
    let onSuccess: (String) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Isolated, in-memory store: nothing from a previous student's login can leak in.
        config.websiteDataStore = .nonPersistent()
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

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate {
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

        private func origin(_ url: String) -> String {
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
                parent.onSuccess(header)
            }
        }
    }
}

/// Full-screen sheet wrapping the IC login page with Vela chrome.
struct IcLoginSheet: View {
    let district: District
    let onSuccess: (String) -> Void
    let onCancel: () -> Void
    @State private var state = IcLoginState()

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(district.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Palette.starWhite)
                    .lineLimit(1)
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
