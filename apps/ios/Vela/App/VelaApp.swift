import SwiftUI

@main
struct VelaApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .preferredColorScheme(.dark)
                .tint(Palette.tint)
                .dynamicTypeSize(.xLarge)
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
                ProgressView().tint(Palette.tint).frame(maxWidth: .infinity, maxHeight: .infinity).velaBackground()
            case .signedOut:
                LoginView()
            case .signedIn:
                MainTabView()
            }
        }
        .animation(.easeInOut(duration: 0.2), value: model.phase)
        // Keepalive: check (and silently repair) the session whenever the app returns to the foreground, and every
        // 10 minutes while it stays there, so IC's idle timeout rarely gets a chance to expire it.
        .task(id: KeepaliveKey(active: scenePhase == .active, signedIn: model.phase == .signedIn)) {
            guard scenePhase == .active, model.phase == .signedIn else { return }
            await model.keepAlive()
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(600))
                if Task.isCancelled { return }
                await model.keepAlive(force: true)
            }
        }
    }
}

private struct KeepaliveKey: Equatable { var active: Bool; var signedIn: Bool }

struct MainTabView: View {
    var body: some View {
        TabView {
            Tab("Grades", systemImage: "chart.bar") { DashboardView() }
            Tab("Today", systemImage: "clock") { DayView() }
            Tab("Access", systemImage: "person.2") { FlexView() }
            Tab("Settings", systemImage: "gearshape") { SettingsView() }
        }
        .toolbarBackground(Palette.bar, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
    }
}
