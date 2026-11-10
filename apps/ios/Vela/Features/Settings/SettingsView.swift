import SwiftUI
import VelaKit

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var confirmSignOut = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Layout.gap) {
                    SectionLabel(title: "Account")
                    VStack(spacing: 0) {
                        row("Signed in as", model.displayName ?? "Student")
                        if let district = model.session?.districtName {
                            RowDivider().padding(.leading, Layout.card)
                            row("District", district)
                        }
                    }
                    .card(padding: 0)

                    SectionLabel(title: "Sign-in").padding(.top, 8)
                    VStack(alignment: .leading, spacing: 0) {
                        row("Stay signed in", model.hasSavedLogin ? "On" : "Off")
                        RowDivider().padding(.leading, Layout.card)
                        Text(model.hasSavedLogin
                             ? "Your Infinite Campus login is kept on this device so Vela can sign you back in when your session expires. It is never sent to Vela."
                             : "No login is saved. Sign in to Infinite Campus again to save it, so you won't have to re-enter your password when your session expires.")
                            .font(.footnote).foregroundStyle(Palette.textDim)
                            .padding(.horizontal, Layout.card).padding(.vertical, 12)
                        if model.hasSavedLogin {
                            RowDivider().padding(.leading, Layout.card)
                            Button(role: .destructive) { model.forgetSavedLogin() } label: {
                                Text("Forget saved login").font(.subheadline).foregroundStyle(Palette.bad)
                                    .frame(maxWidth: .infinity, minHeight: Layout.row, alignment: .leading)
                                    .padding(.horizontal, Layout.card)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .card(padding: 0)

                    SectionLabel(title: "Schedule").padding(.top, 8)
                    NavigationLink {
                        BellTimesView()
                    } label: {
                        HStack(spacing: 8) {
                            Text("Bell times").foregroundStyle(Palette.text)
                            Spacer(minLength: 8)
                            Text(bellSummary).foregroundStyle(Palette.textDim)
                            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(Palette.textFaint)
                        }
                        .font(.subheadline)
                        .padding(.horizontal, Layout.card)
                        .frame(minHeight: Layout.row + 4)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .card(padding: 0)

                    Button(role: .destructive) { confirmSignOut = true } label: {
                        Text("Sign Out").font(.subheadline.weight(.medium)).foregroundStyle(Palette.bad)
                            .frame(maxWidth: .infinity, minHeight: Layout.row + 4)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .card(padding: 0)
                    .padding(.top, 8)
                }
                .padding(Layout.screen)
            }
            .velaBackground()
            .navigationTitle("Settings")
            .confirmationDialog("Sign out of Vela?", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button("Sign Out", role: .destructive) { Task { await model.signOut() } }
            } message: {
                Text("You'll need to sign in to Infinite Campus again.")
            }
        }
    }

    private var bellSummary: String {
        if model.customBells != nil { return "Custom" }
        if model.usingPresetBells { return "District preset" }
        return "Not set"
    }

    private func row(_ title: String, _ value: String) -> some View {
        HStack(spacing: 12) {
            Text(title).foregroundStyle(Palette.text)
            Spacer(minLength: 8)
            Text(value).foregroundStyle(Palette.textDim).multilineTextAlignment(.trailing).lineLimit(2)
        }
        .font(.subheadline)
        .padding(.horizontal, Layout.card)
        .frame(minHeight: Layout.row + 4)
        .accessibilityElement(children: .combine)
    }
}
