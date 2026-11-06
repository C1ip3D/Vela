import SwiftUI
import VelaKit

struct CourseDetailView: View {
    @Environment(AppModel.self) private var model
    let course: ICCourse

    @State private var groups: [ICAssignmentGroup] = []
    @State private var phase: AppModel.Load = .loading

    // What-if state: nothing here is ever sent anywhere.
    @State private var mods: [String: WhatIfMod] = [:]
    @State private var added: [String: [CustomAssignment]] = [:]
    @State private var expanded: Set<String> = []
    @State private var sheet: Sheet?

    enum Sheet: Identifiable {
        case editScore(ICDetailAssignment)
        case addCustom(groupId: String)
        case editCustom(groupId: String, CustomAssignment)
        case finalCalc

        var id: String {
            switch self {
            case .editScore(let a): "edit-\(a.id)"
            case .addCustom(let g): "add-\(g)"
            case .editCustom(_, let c): "custom-\(c.id)"
            case .finalCalc: "final"
            }
        }
    }

    // MARK: Derived

    private var hasChanges: Bool { !mods.isEmpty || added.values.contains { !$0.isEmpty } }
    private var baseGrade: Double? { calcCourseGrade(groups, mods: [:]) }
    private var projected: Double? { calcCourseGrade(groups, mods: mods, added: added) }
    /// What the header shows: the projection while exploring, otherwise IC's own number.
    private var shownGrade: Double? { hasChanges ? (projected ?? course.currentGrade) : course.currentGrade }
    private var gradeDelta: Double? {
        guard hasChanges, let p = projected, let b = baseGrade, p != b else { return nil }
        return p - b
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
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
                        ForEach(groups) { group in
                            GroupSection(
                                group: group,
                                isExpanded: expanded.contains(group.id),
                                mods: mods,
                                extras: added[group.id] ?? [],
                                toggle: { toggle(group.id) },
                                onEditScore: { sheet = .editScore($0) },
                                onToggleDrop: { toggleDrop($0) },
                                onReset: { mods[$0.id] = nil },
                                onAddCustom: { sheet = .addCustom(groupId: group.id) },
                                onEditCustom: { sheet = .editCustom(groupId: group.id, $0) },
                                onRemoveCustom: { c in added[group.id]?.removeAll { $0.id == c.id } },
                                onResetGroup: { resetGroup(group) }
                            )
                        }
                    }
                }
            }
            .padding(20)
        }
        .refreshable { await load(force: true) }
        .velaBackground()
        .navigationTitle(course.shortName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Final grade calculator", systemImage: "function") { sheet = .finalCalc }
                    if hasChanges {
                        Button("Reset all changes", systemImage: "arrow.counterclockwise", role: .destructive) {
                            mods = [:]
                            added = [:]
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .accessibilityLabel("Course options")
            }
        }
        .sheet(item: $sheet) { sheet in sheetContent(sheet) }
        .task { await load() }
    }

    // MARK: Header

    private var header: some View {
        VStack(spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    if let teacher = course.teacher { Text(teacher).foregroundStyle(Palette.starDim) }
                    Text([course.courseCode, course.period.map { "Period \($0)" }].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.footnote).foregroundStyle(Palette.starFaint)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(shownGrade.map { String(format: "%.2f%%", $0) } ?? "—")
                        .font(.title.weight(.bold)).monospacedDigit()
                        .foregroundStyle(shownGrade.map(Palette.grade(percent:)) ?? Palette.starDim)
                    if let d = gradeDelta {
                        Text(Self.delta(d)).font(.subheadline.weight(.semibold)).foregroundStyle(Self.deltaColor(d))
                    } else if !hasChanges, let letter = course.displayLetter {
                        Text(letter).font(.subheadline.weight(.semibold)).foregroundStyle(Palette.grade(letter: letter))
                    }
                }
            }
            if let g = shownGrade { GradeBar(percent: g) }
            if hasChanges {
                HStack {
                    Label("What-if mode", systemImage: "wand.and.stars").font(.footnote).foregroundStyle(Palette.vela300)
                    Spacer()
                    Button("Reset") { mods = [:]; added = [:] }.font(.footnote.weight(.semibold))
                }
            } else if course.missingCount > 0 {
                Label("\(course.missingCount) missing assignment\(course.missingCount == 1 ? "" : "s")", systemImage: "exclamationmark.triangle")
                    .font(.footnote).foregroundStyle(Palette.amber).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .card(padding: 20)
    }

    static func delta(_ d: Double) -> String { String(format: "%@%.2f%%", d >= 0 ? "+" : "", d) }
    static func deltaColor(_ d: Double) -> Color { d >= 0 ? Palette.emerald : Palette.rose }

    // MARK: Actions

    private func load(force: Bool = false) async {
        if groups.isEmpty || force { phase = .loading }
        do {
            groups = try await model.loadAssignments(courseId: course.id, force: force)
            if expanded.isEmpty, let first = groups.first { expanded = [first.id] }
            phase = .loaded
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    private func toggle(_ id: String) {
        withAnimation(.easeInOut(duration: 0.2)) {
            if expanded.contains(id) { expanded.remove(id) } else { expanded.insert(id) }
        }
    }

    private func toggleDrop(_ a: ICDetailAssignment) {
        var m = mods[a.id] ?? WhatIfMod()
        m.dropped.toggle()
        mods[a.id] = (m.dropped || m.editedScore != nil) ? m : nil
    }

    private func resetGroup(_ g: ICAssignmentGroup) {
        g.assignments.forEach { mods[$0.id] = nil }
        added[g.id] = nil
    }

    @ViewBuilder
    private func sheetContent(_ sheet: Sheet) -> some View {
        switch sheet {
        case .editScore(let a):
            NumberFormSheet(
                title: "Edit score", subtitle: a.name,
                fields: [.init(label: "Score", suffix: "/ \(a.pointsPossible.formatted(.number.precision(.fractionLength(0...2))))",
                               initial: (mods[a.id]?.editedScore ?? a.score).map(Self.plain) ?? "")],
                canSave: { v in (v.first ?? nil).map { $0 >= 0 } ?? false }
            ) { v in
                var m = mods[a.id] ?? WhatIfMod()
                // Re-entering the original score is not a change.
                m.editedScore = (v[0] == a.score) ? nil : v[0]
                mods[a.id] = (m.dropped || m.editedScore != nil) ? m : nil
            }
        case .addCustom(let groupId):
            CustomAssignmentSheet(existing: nil) { c in added[groupId, default: []].insert(c, at: 0) }
        case .editCustom(let groupId, let c):
            CustomAssignmentSheet(existing: c) { updated in
                if let i = added[groupId]?.firstIndex(where: { $0.id == c.id }) { added[groupId]?[i] = updated }
            }
        case .finalCalc:
            FinalCalcSheet(currentGrade: projected ?? baseGrade ?? course.currentGrade)
        }
    }

    static func plain(_ v: Double) -> String { v.formatted(.number.precision(.fractionLength(0...2)).grouping(.never)) }
}

// MARK: - Group

private struct GroupSection: View {
    let group: ICAssignmentGroup
    let isExpanded: Bool
    let mods: [String: WhatIfMod]
    let extras: [CustomAssignment]
    let toggle: () -> Void
    let onEditScore: (ICDetailAssignment) -> Void
    let onToggleDrop: (ICDetailAssignment) -> Void
    let onReset: (ICDetailAssignment) -> Void
    let onAddCustom: () -> Void
    let onEditCustom: (CustomAssignment) -> Void
    let onRemoveCustom: (CustomAssignment) -> Void
    let onResetGroup: () -> Void

    private var score: Double? { calcGroupScore(group.assignments, mods: mods, extras: extras) }
    private var originalScore: Double? { calcGroupScore(group.assignments, mods: [:]) }
    private var hasMods: Bool { group.assignments.contains { mods[$0.id] != nil } || !extras.isEmpty }
    private var delta: Double? {
        guard hasMods, let s = score, let o = originalScore else { return nil }
        return s - o
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Button(action: toggle) {
                    HStack(spacing: 8) {
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.bold)).foregroundStyle(Palette.starFaint)
                            .rotationEffect(.degrees(isExpanded ? 90 : 0))
                        Text(group.name).font(.headline).foregroundStyle(Palette.starBright)
                        if group.weight > 0 {
                            Text("\(group.weight.formatted(.number.precision(.fractionLength(0...1))))%")
                                .font(.caption).foregroundStyle(Palette.starDim)
                        }
                        Spacer(minLength: 8)
                        if let d = delta {
                            Text(CourseDetailView.delta(d)).font(.caption.weight(.bold)).foregroundStyle(CourseDetailView.deltaColor(d))
                        }
                        if let s = score {
                            Text(String(format: "%.1f%%", s)).font(.subheadline.weight(.semibold)).monospacedDigit()
                                .foregroundStyle(Palette.grade(percent: s))
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(group.name), \(score.map { String(format: "%.1f percent", $0) } ?? "no grade")")
                .accessibilityValue(isExpanded ? "Expanded" : "Collapsed")

                Menu {
                    Button("Add assignment", systemImage: "plus", action: onAddCustom)
                    if hasMods { Button("Reset category", systemImage: "arrow.counterclockwise", role: .destructive, action: onResetGroup) }
                } label: {
                    Image(systemName: "ellipsis").font(.body).foregroundStyle(Palette.starDim)
                        .frame(width: 36, height: 36)
                }
                .accessibilityLabel("\(group.name) options")
            }

            if isExpanded {
                VStack(spacing: 0) {
                    ForEach(extras) { c in
                        Divider().overlay(Palette.border.opacity(0.6))
                        CustomRow(item: c, onEdit: { onEditCustom(c) }, onRemove: { onRemoveCustom(c) })
                    }
                    ForEach(group.assignments) { a in
                        Divider().overlay(Palette.border.opacity(0.6))
                        AssignmentRow(
                            assignment: a, mod: mods[a.id],
                            onEdit: { onEditScore(a) }, onToggleDrop: { onToggleDrop(a) }, onReset: { onReset(a) })
                    }
                }
                .padding(.top, 10)
            }
        }
        .card(padding: 16)
    }
}

