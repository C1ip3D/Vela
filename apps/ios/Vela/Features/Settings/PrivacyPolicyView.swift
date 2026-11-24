import SwiftUI

struct PrivacyPolicyView: View {
    private static let lastUpdated = "November 24, 2026"

    private struct Section: Identifiable {
        let title: String
        let body: [String]
        var id: String { title }
    }

    private let sections: [Section] = [
        Section(title: "Overview", body: [
            "Tally helps students track grades, assignments and schedules from Infinite Campus. This policy explains what Tally handles and why. Tally is a student project and is not affiliated with or endorsed by Infinite Campus or your school district."
        ]),
        Section(title: "Your Infinite Campus login", body: [
            "You sign in on your district's own Infinite Campus page inside the app. Your Infinite Campus username and password are entered there and are never sent to Tally's servers.",
            "After sign-in, your Infinite Campus session is stored in the iOS Keychain on your device. If you turn on \"Stay signed in\", saved login details are also kept in the Keychain so Tally can sign you in again. You can remove them any time with \"Forget saved login\" in Settings."
        ]),
        Section(title: "Data we collect", body: [
            "• Account identity: your Infinite Campus person details (such as name and district) used to create a Tally account through Firebase Authentication.",
            "• Academic data: courses, teachers, assignments, scores and grades, and your class schedule.",
            "• Derived data: grade history snapshots, GPA snapshots and change notes (for example, a grade that went up or down)."
        ]),
        Section(title: "How the data is used", body: [
            "Grades, assignments and schedules are fetched directly from Infinite Campus on your device and shown in the app. As a best-effort extra, Tally copies this data to its server so it can keep grade history and calculate GPA trends.",
            "We use your data only to run Tally's features. We do not sell it, rent it, or use it for advertising or tracking."
        ]),
        Section(title: "Where it is stored", body: [
            "Server-side data is kept in a Postgres database hosted on Render, and sign-in is handled by Google Firebase Authentication. Grade history older than 30 days is removed automatically. Data is encrypted in transit using HTTPS."
        ]),
        Section(title: "Sharing", body: [
            "Your data is not shared with other students, parents or third parties. It is processed only by the services Tally depends on to operate: Firebase (sign-in), Render (hosting) and your district's Infinite Campus server."
        ]),
        Section(title: "Your choices", body: [
            "• Sign out in Settings to clear the Infinite Campus session from your device.",
            "• Use \"Forget saved login\" to delete saved login details.",
            "• Use \"Delete Account\" in Settings to permanently delete your Tally account and everything Tally stored on its server. Your Infinite Campus account and school records are not affected."
        ]),
        Section(title: "Children and students", body: [
            "Tally is intended for students and uses only the information your school already provides through Infinite Campus. We do not knowingly collect information beyond that, and we do not show ads."
        ]),
        Section(title: "Changes", body: [
            "If this policy changes, the updated version will appear here with a new date."
        ]),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Layout.gap) {
                Text("Last updated \(Self.lastUpdated)")
                    .font(.footnote)
                    .foregroundStyle(Palette.textDim)

                ForEach(sections) { section in
                    VStack(alignment: .leading, spacing: 8) {
                        SectionLabel(title: section.title)
                        VStack(alignment: .leading, spacing: 10) {
                            ForEach(section.body, id: \.self) { paragraph in
                                Text(paragraph)
                                    .font(.subheadline)
                                    .foregroundStyle(Palette.text)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .card()
                    }
                }
            }
            .padding(Layout.screen)
        }
        .velaBackground()
        .navigationTitle("Privacy Policy")
        .navigationBarTitleDisplayMode(.inline)
    }
}
