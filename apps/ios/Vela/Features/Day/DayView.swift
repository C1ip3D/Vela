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
                    Text(now.formatted(.dateTime.weekday(.wide).month(.wide).day().year()))
                        .font(.title3.weight(.medium)).foregroundStyle(Palette.textDim)
                        .padding(.top, 8)
                    hero(status: status, slots: slots, isSchoolDay: isSchoolDay, now: now, tz: tz, day: day)
                    if bells.isEmpty {
                        Text("No bell times for your district yet, so classes can't be timed.")
                            .font(.footnote).foregroundStyle(Palette.warn).padding(.top, 16)
                    }
                    upcomingList(upcoming, isSchoolDay: isSchoolDay, day: day)
                }
                .padding(.horizontal, Layout.screen)
                .padding(.bottom, 100)
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

        VStack(spacing: 20) {
            if let (title, caption, left, total, range) = model {
                Text(title)
                    .font(.system(size: 32, weight: .bold)).foregroundStyle(Palette.text)
                    .multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.7)
                ring(progress: Double(left) / Double(total)) {
                    VStack(spacing: 4) {
                        Text(String(format: "%02d:%02d", left / 60, left % 60))
                            .font(.system(size: 54, weight: .bold)).monospacedDigit()
                            .foregroundStyle(Palette.text)
                        Text(caption).font(.subheadline).foregroundStyle(Palette.textDim)
                    }
                }
                Text(range).font(.title3.weight(.medium)).foregroundStyle(Palette.textDim).monospacedDigit()
            } else {
                Text(isSchoolDay ? (status?.state == .after ? "School's out" : "No classes right now") : "No school today")
                    .font(.system(size: 32, weight: .bold)).foregroundStyle(Palette.text)
                ring(progress: 0) {
                    Image(systemName: isSchoolDay ? "checkmark" : "moon.zzz")
                        .font(.system(size: 44, weight: .semibold)).foregroundStyle(Palette.textFaint)
                }
                if !isSchoolDay {
                    Text("Showing \(Self.dayNames[day])").font(.title3).foregroundStyle(Palette.textDim)
                }
            }
        }
        .padding(.top, 24)
        .accessibilityElement(children: .combine)
    }

    private func ring<Content: View>(progress: Double, @ViewBuilder center: () -> Content) -> some View {
        ZStack {
            Circle().stroke(Palette.border, lineWidth: 12)
            Circle()
                .trim(from: 0, to: min(max(progress, 0), 1))
                .stroke(Palette.tint, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.linear(duration: 0.5), value: progress)
            center()
        }
        .frame(width: 260, height: 260)
    }

    @ViewBuilder
    private func upcomingList(_ slots: [ScheduleSlot], isSchoolDay: Bool, day: Int) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(isSchoolDay ? "Upcoming Classes" : "\(Self.dayNames[day])'s Classes")
                .font(.title3.weight(.semibold)).foregroundStyle(Palette.text)
                .accessibilityAddTraits(.isHeader)
            if slots.isEmpty {
                Text("No more classes today").font(.subheadline).foregroundStyle(Palette.textDim).padding(.top, 8)
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
        .padding(.top, 36)
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
        let e = slot.entry
        var parts = [e.period.allSatisfy(\.isNumber) ? "Period \(e.period)" : e.period]
        if let room = e.room { parts.append("Room \(room)") }
        if let teacher = e.teacher { parts.append(teacher) }
        return parts.joined(separator: " · ")
    }

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(slot.entry.courseName).font(.title3.weight(.semibold)).foregroundStyle(Palette.text).lineLimit(1)
                Text(detail).font(.subheadline).foregroundStyle(Palette.textDim).lineLimit(1)
            }
            Spacer(minLength: 8)
            Text(time).font(.title3.weight(.medium)).monospacedDigit().foregroundStyle(Palette.text)
        }
        .padding(.horizontal, Layout.card)
        .frame(minHeight: 72)
        .accessibilityElement(children: .combine)
    }
}
