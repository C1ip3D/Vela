import SwiftUI
import VelaKit

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var confirmSignOut = false
    @State private var confirmDelete = false
    @State private var deleting = false
    @State private var deleteError: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Layout.gap) {
                    SectionLabel(title: "Account")
                    VStack(spacing: 0) {
                        row(model.isDemo ? "Sample data" : "Signed in as", model.displayName ?? "Student")
                        if let district = model.session?.districtName {
                            RowDivider().padding(.leading, Layout.card)
                            row("District", district)
                        }
                    }
                    .card(padding: 0)

                    SectionLabel(title: "Sign-in").padding(.top, 8)
                    VStack(alignment: .leading, spacing: 0) {
                        row("Stay signed in", model.hasSavedLogin ? "On" : "Off")
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

                    SectionLabel(title: "About").padding(.top, 8)
                    VStack(spacing: 0) {
                        if let url = AppConfig.privacyURL {
                            linkRow("Privacy Policy", url)
                            RowDivider().padding(.leading, Layout.card)
                        }
                        if let url = AppConfig.supportURL {
                            linkRow("Support", url)
                            RowDivider().padding(.leading, Layout.card)
                        }
                        row("Version", AppConfig.appVersion)
                    }
                    .card(padding: 0)
                    Text("Vela is an independent app and is not affiliated with Infinite Campus or your school district.")
                        .font(.footnote).foregroundStyle(Palette.textFaint)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Button(role: .destructive) { confirmSignOut = true } label: {
                        Text(model.isDemo ? "Exit Sample Data" : "Sign Out").font(.subheadline.weight(.medium)).foregroundStyle(Palette.bad)
                            .frame(maxWidth: .infinity, minHeight: Layout.row + 4)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .card(padding: 0)
                    .padding(.top, 8)

                    if !model.isDemo {
                        // Guideline 5.1.1(v): an app that creates accounts must offer deletion inside the app.
                        Button(role: .destructive) { confirmDelete = true } label: {
                            Group {
                                if deleting { ProgressView().tint(Palette.bad) }
                                else { Text("Delete Account and Data").font(.subheadline.weight(.medium)).foregroundStyle(Palette.bad) }
                            }
                            .frame(maxWidth: .infinity, minHeight: Layout.row + 4)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .card(padding: 0)
                        .disabled(deleting)
                        Text("Permanently deletes your Vela account and the copy of your grades and schedule on Vela's server, and signs you out. Your Infinite Campus account is not affected.")
                            .font(.footnote).foregroundStyle(Palette.textFaint)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(Layout.screen)
            }
            .velaBackground()
            .navigationTitle("Settings")
            .confirmationDialog(model.isDemo ? "Exit the sample data?" : "Sign out of Vela?", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button(model.isDemo ? "Exit" : "Sign Out", role: .destructive) { Task { await model.signOut() } }
            } message: {
                Text(model.isDemo ? "You'll return to the sign-in screen." : "You'll need to sign in to Infinite Campus again.")
            }
            .confirmationDialog("Delete your Vela account?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete Account and Data", role: .destructive) { deleteAccount() }
            } message: {
                Text("This permanently deletes your Vela account and everything Vela's server stores about you. It can't be undone.")
            }
            .alert("Couldn't delete your account", isPresented: Binding(get: { deleteError != nil }, set: { if !$0 { deleteError = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(deleteError ?? "")
            }
        }
    }

    private func deleteAccount() {
        deleting = true
        Task {
            do { try await model.deleteAccount() } catch { deleteError = error.localizedDescription }
            deleting = false
        }
    }

    private func linkRow(_ title: String, _ url: URL) -> some View {
        Link(destination: url) {
            HStack(spacing: 12) {
                Text(title).foregroundStyle(Palette.text)
                Spacer(minLength: 8)
                Image(systemName: "arrow.up.right").font(.caption.weight(.semibold)).foregroundStyle(Palette.textFaint)
            }
            .font(.subheadline)
            .padding(.horizontal, Layout.card)
            .frame(minHeight: Layout.row + 4)
            .contentShape(Rectangle())
        }
        .accessibilityHint("Opens in your browser")
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
