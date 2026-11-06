import SwiftUI
import VelaKit

private let initialCount = 8
private let loadMoreCount = 10

/// Flex-period (Responsive Scheduling) picker. Port of apps/mobile/app/(tabs)/schedule/index.tsx.
struct FlexView: View {
    @Environment(AppModel.self) private var model
    @State private var pickedId: String?

    private var upcoming: [ICResponsiveSession] {
        let today = getLocalParts(Date()).dateKey
        return model.flexSessions.filter { ($0.endDate ?? "9999-12-31") >= today }
    }
    private var selected: ICResponsiveSession? { upcoming.first { $0.id == pickedId } ?? upcoming.first }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if case .failed(let message) = model.flexState { ErrorBanner(message: message).padding(.bottom, 16) }

                    if let selected {
                        DayHeader(sessions: upcoming, selected: selected) { pickedId = $0 }
                        SessionCard(session: selected).id(selected.id)
                    } else if model.flexState == .loading || model.flexState == .idle {
                        ProgressView().tint(Palette.vela400).frame(maxWidth: .infinity).padding(.top, 80)
                    } else if model.flexState == .loaded {
                        VStack(spacing: 14) {
                            Image(systemName: "calendar.badge.checkmark").font(.system(size: 44)).foregroundStyle(Palette.starFaint)
                            Text("No upcoming responsive schedule sessions.\nYour school may not use Responsive Scheduling.")
                                .font(.subheadline).foregroundStyle(Palette.starDim).multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity).padding(.top, 80)
                    }
                }
                .padding(20)
            }
            .scrollDismissesKeyboard(.interactively)
            .refreshable { await model.loadFlex(force: true) }
            .velaBackground()
            .navigationTitle("Schedule")
            .navigationBarTitleDisplayMode(.inline)
            .task { await model.loadFlex() }
        }
    }
}

// MARK: - Helpers

/// "Thursday ACCESS; Thu 10/29/2026" → "Thursday ACCESS" (the date is shown separately).
private func sessionTitle(_ name: String) -> String {
    let t = name.split(separator: ";").first.map { $0.trimmingCharacters(in: .whitespaces) } ?? ""
    return t.isEmpty ? name : t
}

private func formatDay(_ date: String?) -> String? {
    guard let date else { return nil }
    let p = date.split(separator: "-").compactMap { Int($0) }
    guard p.count == 3, let d = Calendar.current.date(from: DateComponents(year: p[0], month: p[1], day: p[2])) else { return nil }
    return d.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
}

private func seatsColor(_ seatsLeft: Int?) -> Color {
    guard let seatsLeft else { return Palette.starDim }
    if seatsLeft == 0 { return Color(hex: 0xF43F5E) }
    if seatsLeft <= 3 { return Color(hex: 0xF59E0B) }
    return Palette.emerald
}

private func seatsLabel(_ o: ICResponsiveOffering) -> String {
    guard let s = o.seatsLeft else { return "—" }
    return s == 0 ? "Full" : "\(s) left"
}

// MARK: - Day header

private struct DayHeader: View {
    let sessions: [ICResponsiveSession]
    let selected: ICResponsiveSession
    let onSelect: (String) -> Void

    var body: some View {
        HStack(alignment: .top) {
            Menu {
                ForEach(sessions) { s in
                    Button {
                        onSelect(s.id)
                    } label: {
                        Text("\(sessionTitle(s.name)) · \(formatDay(s.startDate) ?? "")")
                        if s.id == selected.id { Image(systemName: "checkmark") }
                    }
                }
            } label: {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 8) {
                        Text(sessionTitle(selected.name)).font(.title3.weight(.semibold)).foregroundStyle(Palette.starBright)
                            .multilineTextAlignment(.leading)
                        if sessions.count > 1 { Image(systemName: "chevron.down").font(.subheadline.weight(.semibold)).foregroundStyle(Palette.vela300) }
                    }
                    if let day = formatDay(selected.startDate) { Text(day).font(.subheadline).foregroundStyle(Palette.starFaint) }
                }
            }
            .disabled(sessions.count < 2)
            .accessibilityHint(sessions.count > 1 ? "Choose another day" : "")
            Spacer()
            if !selected.isOpen {
                Text("Closed").font(.footnote.weight(.semibold)).foregroundStyle(Palette.starDim)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(Capsule().fill(Palette.starDim.opacity(0.12)))
                    .overlay(Capsule().strokeBorder(Palette.starDim.opacity(0.25)))
            }
        }
        .padding(.bottom, 16)
    }
}

