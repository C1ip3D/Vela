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
            .navigationTitle("Day")
            .navigationBarTitleDisplayMode(.inline)
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
                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel(title: isSchoolDay ? "Today · \(Self.dayNames[day])" : "Next school day · \(Self.dayNames[day])")
                    if let line = statusLine(status) { Text(line).foregroundStyle(Palette.starDim) }
                    if !isSchoolDay { Text("No school today.").foregroundStyle(Palette.starDim) }
                    if bells.isEmpty {
                        Text("No bell times for your district yet, so classes are listed without times.")
                            .font(.footnote).foregroundStyle(Palette.amber)
                    }
                    dayCards(day: day, isToday: day == local.day, local: local, bells: bells)
                }
                .padding(20)
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
            Text("No classes").foregroundStyle(Palette.starDim)
        } else {
            ForEach(Array(entries.enumerated()), id: \.offset) { _, e in
                let slot = slots.first { $0.period == e.period }
                ClassCard(entry: e, slot: slot, isNow: current?.entry == e)
            }
        }
    }

    @ViewBuilder
    private var emptyState: some View {
        VStack(spacing: 12) {
            switch model.scheduleState {
            case .loading, .idle:
                ProgressView().tint(Palette.vela400)
            case .failed(let message):
                Text("No schedule found yet").font(.title3).foregroundStyle(Palette.starBright)
                Text(message).font(.subheadline).foregroundStyle(Palette.rose).multilineTextAlignment(.center)
                Button("Try again") { Task { await model.loadSchedule(force: true) } }.buttonStyle(.bordered)
            case .loaded:
                Text("No schedule found yet").font(.title3).foregroundStyle(Palette.starBright)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct ClassCard: View {
    let entry: ScheduleEntry
    let slot: ScheduleSlot?
    let isNow: Bool

    private static func clock(_ minutes: Int) -> String {
        let h = minutes / 60
        return "\((h + 11) % 12 + 1):\(String(format: "%02d", minutes % 60)) \(h < 12 ? "AM" : "PM")"
    }

    private var detail: String {
        var s = entry.period.allSatisfy(\.isNumber) ? "Period \(entry.period)" : entry.period
        if let room = entry.room { s += " · Room \(room)" }
        if let teacher = entry.teacher { s += " · \(teacher)" }
        return s
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(entry.courseName).font(.title3).foregroundStyle(Palette.starBright).lineLimit(2)
                Spacer(minLength: 12)
                Text(slot.map { "\(Self.clock($0.startMinutes)) – \(Self.clock($0.endMinutes))" } ?? "No bell time")
                    .font(.subheadline).monospacedDigit().foregroundStyle(Palette.starDim)
            }
            Text(detail).font(.footnote).foregroundStyle(Palette.starDim)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(highlighted: isNow)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isNow ? .isSelected : [])
    }
}
