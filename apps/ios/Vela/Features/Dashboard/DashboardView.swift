import SwiftUI
import VelaKit

struct DashboardView: View {
    @Environment(AppModel.self) private var model

    private var avgGrade: Double? {
        let g = model.gradedCourses.compactMap(\.currentGrade)
        return g.isEmpty ? nil : g.reduce(0, +) / Double(g.count)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    gpaHero
                    HStack(spacing: 12) {
                        StatCard(systemImage: "book", value: "\(model.courses.count)", label: "Courses")
                        let missing = model.courses.reduce(0) { $0 + $1.missingCount }
                        StatCard(systemImage: "exclamationmark.triangle", value: "\(missing)", label: "Missing", warn: missing > 0)
                        StatCard(systemImage: "star", value: avgGrade.map { String(format: "%.2f%%", $0) } ?? "—", label: "Avg Grade")
                    }
                    SectionLabel(title: "Current Courses").padding(.top, 8)
                    courseList
                }
                .padding(20)
            }
            .refreshable { await model.loadCourses(force: true) }
            .velaBackground()
            .navigationTitle("Dashboard")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: ICCourse.self) { CourseDetailView(course: $0) }
            .task { await model.loadCourses() }
        }
    }

    private var gpaHero: some View {
        VStack(spacing: 0) {
            Text("GPA OVERVIEW")
                .font(.footnote).tracking(2.4).foregroundStyle(Palette.starFaint)
                .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 24).padding(.vertical, 18)
            Divider().overlay(Palette.border)
            HStack(spacing: 0) {
                gpaColumn("Unweighted", value: model.gpa.unweighted, color: Palette.vela300)
                Rectangle().fill(Palette.border).frame(width: 1)
                gpaColumn("Weighted", value: model.gpa.weighted, color: Palette.emerald)
            }
            .padding(.vertical, 20)
            .redacted(reason: model.coursesState == .loading && model.courses.isEmpty ? .placeholder : [])
        }
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Palette.elevated))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Palette.borderLit))
    }

    private func gpaColumn(_ title: String, value: Double, color: Color) -> some View {
        VStack(spacing: 8) {
            Text(title.uppercased()).font(.caption).tracking(1.6).foregroundStyle(Palette.starFaint)
            Text(String(format: "%.2f", value))
                .font(.system(size: 48, weight: .bold)).monospacedDigit().foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(title) GPA \(String(format: "%.2f", value))")
    }

    @ViewBuilder
    private var courseList: some View {
        if model.courses.isEmpty {
            switch model.coursesState {
            case .loading, .idle:
                ProgressView().tint(Palette.vela400).frame(maxWidth: .infinity).padding(40)
            case .failed(let message):
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle").font(.title).foregroundStyle(Palette.amber)
                    Text("Couldn't load your courses.\n\(message)")
                        .font(.subheadline).foregroundStyle(Palette.starDim).multilineTextAlignment(.center)
                    Button("Try again") { Task { await model.loadCourses(force: true) } }
                        .buttonStyle(.bordered)
                }
                .frame(maxWidth: .infinity).card(padding: 28)
            case .loaded:
                VStack(spacing: 12) {
                    Image(systemName: "book").font(.largeTitle).foregroundStyle(Palette.starFaint)
                    Text("No courses found.").font(.subheadline).foregroundStyle(Palette.starDim)
                }
                .frame(maxWidth: .infinity).card(padding: 36)
            }
        } else {
            if case .failed(let message) = model.coursesState {
                ErrorBanner(message: "Showing saved grades. \(message)")
            }
            LazyVStack(spacing: 14) {
                ForEach(model.courses) { course in
                    NavigationLink(value: course) { CourseCard(course: course) }
                        .buttonStyle(.plain)
                }
            }
        }
    }
}

struct CourseCard: View {
    let course: ICCourse

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(course.shortName)
                    .font(.title2).foregroundStyle(Palette.starBright)
                    .lineLimit(2).multilineTextAlignment(.leading)
                if let teacher = course.teacher {
                    Text(teacher).font(.subheadline).foregroundStyle(Palette.starDim)
                }
                if course.missingCount > 0 {
                    Label("\(course.missingCount) missing", systemImage: "exclamationmark.triangle")
                        .font(.footnote).foregroundStyle(Palette.amber).padding(.top, 4)
                }
            }
            Spacer(minLength: 8)
            Text(course.currentGrade.map { String(format: "%.2f%%", $0) } ?? "—")
                .font(.title2.weight(.bold)).monospacedDigit()
                .foregroundStyle(course.currentGrade.map(Palette.grade(percent:)) ?? Palette.starDim)
        }
        .card(padding: 22)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "\(course.shortName), \(course.currentGrade.map { String(format: "%.2f percent", $0) } ?? "no grade")"
            + (course.missingCount > 0 ? ", \(course.missingCount) missing" : ""))
        .accessibilityAddTraits(.isButton)
    }
}
