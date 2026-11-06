import SwiftUI

@main
struct VelaApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .preferredColorScheme(.dark)
                .tint(Palette.vela300)
                .task { model.bootstrap() }
        }
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            switch model.phase {
            case .launching:
                ProgressView().tint(Palette.vela400).frame(maxWidth: .infinity, maxHeight: .infinity).velaBackground()
            case .signedOut:
                LoginView()
            case .signedIn:
                MainTabView()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: model.phase)
        .onChange(of: scenePhase) { _, new in
            if new == .active { Task { await model.checkSessionIfNeeded() } }
        }
    }
}

struct MainTabView: View {
    private var dayTitle: String {
        let d = Calendar.current.component(.weekday, from: Date()) - 1
        let names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        return names[(1...5).contains(d) ? d : 1]
    }

    var body: some View {
        TabView {
            Tab("Dashboard", systemImage: "square.grid.2x2") { DashboardView() }
            Tab(dayTitle, systemImage: "calendar.day.timeline.left") { DayView() }
            Tab("Settings", systemImage: "gearshape") { SettingsView() }
        }
        .toolbarBackground(Palette.deep, for: .tabBar)
    }
}