// MARK: - Rows

private let scoreFormat = FloatingPointFormatStyle<Double>.number.precision(.fractionLength(0...2)).grouping(.never)

private struct AssignmentRow: View {
    let assignment: ICDetailAssignment
    let mod: WhatIfMod?
    let onEdit: () -> Void
    let onToggleDrop: () -> Void
    let onReset: () -> Void

    private var dropped: Bool { mod?.dropped == true }
    private var effectiveScore: Double? { mod?.editedScore ?? assignment.score }
    private var pct: Double? {
        guard let s = effectiveScore, assignment.pointsPossible > 0 else { return nil }
        return s / assignment.pointsPossible * 100
    }
    private var delta: Double? {
        guard mod?.editedScore != nil, let p = pct, assignment.pointsPossible > 0, let o = assignment.score else { return nil }
        return p - o / assignment.pointsPossible * 100
    }

    private var dueText: String? {
        guard let key = Parsers.datePrefix(assignment.dueAt) else { return nil }
        let p = key.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3, let date = Calendar.current.date(from: DateComponents(year: p[0], month: p[1], day: p[2])) else { return nil }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(assignment.name).font(.subheadline).foregroundStyle(Palette.starWhite)
                    .strikethrough(dropped)
                HStack(spacing: 8) {
                    if let dueText { Text("Due \(dueText)").font(.caption).foregroundStyle(Palette.starFaint) }
                    if dropped { badge("Dropped", color: Palette.vela300) }
                    else {
                        if assignment.missing && mod?.editedScore == nil { badge("Missing", color: Palette.amber) }
                        if assignment.late { badge("Late", color: Palette.rose) }
                    }
                }
            }
            Spacer(minLength: 8)
            if let d = delta {
                Text(CourseDetailView.delta(d)).font(.caption.weight(.bold)).foregroundStyle(CourseDetailView.deltaColor(d))
            }
            VStack(alignment: .trailing, spacing: 2) {
                Text(effectiveScore.map { "\($0.formatted(scoreFormat)) / \(assignment.pointsPossible.formatted(scoreFormat))" }
                     ?? (assignment.missing ? "Missing" : "—"))
                    .font(.subheadline).monospacedDigit()
                    .foregroundStyle(effectiveScore == nil && assignment.missing ? Palette.amber : Palette.starBright)
                if let pct { Text(String(format: "%.2f%%", pct)).font(.caption).monospacedDigit().foregroundStyle(Palette.starDim) }
            }
            Menu {
                Button("Edit score", systemImage: "pencil", action: onEdit)
                Button(dropped ? "Restore" : "Drop assignment", systemImage: dropped ? "arrow.uturn.backward" : "minus.circle", action: onToggleDrop)
                if mod != nil { Button("Reset", systemImage: "arrow.counterclockwise", action: onReset) }
            } label: {
                Image(systemName: "ellipsis").foregroundStyle(Palette.starDim).frame(width: 32, height: 36)
            }
            .accessibilityLabel("Options for \(assignment.name)")
        }
        .padding(.vertical, 10)
        .opacity(dropped ? 0.45 : 1)
    }

    private func badge(_ text: String, color: Color) -> some View {
        Text(text).font(.caption2.weight(.semibold)).foregroundStyle(color)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(Capsule().fill(color.opacity(0.15)))
    }
}

