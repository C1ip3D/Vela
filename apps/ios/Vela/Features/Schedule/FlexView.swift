import SwiftUI
import VelaKit

private let initialCount = 8
private let loadMoreCount = 10

/// Flex-period (Responsive Scheduling / ACCESS) picker.
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
                VStack(alignment: .leading, spacing: Layout.gap) {
                    if case .failed(let message) = model.flexState { ErrorBanner(message: message) }

                    if let selected {
                        if upcoming.count > 1 {
                            DayStrip(sessions: upcoming, selectedId: selected.id) { pickedId = $0 }
                        }
                        SessionHeader(session: selected)
                        SessionBody(session: selected).id(selected.id)
                    } else if model.flexState == .loading || model.flexState == .idle {
                        ProgressView().tint(Palette.tint).frame(maxWidth: .infinity).padding(.top, 80)
                    } else if model.flexState == .loaded {
                        EmptyState(systemImage: "calendar",
                                   message: "No upcoming sessions.\nYour school may not use Responsive Scheduling.")
                            .padding(.top, 40)
                    }
                }
                .padding(Layout.screen)
            }
            .scrollDismissesKeyboard(.interactively)
            .refreshable { await model.loadFlex(force: true) }
            .velaBackground()
            .navigationTitle("Access")
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

private func parseDay(_ date: String?) -> Date? {
    guard let date else { return nil }
    let p = date.split(separator: "-").compactMap { Int($0) }
    guard p.count == 3 else { return nil }
    return Calendar.current.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))
}

private func formatDay(_ date: String?) -> String? {
    parseDay(date)?.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
}

private func seatsColor(_ seatsLeft: Int?) -> Color {
    guard let seatsLeft else { return Palette.textDim }
    if seatsLeft == 0 { return Palette.bad }
    if seatsLeft <= 3 { return Palette.warn }
    return Palette.good
}

private func seatsLabel(_ o: ICResponsiveOffering) -> String {
    guard let s = o.seatsLeft else { return "—" }
    return s == 0 ? "Full" : "\(s) left"
}

// MARK: - Day strip

/// One equal-size chip per upcoming session day.
private struct DayStrip: View {
    let sessions: [ICResponsiveSession]
    let selectedId: String
    let onSelect: (String) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(sessions) { s in
                    let on = s.id == selectedId
                    let date = parseDay(s.startDate)
                    Button { onSelect(s.id) } label: {
                        VStack(spacing: 2) {
                            Text(date?.formatted(.dateTime.weekday(.abbreviated)) ?? "Day")
                                .font(.caption.weight(.medium)).foregroundStyle(on ? Palette.actionInk.opacity(0.7) : Palette.blue)
                            Text(date?.formatted(.dateTime.day()) ?? "–")
                                .font(.headline).monospacedDigit().foregroundStyle(on ? Palette.actionInk : Palette.text)
                        }
                        .frame(width: 52, height: 56)
                        .background(RoundedRectangle(cornerRadius: Layout.fieldRadius, style: .continuous).fill(on ? Palette.action : Palette.surface))
                        .overlay(RoundedRectangle(cornerRadius: Layout.fieldRadius, style: .continuous).strokeBorder(on ? .clear : Palette.border))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(sessionTitle(s.name)), \(formatDay(s.startDate) ?? "")")
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
        }
        // Let the strip scroll edge to edge while its first chip still lines up with the cards below.
        .contentMargins(.horizontal, Layout.screen, for: .scrollContent)
        .padding(.horizontal, -Layout.screen)
    }
}

private struct SessionHeader: View {
    let session: ICResponsiveSession

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(sessionTitle(session.name)).font(.title3.weight(.semibold)).foregroundStyle(Palette.text).lineLimit(2)
                if let day = formatDay(session.startDate) { Text(day).font(.subheadline).foregroundStyle(Palette.textDim) }
            }
            Spacer(minLength: 8)
            if !session.isOpen { Pill(text: "Closed") }
        }
        .padding(.top, 4)
    }
}

// MARK: - Session body

private struct SessionBody: View {
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
    private var trimmedQuery: String { query.trimmingCharacters(in: .whitespaces) }
    private var searching: Bool { !trimmedQuery.isEmpty }
    /// Teacher last-name matches first; see `searchOfferings` in VelaKit.
    private var matches: [ICResponsiveOffering] { searchOfferings(others, query: trimmedQuery) }
    private var visible: [ICResponsiveOffering] { searching ? matches : Array(others.prefix(shown)) }
    private var remaining: Int { others.count - shown }
    private var canAct: Bool { session.isOpen && !locked }

