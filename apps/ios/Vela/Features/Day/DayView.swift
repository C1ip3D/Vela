import SwiftUI
import VelaKit

struct DayView: View {
    @Environment(AppModel.self) private var model
    private static let dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 30)) { timeline in
                content(now: timeline.date)
            }
            .velaBackground()
            .navigationTitle("Today")
            .refreshable { await model.loadSchedule(force: true) }
            .task { await model.loadSchedule() }
        }
    }

    @ViewBuilder
    private func content(now: Date) -> some View {
        if model.scheduleEntries.isEmpty {
            emptyState
        } else {
            let bells = model.bells
            let local = getLocalParts(now, timeZone: bells.first?.timezone ?? model.districtDefaults?.timezone)
            let isSchoolDay = (1...5).contains(local.day)
            // Today's classes; on a weekend, the next school day (Monday).
            let day = isSchoolDay ? local.day : 1
            let todaySlots = isSchoolDay ? getDaySlots(model.scheduleEntries, bells: bells, day: local.day, dateKey: local.dateKey) : []
            let status = isSchoolDay ? getCurrentAndNext(todaySlots, nowMinutes: local.minutes) : nil

            ScrollView {
                VStack(alignment: .leading, spacing: Layout.gap) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(statusLine(status) ?? (isSchoolDay ? "No classes right now" : "No school today"))
                            .font(.headline).foregroundStyle(Palette.text)
                        Text(isSchoolDay ? Self.dayNames[day] : "Showing \(Self.dayNames[day])")
                            .font(.subheadline).foregroundStyle(Palette.textDim)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .card()
                    if bells.isEmpty {
                        Text("No bell times for your district yet, so classes are listed without times. Add them in Settings.")
                            .font(.footnote).foregroundStyle(Palette.warn)
                    }
                    SectionLabel(title: "Classes").padding(.top, 8)
                    dayCards(day: day, isToday: day == local.day, local: local, bells: bells)
                }
                .padding(Layout.screen)
            }
        }
    }

    private func statusLine(_ status: CurrentAndNext?) -> String? {
        guard let status, status.state != .noSchool else { return nil }
        switch status.state {
        case .inClass:
            return "In \(status.current?.entry.courseName ?? "class") · \(status.minutesRemaining ?? 0) min left"
        case .before, .passing:
            return "Next: \(status.next?.entry.courseName ?? "class") in \(status.minutesRemaining ?? 0) min"
        case .after:
            return "School's out for today"
        case .noSchool:
            return nil
        }
    }

    @ViewBuilder
    private func dayCards(day: Int, isToday: Bool, local: LocalParts, bells: [BellSchedule]) -> some View {
        // A date-pinned variant (finals, minimum day) only applies to its own date.
        let slots = getDaySlots(model.scheduleEntries, bells: bells, day: day, dateKey: isToday ? local.dateKey : nil)
        let current = isToday ? getCurrentAndNext(slots, nowMinutes: local.minutes).current : nil
        // Chronological by bell time; classes with no bell time go last, by period.
        let startOf: (ScheduleEntry) -> Int = { e in slots.first { $0.period == e.period }?.startMinutes ?? .max }
        let entries = entriesForDay(model.scheduleEntries, day: day).enumerated().sorted { l, r in
            let a = startOf(l.element), b = startOf(r.element)
            if a != b { return a < b }
            let c = l.element.period.compare(r.element.period, options: .numeric)
            return c == .orderedSame ? l.offset < r.offset : c == .orderedAscending
        }.map(\.element)

        if entries.isEmpty {
            EmptyState(systemImage: "calendar", message: "No classes").card()
        } else {
            VStack(spacing: 0) {
                ForEach(Array(entries.enumerated()), id: \.offset) { i, e in
                    ClassRow(entry: e, slot: slots.first { $0.period == e.period }, isNow: current?.entry == e)
                    if i < entries.count - 1 { RowDivider().padding(.leading, Layout.card) }
                }
            }
            .card(padding: 0)
        }
    }

    @ViewBuilder
    private var emptyState: some View {
        VStack(spacing: 12) {
            switch model.scheduleState {
            case .loading, .idle:
                ProgressView().tint(Palette.tint)
            case .failed(let message):
                Text("No schedule found yet").font(.headline).foregroundStyle(Palette.text)
                Text(message).font(.subheadline).foregroundStyle(Palette.bad).multilineTextAlignment(.center)
                Button("Try again") { Task { await model.loadSchedule(force: true) } }.buttonStyle(.bordered)
            case .loaded:
                Text("No schedule found yet").font(.headline).foregroundStyle(Palette.text)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct ClassRow: View {
    let entry: ScheduleEntry
    let slot: ScheduleSlot?
    let isNow: Bool

    private static func clock(_ minutes: Int) -> String {
        let h = minutes / 60
        return "\((h + 11) % 12 + 1):\(String(format: "%02d", minutes % 60))"
    }
    private static func meridiem(_ minutes: Int) -> String { minutes / 60 < 12 ? "AM" : "PM" }

    private var detail: String {
        var parts = [entry.period.allSatisfy(\.isNumber) ? "Period \(entry.period)" : entry.period]
        if let room = entry.room { parts.append("Room \(room)") }
        if let teacher = entry.teacher { parts.append(teacher) }
        return parts.joined(separator: " · ")
    }

    var body: some View {
        HStack(spacing: 12) {
            // Fixed-width time column keeps every class name on the same left edge.
            VStack(alignment: .leading, spacing: 2) {
                if let slot {
                    Text("\(Self.clock(slot.startMinutes)) \(Self.meridiem(slot.startMinutes))")
                        .font(.subheadline.weight(.medium)).foregroundStyle(Palette.text)
                    Text("\(Self.clock(slot.endMinutes)) \(Self.meridiem(slot.endMinutes))")
                        .font(.footnote).foregroundStyle(Palette.textFaint)
                } else {
                    Text("—").font(.subheadline).foregroundStyle(Palette.textFaint)
                }
            }
            .monospacedDigit()
            .lineLimit(1).minimumScaleFactor(0.8)
            .frame(width: 72, alignment: .leading)

            VStack(alignment: .leading, spacing: 3) {
                Text(entry.courseName).font(.body.weight(.medium)).foregroundStyle(Palette.text).lineLimit(1)
                Text(detail).font(.footnote).foregroundStyle(Palette.textDim).lineLimit(1)
            }
            Spacer(minLength: 8)
            if isNow { Pill(text: "Now", color: Palette.good) }
        }
        .padding(.horizontal, Layout.card)
        .frame(minHeight: 64)
        .background(isNow ? Palette.elevated : .clear)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isNow ? .isSelected : [])
    }
}
