import SwiftUI
import VelaKit

private let usStates = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS",
    "MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
]

struct LoginView: View {
    @Environment(AppModel.self) private var model
    @State private var stateCode = "CA"
    @State private var query = ""
    @State private var results: [District] = []
    @State private var selected: District?
    @State private var isSearching = false
    @State private var searchFailed = false
    @State private var showWebView = false

    var body: some View {
        ZStack {
            StarField().ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    Image("Logo")
                        .resizable().scaledToFit().frame(width: 140, height: 140)
                        .accessibilityHidden(true)
                    Text("VELA")
                        .font(.system(size: 40, weight: .heavy)).tracking(8)
                        .foregroundStyle(Color(hex: 0xF0F4FF)).padding(.top, 8)
                    Text("ACADEMIC NAVIGATOR")
                        .font(.caption2).tracking(4).foregroundStyle(Palette.starFaint).padding(.top, 6)
                        .padding(.bottom, 36)

                    VStack(alignment: .leading, spacing: 16) {
                        if let error = model.loginError { ErrorBanner(message: error) }
                        districtPicker
                        if let selected {
                            Button {
                                showWebView = true
                            } label: {
                                if model.isFinishingLogin {
                                    ProgressView().tint(Palette.accentInk)
                                } else {
                                    Label("Continue to Infinite Campus", systemImage: "arrow.right")
                                        .labelStyle(TrailingIconLabelStyle())
                                }
                            }
                            .buttonStyle(PrimaryButtonStyle())
                            .disabled(model.isFinishingLogin)
                            .accessibilityHint("Opens \(selected.name)'s sign-in page")
                        }
                    }
                    .padding(24)
                    .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Palette.surface.opacity(0.6)))
                    .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(Palette.border))
                    .frame(maxWidth: 480)
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 40)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)

            if model.isFinishingLogin {
                VStack(spacing: 12) {
                    ProgressView().controlSize(.large).tint(Palette.emerald)
                    Text("Signed in to Infinite Campus").font(.title3.weight(.semibold)).foregroundStyle(Palette.emerald)
                    Text("Loading your classes…").foregroundStyle(Palette.starDim)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Palette.void)
            }
        }
        .velaBackground()
        .onAppear {
            if selected == nil, let last = model.lastDistrict {
                selected = last
                query = last.name
                stateCode = last.stateCode
            }
        }
        .task(id: SearchKey(query: query, stateCode: stateCode, locked: selected != nil)) { await search() }
        .fullScreenCover(isPresented: $showWebView) {
            if let selected {
                IcLoginSheet(
                    district: selected,
                    onSuccess: { result in
                        showWebView = false
                        Task { await model.completeLogin(result, district: selected) }
                    },
                    onCancel: { showWebView = false }
                )
            }
        }
    }

    private struct SearchKey: Equatable { var query: String; var stateCode: String; var locked: Bool }

    private var districtPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .bottom, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    fieldLabel("State")
                    Menu {
                        Picker("State", selection: $stateCode) {
                            ForEach(usStates, id: \.self) { Text($0).tag($0) }
                        }
                    } label: {
                        HStack {
                            Text(stateCode).foregroundStyle(Palette.starBright)
                            Spacer(minLength: 4)
                            Image(systemName: "chevron.up.chevron.down").font(.caption2).foregroundStyle(Palette.starFaint)
                        }
                        .padding(.horizontal, 12).frame(width: 88, height: 48)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Palette.mid.opacity(0.6)))
                        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Palette.border))
                    }
                    .onChange(of: stateCode) { _, _ in selected = nil }
                }
                VStack(alignment: .leading, spacing: 6) {
                    fieldLabel("District")
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass").foregroundStyle(Palette.starFaint)
                        TextField("Search district…", text: $query)
                            .textInputAutocapitalization(.words)
                            .autocorrectionDisabled()
                            .foregroundStyle(Palette.starBright)
                            .onChange(of: query) { _, new in
                                if let s = selected, s.name != new { selected = nil }
                            }
                        if isSearching { ProgressView().controlSize(.small) }
                    }
                    .padding(.horizontal, 12).frame(height: 48)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Palette.mid.opacity(0.6)))
                    .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Palette.border))
                }
            }

            if selected == nil, !results.isEmpty {
                VStack(spacing: 0) {
                    ForEach(results) { d in
                        Button {
                            selected = d
                            query = d.name
                            results = []
                        } label: {
                            Text(d.name)
                                .foregroundStyle(Palette.starBright)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 16).padding(.vertical, 14)
                        }
                        if d.id != results.last?.id { Divider().overlay(Palette.border.opacity(0.5)) }
                    }
                }
                .background(RoundedRectangle(cornerRadius: 12).fill(Palette.mid))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Palette.border))
            } else if selected == nil, searchFailed {
                Text("Couldn't reach the district directory. Check your connection.")
                    .font(.footnote).foregroundStyle(Palette.starDim)
            } else if selected == nil, query.count >= 3, !isSearching, results.isEmpty {
                Text("No districts found in \(stateCode).").font(.footnote).foregroundStyle(Palette.starDim)
            }
        }
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text.uppercased()).font(.caption).tracking(1).foregroundStyle(Palette.starDim)
    }

    private func search() async {
        results = []
        searchFailed = false
        guard selected == nil, query.count >= 3 else { return }
        try? await Task.sleep(for: .milliseconds(400)) // debounce; cancelled when the key changes
        if Task.isCancelled { return }
        isSearching = true
        defer { isSearching = false }
        do {
            let found = try await ICClient.searchDistricts(query: query, stateCode: stateCode)
            if Task.isCancelled { return }
            results = found.compactMap { r in
                guard let name = r.district_name, let url = r.district_baseurl, let app = r.district_app_name else { return nil }
                return District(name: name, baseURL: url, appName: app, stateCode: r.state_code ?? stateCode)
            }
        } catch {
            if !Task.isCancelled { searchFailed = true }
        }
    }
}

private struct TrailingIconLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 8) { configuration.title; configuration.icon }
    }
}

/// Twinkling background, a lighter take on the old animated star field.
private struct StarField: View {
    private struct Star { let x, y, size, phase: Double }
    private let stars: [Star] = {
        var g = SeededGenerator(seed: 42)
        return (0..<60).map { _ in
            Star(x: .random(in: 0...1, using: &g), y: .random(in: 0...1, using: &g),
                 size: .random(in: 1.5...3, using: &g), phase: .random(in: 0...6.28, using: &g))
        }
    }()

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 20)) { timeline in
            Canvas { ctx, size in
                let t = timeline.date.timeIntervalSinceReferenceDate
                for s in stars {
                    let alpha = 0.2 + 0.8 * (0.5 + 0.5 * sin(t * 1.3 + s.phase))
                    let rect = CGRect(x: s.x * size.width, y: s.y * size.height, width: s.size, height: s.size)
                    ctx.fill(Path(ellipseIn: rect), with: .color(Palette.vela300.opacity(alpha)))
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

private struct SeededGenerator: RandomNumberGenerator {
    var state: UInt64
    init(seed: UInt64) { state = seed }
    mutating func next() -> UInt64 {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return state
    }
}