private struct CustomRow: View {
    let item: CustomAssignment
    let onEdit: () -> Void
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.name).font(.subheadline).foregroundStyle(Palette.starWhite)
                Text("Hypothetical").font(.caption2.weight(.semibold)).foregroundStyle(Palette.vela300)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Capsule().fill(Palette.vela400.opacity(0.15)))
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(item.score.formatted(scoreFormat)) / \(item.pointsPossible.formatted(scoreFormat))")
                    .font(.subheadline).monospacedDigit().foregroundStyle(Palette.starBright)
                if item.pointsPossible > 0 {
                    Text(String(format: "%.2f%%", item.score / item.pointsPossible * 100))
                        .font(.caption).monospacedDigit().foregroundStyle(Palette.starDim)
                }
            }
            Menu {
                Button("Edit", systemImage: "pencil", action: onEdit)
                Button("Remove", systemImage: "trash", role: .destructive, action: onRemove)
            } label: {
                Image(systemName: "ellipsis").foregroundStyle(Palette.starDim).frame(width: 32, height: 36)
            }
            .accessibilityLabel("Options for \(item.name)")
        }
        .padding(.vertical, 10)
    }
}

// MARK: - Sheets

private struct NumberFormSheet: View {
    struct Field {
        var label: String
        var suffix: String = ""
        var initial: String = ""
    }

