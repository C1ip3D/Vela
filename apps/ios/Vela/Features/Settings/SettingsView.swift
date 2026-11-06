import SwiftUI
import VelaKit

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var confirmSignOut = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        row("Signed in as", model.displayName ?? "Student")
                        if let district = model.session?.districtName { row("District", district) }
                    }
                    .card()

                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Label("Stay signed in", systemImage: "key").foregroundStyle(Palette.starBright)
                            Spacer()
                            Text(model.hasSavedLogin ? "On" : "Off").foregroundStyle(Palette.starDim)
                        }
                        .font(.subheadline)
                        Text(model.hasSavedLogin
                             ? "Your Infinite Campus login is kept on this device so Vela can sign you back in when your session expires. It is never sent to Vela."
                             : "Turn on \"Stay signed in\" the next time you sign in to Infinite Campus to avoid re-entering your password when your session expires.")
                            .font(.caption).foregroundStyle(Palette.starFaint)
                        if model.hasSavedLogin {
                            Button("Forget saved login", role: .destructive) { model.forgetSavedLogin() }
                                .font(.footnote.weight(.semibold))
                        }
                    }
                    .card()

                    NavigationLink {
                        BellTimesView()
                    } label: {
                        HStack {
                            Label("Bell times", systemImage: "clock").foregroundStyle(Palette.starBright)
                            Spacer()
                            Text(bellSummary).foregroundStyle(Palette.starDim)
                            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(Palette.starFaint)
                        }
                        .font(.subheadline)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .card()

                    Button(role: .destructive) { confirmSignOut = true } label: {
                        Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                            .font(.body).foregroundStyle(Palette.rose)
                            .frame(maxWidth: .infinity, minHeight: 28, alignment: .leading)
                    }
                    .card()
                }
                .padding(20)
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
        HStack {
            Text(title).foregroundStyle(Palette.starDim)
            Spacer()
            Text(value).foregroundStyle(Palette.starBright).multilineTextAlignment(.trailing)
        }
        .font(.subheadline)
    }
}
