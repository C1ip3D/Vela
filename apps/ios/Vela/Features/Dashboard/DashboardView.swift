import SwiftUI
import VelaKit

struct DashboardView: View {
    @Environment(AppModel.self) private var model

    private var avgGrade: Double? {
        let g = model.gradedCourses.compactMap(\.currentGrade)
        return g.isEmpty ? nil : g.reduce(0, +) / Double(g.count)
    }
    private var missing: Int { model.courses.reduce(0) { $0 + $1.missingCount } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Layout.gap) {
                    gpaCard
                    HStack(spacing: Layout.gap) {
                        StatCard(value: "\(model.courses.count)", label: "Courses")
                        StatCard(value: "\(missing)", label: "Missing", color: missing > 0 ? Palette.warn : Palette.text)
                        StatCard(value: avgGrade.map { String(format: "%.2f%%", $0) } ?? "—", label: "Average",
                                 color: avgGrade.map(Palette.grade(percent:)) ?? Palette.text)
                    }
                    SectionLabel(title: "Courses").padding(.top, 8)
                    courseList
                }
                .padding(Layout.screen)
            }
            .refreshable { await model.loadCourses(force: true) }
            .velaBackground()
            .navigationTitle("Grades")
            .navigationDestination(for: ICCourse.self) { CourseDetailView(course: $0) }
            .task { await model.loadCourses() }
        }
    }

    private var gpaCard: some View {
        HStack(spacing: 0) {
            gpaColumn("Unweighted GPA", value: model.gpa.unweighted, color: Palette.tan)
            Rectangle().fill(Palette.borderStrong).frame(width: 1).padding(.vertical, 4)
            gpaColumn("Weighted GPA", value: model.gpa.weighted, color: Palette.blue)
        }
        .redacted(reason: model.coursesState == .loading && model.courses.isEmpty ? .placeholder : [])
        .heroCard(Palette.tan)
    }

    private func gpaColumn(_ title: String, value: Double, color: Color) -> some View {
        VStack(spacing: 6) {
            Text(String(format: "%.2f", value))
                .font(.system(size: 40, weight: .bold)).monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.6)
                .foregroundStyle(color)
            Text(title).font(.caption).foregroundStyle(Palette.textDim).lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(title) \(String(format: "%.2f", value))")
    }

    @ViewBuilder
    private var courseList: some View {
        if model.courses.isEmpty {
            switch model.coursesState {
            case .loading, .idle:
                ProgressView().tint(Palette.tint).frame(maxWidth: .infinity).padding(40)
            case .failed(let message):
                VStack(spacing: 4) {
                    EmptyState(systemImage: "exclamationmark.triangle", message: "Couldn't load your courses.\n\(message)")
                    Button("Try again") { Task { await model.loadCourses(force: true) } }
                        .buttonStyle(.bordered)
                }
                .frame(maxWidth: .infinity).card()
            case .loaded:
                EmptyState(systemImage: "book", message: "No courses found.").card()
            }
        } else {
            if case .failed(let message) = model.coursesState {
                ErrorBanner(message: "Showing saved grades. \(message)")
            }
            // The landing page uses one card per course (badge, grade, bar); the course page uses grouped lists.
            VStack(spacing: 10) {
                ForEach(model.courses) { course in
                    NavigationLink(value: course) { CourseRow(course: course) }
                        .buttonStyle(.plain)
                }
            }
        }
    }
}

struct CourseRow: View {
    let course: ICCourse

    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                PeriodBadge(period: course.period)
                VStack(alignment: .leading, spacing: 3) {
                    Text(course.shortName)
                        .font(.body.weight(.semibold)).foregroundStyle(Palette.text)
                        .lineLimit(1)
                    HStack(spacing: 6) {
                        if let teacher = course.teacher, !teacher.isEmpty {
                            Text(teacher).font(.footnote).foregroundStyle(Palette.textDim).lineLimit(1)
                        }
                        if course.missingCount > 0 { Pill(text: "\(course.missingCount) missing", color: Palette.warn) }
                    }
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 3) {
                    Text(course.currentGrade.map { String(format: "%.2f%%", $0) } ?? "—")
                        .font(.body.weight(.bold)).monospacedDigit()
                        .foregroundStyle(course.currentGrade.map(Palette.grade(percent:)) ?? Palette.textFaint)
                    Text(course.displayLetter ?? "No grade").font(.footnote).foregroundStyle(Palette.textDim)
                }
                .fixedSize()
            }
            // Always drawn (empty when ungraded) so every course card is the same height.
            GradeBar(percent: course.currentGrade ?? 0)
        }
        .card(padding: 14)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "\(course.shortName), \(course.currentGrade.map { String(format: "%.2f percent", $0) } ?? "no grade")"
            + (course.missingCount > 0 ? ", \(course.missingCount) missing" : ""))
        .accessibilityAddTraits(.isButton)
    }
}