    let title: String
    var subtitle: String?
    let fields: [Field]
    let canSave: ([Double?]) -> Bool
    let onSave: ([Double?]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var texts: [String]
    @FocusState private var focused: Int?

    init(title: String, subtitle: String? = nil, fields: [Field],
         canSave: @escaping ([Double?]) -> Bool, onSave: @escaping ([Double?]) -> Void) {
        self.title = title
        self.subtitle = subtitle
        self.fields = fields
        self.canSave = canSave
        self.onSave = onSave
        _texts = State(initialValue: fields.map(\.initial))
    }

    private var values: [Double?] { texts.map { Double($0.trimmingCharacters(in: .whitespaces)) } }

    var body: some View {
        NavigationStack {
            Form {
                if let subtitle { Section { Text(subtitle).foregroundStyle(Palette.starDim) } }
                Section {
                    ForEach(fields.indices, id: \.self) { i in
                        HStack {
                            Text(fields[i].label)
                            Spacer()
                            TextField("0", text: binding(i))
                                .keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                                .focused($focused, equals: i).frame(maxWidth: 120)
                            if !fields[i].suffix.isEmpty { Text(fields[i].suffix).foregroundStyle(Palette.starDim) }
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden).background(Palette.void)
            .navigationTitle(title).navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { onSave(values); dismiss() }.disabled(!canSave(values))
                }
            }
            .onAppear { focused = 0 }
        }
        .presentationDetents([.medium])
        .preferredColorScheme(.dark)
    }

    private func binding(_ i: Int) -> Binding<String> {
        Binding(get: { i < texts.count ? texts[i] : "" }, set: { if i < texts.count { texts[i] = $0 } })
    }
}

private struct CustomAssignmentSheet: View {
    let existing: CustomAssignment?
    let onSave: (CustomAssignment) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var score = ""
    @State private var possible = ""

    private var scoreValue: Double? { Double(score) }
    private var possibleValue: Double? { Double(possible) }
    private var canSave: Bool {
        guard let s = scoreValue, let p = possibleValue else { return false }
        return s >= 0 && p > 0
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Assignment") {
                    TextField("Name (optional)", text: $name)
                    HStack {
                        Text("Score")
                        Spacer()
                        TextField("0", text: $score).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(maxWidth: 100)
                    }
                    HStack {
                        Text("Out of")
                        Spacer()
                        TextField("100", text: $possible).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(maxWidth: 100)
                    }
                }
            }
            .scrollContentBackground(.hidden).background(Palette.void)
            .navigationTitle(existing == nil ? "Add assignment" : "Edit assignment").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard let s = scoreValue, let p = possibleValue else { return }
                        let trimmed = name.trimmingCharacters(in: .whitespaces)
                        onSave(CustomAssignment(
                            id: existing?.id ?? UUID().uuidString,
                            name: trimmed.isEmpty ? "New assignment" : trimmed, score: s, pointsPossible: p))
                        dismiss()
                    }
                    .disabled(!canSave)
                }
            }
            .onAppear {
                if let e = existing {
                    name = e.name
                    score = CourseDetailView.plain(e.score)
                    possible = CourseDetailView.plain(e.pointsPossible)
                }
            }
        }
        .presentationDetents([.medium])
        .preferredColorScheme(.dark)
    }
}