// MARK: - Session card

private struct SessionCard: View {
    @Environment(AppModel.self) private var model
    let session: ICResponsiveSession

    @State private var shown = initialCount
    @State private var query = ""
    @State private var pending: ICResponsiveOffering?
    @State private var busyId: String?
    @State private var errorMessage: String?

    /// A teacher placement can't be changed by the student.
    private var locked: Bool { session.selectedOffering?.teacherAssigned == true }
    // Most seats first, full ones after, and never repeat the student's own pick.
    private var others: [ICResponsiveOffering] {
        session.offerings.filter { !$0.isSelected }
            .enumerated().sorted { l, r in
                let a = l.element.seatsLeft ?? -1, b = r.element.seatsLeft ?? -1
                return a == b ? l.offset < r.offset : a > b
            }.map(\.element)
    }
    private var needle: String { query.trimmingCharacters(in: .whitespaces).lowercased() }
    private var matches: [ICResponsiveOffering] {
        guard !needle.isEmpty else { return others }
        return others.filter { o in [o.name, o.teacher, o.room, o.description].contains { $0?.lowercased().contains(needle) == true } }
    }
    private var visible: [ICResponsiveOffering] { needle.isEmpty ? Array(matches.prefix(shown)) : matches }
    private var remaining: Int { others.count - shown }
    private var canAct: Bool { session.isOpen && !locked }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if others.isEmpty {
                CurrentPick(offering: session.selectedOffering)
            } else {
                searchField.padding(.bottom, 12)
                if !needle.isEmpty {
                    Text("\(matches.count) of \(others.count) sessions match").font(.footnote).foregroundStyle(Palette.starFaint).padding(.bottom, 6)
                }
                if canAct {
                    Text("Tap a session to \(session.selectedOffering != nil ? "switch to it" : "sign up")")
                        .font(.footnote).foregroundStyle(Palette.vela300).padding(.bottom, 10)
                }
                CurrentPick(offering: session.selectedOffering)
                if !needle.isEmpty && matches.isEmpty {
                    Text("No sessions match \"\(query.trimmingCharacters(in: .whitespaces))\".")
                        .foregroundStyle(Palette.starDim).frame(maxWidth: .infinity).padding(.vertical, 16)
                }
                ForEach(visible) { o in
                    OfferingRow(offering: o, interactive: canAct && o.seatsLeft != 0, busy: busyId == o.id, disabled: busyId != nil) {
                        pending = o
                    }
                }
                if needle.isEmpty && others.count > initialCount {
                    Button {
                        shown = remaining > 0 ? shown + loadMoreCount : initialCount
                    } label: {
                        Label(remaining > 0 ? "Show \(min(loadMoreCount, remaining)) more" : "Show less",
                              systemImage: remaining > 0 ? "chevron.down" : "chevron.up")
                            .font(.subheadline.weight(.medium)).frame(maxWidth: .infinity, minHeight: 44)
                    }
                }
            }
        }
        .alert(pending.map { "\(session.selectedOffering != nil ? "Switch to" : "Sign up for") \"\($0.name)\"?" } ?? "",
               isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } }), presenting: pending) { o in
            Button("Cancel", role: .cancel) {}
            Button(session.selectedOffering != nil ? "Switch" : "Sign up") { confirm(o) }
        } message: { _ in
            Text([sessionTitle(session.name), formatDay(session.startDate)].compactMap { $0 }.joined(separator: " · "))
        }
        .alert("Couldn't update", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: { Text(errorMessage ?? "") }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").font(.subheadline).foregroundStyle(Palette.starFaint)
            TextField("Search name, teacher or room", text: $query)
                .textInputAutocapitalization(.never).autocorrectionDisabled().submitLabel(.search)
                .foregroundStyle(Palette.starWhite)
            if !query.isEmpty {
                Button { query = "" } label: { Image(systemName: "xmark").font(.footnote).foregroundStyle(Palette.starDim).frame(width: 32, height: 32) }
                    .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 12).frame(height: 44)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.04)))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Palette.border))
    }

    private func confirm(_ o: ICResponsiveOffering) {
        busyId = o.id
        Task {
            do { try await model.selectFlexOffering(in: session, offeringId: o.id) }
            catch { errorMessage = error.localizedDescription }
            busyId = nil
        }
    }
}