    var body: some View {
        VStack(alignment: .leading, spacing: Layout.gap) {
            CurrentPick(offering: session.selectedOffering)

            if !others.isEmpty {
                searchField
                HStack {
                    SectionLabel(title: searching ? "\(matches.count) of \(others.count) match" : "\(others.count) sessions")
                    if canAct {
                        Text(session.selectedOffering != nil ? "Tap to switch" : "Tap to sign up")
                            .font(.caption).foregroundStyle(Palette.textFaint).fixedSize()
                    }
                }
                .padding(.top, 4)

                if searching && matches.isEmpty {
                    EmptyState(systemImage: "magnifyingglass", message: "No teacher or session matches \"\(trimmedQuery)\".").card()
                } else {
                    VStack(spacing: 0) {
                        ForEach(visible) { o in
                            OfferingRow(offering: o, interactive: canAct && o.seatsLeft != 0, busy: busyId == o.id, disabled: busyId != nil) {
                                pending = o
                            }
                            if o.id != visible.last?.id { RowDivider().padding(.leading, Layout.card) }
                        }
                    }
                    .card(padding: 0)
                }

                if !searching && others.count > initialCount {
                    Button {
                        shown = remaining > 0 ? shown + loadMoreCount : initialCount
                    } label: {
                        Text(remaining > 0 ? "Show \(min(loadMoreCount, remaining)) more" : "Show less")
                            .font(.subheadline.weight(.medium)).frame(maxWidth: .infinity, minHeight: Layout.row)
                    }
                }
            }
        }
        .alert(pending.map { "\(session.selectedOffering != nil ? "Switch to" : "Sign up for") \"\($0.name)\"?" } ?? "",
               isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } }), presenting: pending) { o in
            Button("Cancel", role: .cancel) {}
            Button(session.selectedOffering != nil ? "Switch" : "Sign up") { confirm(o) }
        } message: { o in
            Text([o.teacher, sessionTitle(session.name), formatDay(session.startDate)].compactMap { $0 }.joined(separator: " · "))
        }
        .alert("Couldn't update", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: { Text(errorMessage ?? "") }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").font(.subheadline).foregroundStyle(Palette.textFaint)
            TextField("Search by teacher's last name", text: $query)
                .textInputAutocapitalization(.never).autocorrectionDisabled().submitLabel(.search)
                .foregroundStyle(Palette.text)
            if !query.isEmpty {
                Button { query = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(Palette.textFaint).frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .compactHitArea(8)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 12)
        .fieldChrome()
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

/// "Chen, L · S2". The teacher comes first because that is what students search and scan for.
private func offeringMeta(_ o: ICResponsiveOffering) -> String {
    [o.teacher, o.room].compactMap { $0 }.joined(separator: " · ")
}

/// Every session has the same info dropdown, whether or not Infinite Campus has a description for it.
private struct InfoToggle: View {
    @Binding var open: Bool

    var body: some View {
        Button { open.toggle() } label: {
            Image(systemName: open ? "chevron.up" : "chevron.down").font(.footnote.weight(.semibold))
                .foregroundStyle(open ? Palette.blue : Palette.textFaint).frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .compactHitArea(6)
        .accessibilityLabel(open ? "Hide info" : "Show info")
    }
}

private struct OfferingInfo: View {
    let offering: ICResponsiveOffering

    private var text: String? {
        let d = offering.description?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return d.isEmpty ? nil : d
    }

    var body: some View {
        Text(text ?? "No extra info for this session.")
            .font(.subheadline)
            .foregroundStyle(text == nil ? Palette.textFaint : Palette.textDim)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(RoundedRectangle(cornerRadius: Layout.fieldRadius, style: .continuous).fill(Palette.field))
    }
}

/// The student's current session, pinned above the list.
private struct CurrentPick: View {
    let offering: ICResponsiveOffering?
    @State private var open = false

    var body: some View {
        if let offering {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Label("Your pick", systemImage: "checkmark.circle.fill").font(.caption.weight(.semibold)).foregroundStyle(Palette.tan)
                        Text(offering.name).font(.headline).foregroundStyle(Palette.text).lineLimit(open ? nil : 2)
                        if !offeringMeta(offering).isEmpty {
                            Text(offeringMeta(offering)).font(.footnote).foregroundStyle(Palette.textDim).lineLimit(1)
                        }
                    }
                    Spacer(minLength: 8)
                    InfoToggle(open: $open)
                }
                if open { OfferingInfo(offering: offering) }
                if offering.teacherAssigned {
                    Label("Placed here by a teacher" + (offering.teacherReason.map { ": \($0)" } ?? ""), systemImage: "lock.fill")
                        .font(.footnote).foregroundStyle(Palette.warn)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .heroCard(Palette.tan, padding: Layout.card)
        }
    }
}

/// Tapping the row signs up / switches; the chevron opens the info dropdown.
private struct OfferingRow: View {
    let offering: ICResponsiveOffering
    let interactive: Bool
    let busy: Bool
    let disabled: Bool
    let onTap: () -> Void
    @State private var open = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(offering.name).font(.body.weight(.medium)).foregroundStyle(Palette.text).lineLimit(open ? nil : 1)
                    if !offeringMeta(offering).isEmpty {
                        Text(offeringMeta(offering)).font(.footnote).foregroundStyle(Palette.textDim).lineLimit(1)
                    }
                }
                Spacer(minLength: 8)
                if busy { ProgressView().controlSize(.small) }
                Text(seatsLabel(offering)).font(.subheadline.weight(.semibold)).monospacedDigit()
                    .foregroundStyle(seatsColor(offering.seatsLeft)).fixedSize()
                InfoToggle(open: $open)
            }
            if open { OfferingInfo(offering: offering) }
        }
        .padding(.horizontal, Layout.card).padding(.vertical, 10)
        .frame(minHeight: 64)
        .opacity(offering.seatsLeft == 0 || (disabled && !busy) ? 0.55 : 1)
        .contentShape(Rectangle())
        .onTapGesture { if interactive && !disabled { onTap() } }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(offering.name), \(offering.teacher ?? ""), \(seatsLabel(offering))")
        .accessibilityAddTraits(interactive ? .isButton : [])
    }
}