private struct FinalCalcSheet: View {
    let currentGrade: Double?
    @Environment(\.dismiss) private var dismiss
    @State private var weight = ""
    @State private var target = ""

    private var required: Double? {
        guard let w = Double(weight), let t = Double(target) else { return nil }
        return requiredFinalScore(currentGrade: currentGrade, finalWeightPercent: w, target: t)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    row("Current grade", currentGrade.map { String(format: "%.2f%%", $0) } ?? "—")
                    HStack {
                        Text("Final's weight")
                        Spacer()
                        TextField("20", text: $weight).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(maxWidth: 80)
                        Text("%").foregroundStyle(Palette.starDim)
                    }
                    HStack {
                        Text("Target grade")
                        Spacer()
                        TextField("90", text: $target).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(maxWidth: 80)
                        Text("%").foregroundStyle(Palette.starDim)
                    }
                }
                Section("You need") {
                    Text(required.map { String(format: "%.2f%%", $0) } ?? "—")
                        .font(.system(size: 34, weight: .bold)).monospacedDigit()
                        .foregroundStyle(required == nil ? Palette.starFaint : (required! > 100 ? Palette.rose : Palette.emerald))
                    if let r = required, r > 100 {
                        Text("Above 100%, so that target isn't reachable on the final alone.")
                            .font(.footnote).foregroundStyle(Palette.starDim)
                    }
                }
            }
            .scrollContentBackground(.hidden).background(Palette.void)
            .navigationTitle("Final grade calculator").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
        .preferredColorScheme(.dark)
    }

    private func row(_ title: String, _ value: String) -> some View {
        HStack { Text(title); Spacer(); Text(value).foregroundStyle(Palette.starDim) }
    }
}