// MARK: - Rows

private struct OfferingMeta: View {
    let offering: ICResponsiveOffering
    var body: some View {
        HStack(spacing: 12) {
            if let t = offering.teacher { Label(t, systemImage: "person").labelStyle(CompactLabel()) }
            if let r = offering.room { Label(r, systemImage: "mappin").labelStyle(CompactLabel()) }
        }
        .font(.footnote).foregroundStyle(Palette.starFaint)
    }
}

private struct CompactLabel: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 4) { configuration.icon.font(.caption2); configuration.title }
    }
}

/// The student's current session: first in the list, larger, with a bright border.
private struct CurrentPick: View {
    let offering: ICResponsiveOffering?
    @State private var open = false

    var body: some View {
        if let offering {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Label("Your pick", systemImage: "checkmark.circle.fill").font(.caption.weight(.semibold)).foregroundStyle(Palette.vela300)
                        Text(offering.name).font(.title3.weight(.semibold)).foregroundStyle(Palette.starBright)
                            .lineLimit(open ? nil : 2)
                        OfferingMeta(offering: offering)
                    }
                    Spacer(minLength: 8)
                    if offering.description != nil {
                        Button { withAnimation { open.toggle() } } label: {
                            Image(systemName: open ? "chevron.up" : "chevron.down").foregroundStyle(Palette.vela300).frame(width: 36, height: 36)
                        }
                        .accessibilityLabel(open ? "Hide description" : "Show description")
                    }
                }
                if open, let d = offering.description { Text(d).font(.subheadline).foregroundStyle(Palette.starDim) }
                if offering.teacherAssigned {
                    Label("Placed here by a teacher" + (offering.teacherReason.map { ": \($0)" } ?? ""), systemImage: "lock.fill")
                        .font(.footnote).foregroundStyle(Palette.amber)
                }
            }
            .padding(16)
            .background(RoundedRectangle(cornerRadius: 16).fill(Palette.vela400.opacity(0.1)))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Palette.vela400, lineWidth: 2))
            .padding(.bottom, 12)
        }
    }
}

/// Tapping the row signs up / switches; the chevron (when there is a description) expands it.
private struct OfferingRow: View {
    let offering: ICResponsiveOffering
    let interactive: Bool
    let busy: Bool
    let disabled: Bool
    let onTap: () -> Void
    @State private var open = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(offering.name).font(.body.weight(.medium)).foregroundStyle(Palette.starWhite).lineLimit(open ? nil : 1)
                    OfferingMeta(offering: offering)
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 4) {
                    HStack(spacing: 6) {
                        if busy { ProgressView().controlSize(.small) }
                        Text(seatsLabel(offering)).font(.subheadline.weight(.semibold)).monospacedDigit().foregroundStyle(seatsColor(offering.seatsLeft))
                    }
                    if offering.description != nil {
                        Button { withAnimation { open.toggle() } } label: {
                            Image(systemName: open ? "chevron.up" : "chevron.down").font(.footnote).foregroundStyle(Palette.starDim).frame(width: 32, height: 28)
                        }
                        .accessibilityLabel(open ? "Hide description" : "Show description")
                    }
                }
            }
            if open, let d = offering.description { Text(d).font(.subheadline).foregroundStyle(Palette.starDim) }
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 12).fill(interactive ? Palette.vela400.opacity(0.07) : .clear))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(interactive ? Palette.vela400.opacity(0.28) : Palette.border))
        .opacity(interactive && disabled && !busy ? 0.5 : 1)
        .contentShape(RoundedRectangle(cornerRadius: 12))
        .onTapGesture { if interactive && !disabled { onTap() } }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(offering.name), \(seatsLabel(offering))")
        .accessibilityAddTraits(interactive ? .isButton : [])
        .padding(.bottom, 8)
    }
}
