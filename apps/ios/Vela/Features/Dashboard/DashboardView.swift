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
                        StatCard(value: "\(missing)", label: "Missing", warn: missing > 0)
                        StatCard(value: avgGrade.map { String(format: "%.2f%%", $0) } ?? "—", label: "Average")
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
            gpaColumn("Unweighted GPA", value: model.gpa.unweighted)
            Rectangle().fill(Palette.border).frame(width: 1).padding(.vertical, 4)
            gpaColumn("Weighted GPA", value: model.gpa.weighted)
        }
        .redacted(reason: model.coursesState == .loading && model.courses.isEmpty ? .placeholder : [])
        .card(padding: 20)
    }

    private func gpaColumn(_ title: String, value: Double) -> some View {
        VStack(spacing: 6) {
            Text(String(format: "%.2f", value))
                .font(.system(size: 40, weight: .bold)).monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.6)
                .foregroundStyle(Palette.text)
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
            // One grouped list instead of a stack of separate cards: every row is the same height and width.
            VStack(spacing: 0) {
                ForEach(model.courses) { course in
                    NavigationLink(value: course) { CourseRow(course: course) }
                        .buttonStyle(.plain)
                    if course.id != model.courses.last?.id { RowDivider().padding(.leading, Layout.card) }
                }
            }
            .card(padding: 0)
        }
    }
}

struct CourseRow: View {
    let course: ICCourse

    private var subtitle: String {
        [course.period.map { "Period \($0)" }, course.teacher].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
    }

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(course.shortName)
                    .font(.body.weight(.medium)).foregroundStyle(Palette.text)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    if !subtitle.isEmpty {
                        Text(subtitle).font(.footnote).foregroundStyle(Palette.textDim).lineLimit(1)
                    }
                    if course.missingCount > 0 { Pill(text: "\(course.missingCount) missing", color: Palette.warn) }
                }
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 3) {
                Text(course.currentGrade.map { String(format: "%.2f%%", $0) } ?? "—")
                    .font(.body.weight(.semibold)).monospacedDigit()
                    .foregroundStyle(course.currentGrade.map(Palette.grade(percent:)) ?? Palette.textFaint)
                if let letter = course.displayLetter {
                    Text(letter).font(.footnote).foregroundStyle(Palette.textDim)
                }
            }
            .fixedSize()
            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(Palette.textFaint)
        }
        .padding(.horizontal, Layout.card)
        .frame(minHeight: 64)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "\(course.shortName), \(course.currentGrade.map { String(format: "%.2f percent", $0) } ?? "no grade")"
            + (course.missingCount > 0 ? ", \(course.missingCount) missing" : ""))
        .accessibilityAddTraits(.isButton)
    }
}
