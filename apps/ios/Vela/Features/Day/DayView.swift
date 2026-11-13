import SwiftUI
import VelaKit

struct DayView: View {
    @Environment(AppModel.self) private var model
    private static let dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 1)) { timeline in
                content(now: timeline.date)
            }
            .velaBackground()
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .navigationBar)
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
            let tz = bells.first?.timezone ?? model.districtDefaults?.timezone
            let local = getLocalParts(now, timeZone: tz)
            let isSchoolDay = (1...5).contains(local.day)
            // Today's classes; on a weekend, the next school day (Monday).
            let day = isSchoolDay ? local.day : 1
            let slots = getDaySlots(model.scheduleEntries, bells: bells, day: day, dateKey: isSchoolDay ? local.dateKey : nil)
            let status = isSchoolDay ? getCurrentAndNext(slots, nowMinutes: local.minutes) : nil
            let upcoming = isSchoolDay ? slots.filter { $0.startMinutes > local.minutes } : slots

            ScrollView {
                VStack(spacing: 0) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(now.formatted(.dateTime.weekday(.wide)))
                            .font(.largeTitle.weight(.bold)).foregroundStyle(Palette.text)
                        Text(now.formatted(.dateTime.month(.wide).day().year()))
                            .font(.subheadline.weight(.medium)).foregroundStyle(Palette.tan)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 8).padding(.bottom, 16)
                    .accessibilityElement(children: .combine)
                    hero(status: status, slots: slots, isSchoolDay: isSchoolDay, now: now, tz: tz, day: day)
                    if bells.isEmpty {
                        Text("No bell times for your district yet, so classes can't be timed.")
                            .font(.footnote).foregroundStyle(Palette.warn).padding(.top, 16)
                    }
                    upcomingList(upcoming, isSchoolDay: isSchoolDay, day: day)
                }
                .padding(.horizontal, Layout.screen)
                .padding(.bottom, 32)
            }
        }
    }

    private func seconds(_ now: Date, tz: String?) -> Int {
        var cal = Calendar(identifier: .gregorian)
        if let tz, let zone = TimeZone(identifier: tz) { cal.timeZone = zone }
        return cal.component(.second, from: now)
    }

    @ViewBuilder
    private func hero(status: CurrentAndNext?, slots: [ScheduleSlot], isSchoolDay: Bool, now: Date, tz: String?, day: Int) -> some View {
        let sec = seconds(now, tz: tz)
        // (title, ring caption, seconds left, ring total seconds, time range)
        let model: (String, String, Int, Int, String)? = {
            guard let status else { return nil }
            let left = max((status.minutesRemaining ?? 0) * 60 - sec, 0)
            switch status.state {
            case .inClass:
                guard let c = status.current else { return nil }
                return (c.entry.courseName, "remaining", left, (c.endMinutes - c.startMinutes) * 60,
                        "\(Self.time(c.startMinutes)) - \(Self.time(c.endMinutes))")
            case .before, .passing:
                guard let n = status.next else { return nil }
                let prevEnd = slots.last { $0.endMinutes <= n.startMinutes }?.endMinutes ?? (n.startMinutes - 60)
                return ("Next: \(n.entry.courseName)", "until start", left, max((n.startMinutes - prevEnd) * 60, 1),
                        "\(Self.time(n.startMinutes)) - \(Self.time(n.endMinutes))")
            default: return nil
            }
        }()

        VStack(spacing: 18) {
            if let (title, caption, left, total, range) = model {
                Text(title)
                    .font(.title2.weight(.bold)).foregroundStyle(Palette.text)
                    .multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.7)
                ring(progress: Double(left) / Double(total)) {
                    VStack(spacing: 2) {
                        Text(String(format: "%02d:%02d", left / 60, left % 60))
                            .font(.system(size: 52, weight: .bold, design: .rounded)).monospacedDigit()
                            .lineLimit(1).minimumScaleFactor(0.6)
                            .foregroundStyle(Palette.text)
                        Text(caption.uppercased()).font(.caption.weight(.semibold)).tracking(0.8).foregroundStyle(Palette.blue)
                    }
                    .padding(.horizontal, 28)
                }
                Text(range)
                    .font(.subheadline.weight(.semibold)).monospacedDigit().foregroundStyle(Palette.tan)
                    .padding(.horizontal, 14).padding(.vertical, 7)
                    .background(Capsule().fill(Palette.tan.opacity(0.12)))
            } else {
                Text(isSchoolDay ? (status?.state == .after ? "School's out" : "No classes right now") : "No school today")
                    .font(.title2.weight(.bold)).foregroundStyle(Palette.text)
                ring(progress: 0) {
                    Image(systemName: isSchoolDay ? "checkmark" : "moon.zzz")
                        .font(.system(size: 44, weight: .semibold)).foregroundStyle(Palette.blue)
                }
                if !isSchoolDay {
                    Text("Showing \(Self.dayNames[day])").font(.subheadline.weight(.medium)).foregroundStyle(Palette.textDim)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .heroCard(Palette.blue, padding: 24)
        .accessibilityElement(children: .combine)
    }

    private func ring<Content: View>(progress: Double, @ViewBuilder center: () -> Content) -> some View {
        ZStack {
            Circle().stroke(Palette.field, lineWidth: 14)
            Circle()
                .trim(from: 0, to: min(max(progress, 0), 1))
                .stroke(Palette.blue, style: StrokeStyle(lineWidth: 14, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.linear(duration: 0.5), value: progress)
            center()
        }
        .frame(width: 232, height: 232)
        .padding(7)
    }

    @ViewBuilder
    private func upcomingList(_ slots: [ScheduleSlot], isSchoolDay: Bool, day: Int) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel(title: isSchoolDay ? "Up next" : "\(Self.dayNames[day])'s classes")
            if slots.isEmpty {
                Text("No more classes today").font(.subheadline).foregroundStyle(Palette.textDim)
                    .frame(maxWidth: .infinity, alignment: .leading).card()
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(slots.enumerated()), id: \.offset) { i, s in
                        UpcomingRow(slot: s, time: Self.time(s.startMinutes))
                        if i < slots.count - 1 { RowDivider().padding(.leading, Layout.card) }
                    }
                }
                .card(padding: 0)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 24)
    }

    static func time(_ minutes: Int) -> String {
        let h = minutes / 60
        return "\((h + 11) % 12 + 1):\(String(format: "%02d", minutes % 60)) \(h < 12 ? "AM" : "PM")"
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

private struct UpcomingRow: View {
    let slot: ScheduleSlot
    let time: String

    private var detail: String {
        [slot.entry.room.map { "Room \($0)" }, slot.entry.teacher].compactMap { $0 }.joined(separator: " · ")
    }

    var body: some View {
        HStack(spacing: 12) {
            PeriodBadge(period: slot.entry.period)
            VStack(alignment: .leading, spacing: 3) {
                Text(slot.entry.courseName).font(.body.weight(.semibold)).foregroundStyle(Palette.text).lineLimit(1)
                if !detail.isEmpty {
                    Text(detail).font(.footnote).foregroundStyle(Palette.textDim).lineLimit(1)
                }
            }
            Spacer(minLength: 8)
            Text(time).font(.subheadline.weight(.semibold)).monospacedDigit().foregroundStyle(Palette.blue).fixedSize()
        }
        .padding(.horizontal, Layout.card)
        .frame(minHeight: 64)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Period \(slot.entry.period), \(slot.entry.courseName), \(time)")
    }
}
