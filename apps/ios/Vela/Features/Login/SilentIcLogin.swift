import UIKit
import WebKit
import VelaKit

/// Invisible counterpart to the login sheet: loads the district's IC login page off-screen and, using the credentials
/// the student chose to keep ("Stay signed in"), comes out the other side with a fresh cookie jar.
///
/// Scans the page on an interval rather than only on load, so it copes with login forms rendered after load and
/// with logins submitted via XHR that never trigger another navigation.
@MainActor
final class SilentIcLogin {
    private static let timeout: TimeInterval = 25
    private static let scanInterval: Duration = .seconds(1)

    private let base: String
    private let appName: String
    private let origin: String
    private let credentials: (username: String, password: String)
    /// Confirms a candidate cookie jar really is a live session for the right student. A rejected candidate isn't
    /// fatal (the page may simply not have finished redirecting), so polling continues.
    private let verify: (String) async -> Bool

    private var web: WKWebView?
    private var continuation: CheckedContinuation<String?, Never>?
    private var pollTask: Task<Void, Never>?
    private var filled = false
    private var checking = false
    private var done = false

    init(baseURL: String, appName: String, credentials: (username: String, password: String), verify: @escaping (String) async -> Bool) {
        base = baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        self.appName = appName
        self.credentials = credentials
        self.verify = verify
        if let u = URL(string: base), let scheme = u.scheme, let host = u.host {
            origin = "\(scheme)://\(host)\(u.port.map { ":\($0)" } ?? "")".lowercased()
        } else {
            origin = base.lowercased()
        }
    }

    /// The new cookie header, or nil when it couldn't sign in without the user (wrong password, SSO-only district, timeout).
    func run() async -> String? {
        await withCheckedContinuation { cont in
            continuation = cont
            let config = WKWebViewConfiguration()
            config.websiteDataStore = .nonPersistent() // nothing from any earlier login can leak in
            let w = WKWebView(frame: CGRect(x: 0, y: 0, width: 1, height: 1), configuration: config)
            w.alpha = 0
            w.isUserInteractionEnabled = false
            // Attached to the window so WebKit doesn't throttle its timers like a detached view.
            UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
                .flatMap(\.windows).first { $0.isKeyWindow }?.addSubview(w)
            web = w
            if let url = URL(string: "\(base)/portal/students/\(appName).jsp") { w.load(URLRequest(url: url)) }

            pollTask = Task { [weak self] in
                let deadline = Date().addingTimeInterval(Self.timeout)
                while Date() < deadline {
                    try? await Task.sleep(for: Self.scanInterval)
                    if Task.isCancelled { return }
                    await self?.scan()
                    if self?.done != false { return }
                }
                self?.finish(nil)
            }
        }
    }

    private func finish(_ result: String?) {
        guard !done else { return }
        done = true
        pollTask?.cancel()
        web?.stopLoading()
        web?.removeFromSuperview()
        web = nil
        continuation?.resume(returning: result)
        continuation = nil
    }

    /// Reports the page state and, the first time IC's own login form is showing, fills and submits it. Only ever
    /// fills on the district's IC origin: if the login bounces to an SSO provider, the saved IC password must never
    /// be typed into that page. Values go through the native setter plus input/change events so framework-managed
    /// forms (IC's newer Angular login) see them.
    private func scanScript(allowFill: Bool) -> String {
        let creds = allowFill
            ? ((try? JSONSerialization.data(withJSONObject: ["username": credentials.username, "password": credentials.password]))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "null")
            : "null"
        let originLiteral = (try? String(data: JSONEncoder().encode(origin), encoding: .utf8)) ?? "\"\""
        return """
        (function () {
          try {
            var onIc = location.origin.toLowerCase() === \(originLiteral);
            var text = document.body ? (document.body.innerText || "") : "";
            var html = document.documentElement ? (document.documentElement.outerHTML || "") : "";
            var pw = document.querySelector('input[type="password"]');
            var hasLoginForm = !!pw || /student username/i.test(text);
            var filled = false;
            var creds = \(creds);
            if (onIc && creds && pw) {
              var form = pw.form || document;
              var user = form.querySelector('input[name="username"], input#username, input[type="email"], input[type="text"]');
              if (user) {
                var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
                [[user, creds.username], [pw, creds.password]].forEach(function (pair) {
                  setter.call(pair[0], pair[1]);
                  pair[0].dispatchEvent(new Event("input", { bubbles: true }));
                  pair[0].dispatchEvent(new Event("change", { bubbles: true }));
                });
                var submit = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
                if (submit) submit.click();
                else if (pw.form && pw.form.requestSubmit) pw.form.requestSubmit();
                else if (pw.form) pw.form.submit();
                filled = true;
              }
            }
            return JSON.stringify({ onIc: onIc, combined: (text + " " + html).toLowerCase(), hasLoginForm: hasLoginForm, filled: filled });
          } catch (e) {
            return JSON.stringify({ onIc: false, combined: "", hasLoginForm: true, filled: false });
          }
        })();
        """
    }

    private func scan() async {
        guard !done, !checking, let web else { return }
        guard let raw = try? await web.evaluateJavaScript(scanScript(allowFill: !filled)) as? String,
              let scan = try? JSON(data: Data(raw.utf8)), !done else { return }
        if scan["filled"].truthy { filled = true; return }
        // Bounced to an SSO provider or anywhere else off IC: can't continue without the user.
        if !scan["onIc"].truthy { finish(nil); return }
        if filled, IcLoginSignals.containsFailureMarkers(scan["combined"].string ?? "") { finish(nil); return }
        // Login form showing with nothing (more) to fill in: wait for a submit still in flight; the timeout ends it.
        if scan["hasLoginForm"].truthy { return }

        checking = true
        defer { checking = false }
        guard let jar = await IcCookieJar.header(from: web, base: base, appName: appName), !done else { return }
        if await verify(jar) { finish(jar) }
    }
}

/// Reads the cookie jar of a web view for the district host, as a Cookie header.
enum IcCookieJar {
    @MainActor
    static func header(from web: WKWebView, base: String, appName: String) async -> String? {
        guard let host = URL(string: base)?.host?.lowercased() else { return nil }
        let all = await web.configuration.websiteDataStore.httpCookieStore.allCookies()
        let jar = all.filter {
            let d = ($0.domain.hasPrefix(".") ? String($0.domain.dropFirst()) : $0.domain).lowercased()
            return host == d || host.hasSuffix("." + d)
        }
        guard !jar.isEmpty else { return nil }
        var header = jar.map { "\($0.name)=\($0.value)" }.joined(separator: "; ")
        // IC needs an explicit appName cookie or later API calls fail with "conflicting app name values".
        if header.range(of: #"(^|;\s*)appName="#, options: .regularExpression) == nil { header += "; appName=\(appName)" }
        return header
    }
}
