import SwiftUI
import VelaKit

struct CourseDetailView: View {
    @Environment(AppModel.self) private var model
    let course: ICCourse
    @State private var groups: [ICAssignmentGroup] = []
    @State private var phase: AppModel.Load = .loading

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                header
                switch phase {
                case .loading, .idle:
                    ProgressView().tint(Palette.vela400).padding(40)
                case .failed(let message):
                    ErrorBanner(message: message)
                    Button("Try again") { Task { await load(force: true) } }.buttonStyle(.bordered)
                case .loaded:
                    if groups.isEmpty {
                        Text("No assignments yet for this term.")
                            .font(.subheadline).foregroundStyle(Palette.starDim).card(padding: 28)
                    } else {
                        ForEach(groups) { GroupSection(group: $0) }
                    }
                }
            }
            .padding(20)
        }
        .refreshable { await load(force: true) }
        .velaBackground()
        .navigationTitle(course.shortName)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private var header: some View {
        VStack(spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    if let teacher = course.teacher { Text(teacher).foregroundStyle(Palette.starDim) }
                    Text([course.courseCode, course.period.map { "Period \($0)" }].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.footnote).foregroundStyle(Palette.starFaint)
                }
                Spacer()
                if let g = course.currentGrade {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(String(format: "%.2f%%", g))
                            .font(.title.weight(.bold)).monospacedDigit().foregroundStyle(Palette.grade(percent: g))
                        if let letter = course.displayLetter {
                            Text(letter).font(.subheadline.weight(.semibold)).foregroundStyle(Palette.grade(letter: letter))
                        }
                    }
                }
            }
            if let g = course.currentGrade { GradeBar(percent: g) }
            if course.missingCount > 0 {
                Label("\(course.missingCount) missing assignment\(course.missingCount == 1 ? "" : "s")", systemImage: "exclamationmark.triangle")
                    .font(.footnote).foregroundStyle(Palette.amber).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .card(padding: 20)
    }

    private func load(force: Bool = false) async {
        if groups.isEmpty || force { phase = .loading }
        do {
            groups = try await model.loadAssignments(courseId: course.id, force: force)
            phase = .loaded
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}

private struct GroupSection: View {
    let group: ICAssignmentGroup

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(group.name).font(.headline).foregroundStyle(Palette.starBright)
                if group.weight > 0 {
                    Text("\(group.weight.formatted(.number.precision(.fractionLength(0...1))))%")
                        .font(.caption).foregroundStyle(Palette.starDim)
                }
                Spacer()
                if let s = group.score {
                    Text(String(format: "%.1f%%", s)).font(.subheadline.weight(.semibold)).monospacedDigit()
                        .foregroundStyle(Palette.grade(percent: s))
                }
            }
            .padding(.bottom, 10)
            ForEach(Array(group.assignments.enumerated()), id: \.element.id) { i, a in
                if i > 0 { Divider().overlay(Palette.border.opacity(0.6)) }
                AssignmentRow(assignment: a)
            }
        }
        .card(padding: 16)
    }
}

private struct AssignmentRow: View {
    let assignment: ICDetailAssignment

    private var scoreText: String {
        guard let s = assignment.score else { return assignment.missing ? "Missing" : "—" }
        let f = FloatingPointFormatStyle<Double>.number.precision(.fractionLength(0...2))
        return "\(s.formatted(f)) / \(assignment.pointsPossible.formatted(f))"
    }

    private var dueText: String? {
        guard let key = Parsers.datePrefix(assignment.dueAt) else { return nil }
        let p = key.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3, let date = Calendar.current.date(from: DateComponents(year: p[0], month: p[1], day: p[2])) else { return nil }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(assignment.name).font(.subheadline).foregroundStyle(Palette.starWhite)
                HStack(spacing: 8) {
                    if let dueText { Text("Due \(dueText)").font(.caption).foregroundStyle(Palette.starFaint) }
                    if assignment.missing { badge("Missing", color: Palette.amber) }
                    if assignment.late { badge("Late", color: Palette.rose) }
                }
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                Text(scoreText).font(.subheadline).monospacedDigit()
                    .foregroundStyle(assignment.missing && assignment.score == nil ? Palette.amber : Palette.starBright)
                if let grade = assignment.grade { Text(grade).font(.caption).monospacedDigit().foregroundStyle(Palette.starDim) }
            }
        }
        .padding(.vertical, 10)
        .accessibilityElement(children: .combine)
    }

    private func badge(_ text: String, color: Color) -> some View {
        Text(text).font(.caption2.weight(.semibold)).foregroundStyle(color)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(Capsule().fill(color.opacity(0.15)))
    }
}
