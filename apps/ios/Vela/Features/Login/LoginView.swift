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
            ScrollView {
                VStack(spacing: 0) {
                    Image("Logo")
                        .resizable().scaledToFit().frame(width: 96, height: 96)
                        .accessibilityHidden(true)
                    Text("Vela")
                        .font(.largeTitle.weight(.bold))
                        .foregroundStyle(Palette.text).padding(.top, 12)
                    Text("Grades and schedule from Infinite Campus")
                        .font(.subheadline).foregroundStyle(Palette.textDim).multilineTextAlignment(.center)
                        .padding(.top, 4).padding(.bottom, 32)

                    VStack(alignment: .leading, spacing: 16) {
                        if let error = model.loginError { ErrorBanner(message: error) }
                        districtPicker
                        if let selected {
                            Button {
                                showWebView = true
                            } label: {
                                if model.isFinishingLogin {
                                    ProgressView().tint(Palette.actionInk)
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
                    .card()
                    .frame(maxWidth: 480)

                    Button("Explore with sample data") { model.startDemo() }
                        .font(.subheadline.weight(.semibold))
                        .frame(minHeight: Layout.row)
                        .padding(.top, 12)
                        .disabled(model.isFinishingLogin)
                        .accessibilityHint("Opens the app with example grades, without signing in")

                    VStack(spacing: 8) {
                        Text("When you sign in, Vela creates an account for you and keeps a copy of your grades and schedule on its server. You can delete it anytime in Settings.")
                        Text("Vela is an independent app and is not affiliated with Infinite Campus or your school district.")
                        HStack(spacing: 16) {
                            if let url = AppConfig.privacyURL { Link("Privacy Policy", destination: url) }
                            if let url = AppConfig.supportURL { Link("Support", destination: url) }
                        }
                        .font(.footnote.weight(.semibold))
                        .frame(minHeight: Layout.row)
                    }
                    .font(.footnote).foregroundStyle(Palette.textDim).multilineTextAlignment(.center)
                    .frame(maxWidth: 480)
                    .padding(.top, 16)
                }
                .padding(.horizontal, Layout.screen)
                .padding(.vertical, 40)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)

            if model.isFinishingLogin {
                VStack(spacing: 12) {
                    ProgressView().controlSize(.large).tint(Palette.tint)
                    Text("Signed in to Infinite Campus").font(.headline).foregroundStyle(Palette.text)
                    Text("Loading your classes…").foregroundStyle(Palette.textDim)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Palette.bg)
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
                            Text(stateCode).foregroundStyle(Palette.text)
                            Spacer(minLength: 4)
                            Image(systemName: "chevron.up.chevron.down").font(.caption2).foregroundStyle(Palette.textFaint)
                        }
                        .padding(.horizontal, 12).frame(width: 84)
                        .fieldChrome(height: 48)
                    }
                    .menuStyle(.button).buttonStyle(.plain)
                    .onChange(of: stateCode) { _, _ in selected = nil }
                }
                VStack(alignment: .leading, spacing: 6) {
                    fieldLabel("District")
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass").foregroundStyle(Palette.textFaint)
                        TextField("Search district…", text: $query)
                            .textInputAutocapitalization(.words)
                            .autocorrectionDisabled()
                            .foregroundStyle(Palette.text)
                            .onChange(of: query) { _, new in
                                if let s = selected, s.name != new { selected = nil }
                            }
                        if isSearching { ProgressView().controlSize(.small) }
                    }
                    .padding(.horizontal, 12)
                    .fieldChrome(height: 48)
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
                                .foregroundStyle(Palette.text)
                                .lineLimit(2).multilineTextAlignment(.leading)
                                .frame(maxWidth: .infinity, minHeight: Layout.row, alignment: .leading)
                                .padding(.horizontal, 12)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        if d.id != results.last?.id { RowDivider() }
                    }
                }
                .fieldChrome()
                .clipShape(RoundedRectangle(cornerRadius: Layout.fieldRadius, style: .continuous))
            } else if selected == nil, searchFailed {
                Text("Couldn't reach the district directory. Check your connection.")
                    .font(.footnote).foregroundStyle(Palette.textDim)
            } else if selected == nil, query.count >= 3, !isSearching, results.isEmpty {
                Text("No districts found in \(stateCode).").font(.footnote).foregroundStyle(Palette.textDim)
            }
        }
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text).font(.caption.weight(.medium)).foregroundStyle(Palette.textDim)
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
