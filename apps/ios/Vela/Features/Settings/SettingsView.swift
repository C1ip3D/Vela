import SwiftUI
import VelaKit

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var confirmSignOut = false
    @State private var confirmDelete = false
    @State private var isDeleting = false
    @State private var deleteError: String?

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

                    if model.isDemo {
                        Text("You're looking at sample data. Sign out to connect your own Infinite Campus account.")
                            .font(.footnote).foregroundStyle(Palette.textDim)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

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
                    NavigationLink {
                        PrivacyPolicyView()
                    } label: {
                        HStack {
                            Text("Privacy Policy").foregroundStyle(Palette.text)
                            Spacer(minLength: 8)
                            Image(systemName: "chevron.right")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Palette.textDim)
                        }
                        .font(.subheadline)
                        .padding(.horizontal, Layout.card)
                        .frame(maxWidth: .infinity, minHeight: Layout.row + 4)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .card(padding: 0)

                    Button(role: .destructive) { confirmSignOut = true } label: {
                        Text(model.isDemo ? "Exit Demo" : "Sign Out").font(.subheadline.weight(.medium)).foregroundStyle(Palette.bad)
                            .frame(maxWidth: .infinity, minHeight: Layout.row + 4)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .card(padding: 0)
                    .padding(.top, 8)

                    if !model.isDemo {
                        VStack(alignment: .leading, spacing: 8) {
                            if let deleteError { ErrorBanner(message: deleteError) }
                            Button(role: .destructive) { confirmDelete = true } label: {
                                Group {
                                    if isDeleting {
                                        ProgressView().tint(Palette.bad)
                                    } else {
                                        Text("Delete Account").font(.subheadline.weight(.medium)).foregroundStyle(Palette.bad)
                                    }
                                }
                                .frame(maxWidth: .infinity, minHeight: Layout.row + 4)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .disabled(isDeleting)
                            .card(padding: 0)
                            Text("Permanently deletes your Tassel account and the grade history stored for it. Your Infinite Campus account isn't affected.")
                                .font(.footnote).foregroundStyle(Palette.textDim)
                        }
                    }
                }
                .padding(Layout.screen)
            }
            .velaBackground()
            .navigationTitle("Settings")
            .confirmationDialog(model.isDemo ? "Exit the demo?" : "Sign out of Tassel?", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button(model.isDemo ? "Exit Demo" : "Sign Out", role: .destructive) { Task { await model.signOut() } }
            } message: {
                Text(model.isDemo ? "You'll go back to the sign-in screen." : "You'll need to sign in to Infinite Campus again.")
            }
            .confirmationDialog("Delete your Tassel account?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete Account", role: .destructive) {
                    Task {
                        isDeleting = true
                        deleteError = nil
                        defer { isDeleting = false }
                        do { try await model.deleteAccount() } catch { deleteError = error.localizedDescription }
                    }
                }
            } message: {
                Text("This permanently deletes your account and everything Tassel stored on its server. It can't be undone.")
            }
        }
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
