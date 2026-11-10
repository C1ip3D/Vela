import SwiftUI
import VelaKit

/// Pick a weekday and edit that day's period times. Port of BellTimesSettings.tsx.
struct BellTimesView: View {
    @Environment(AppModel.self) private var model
    @State private var day: Int

    private static let days: [(day: Int, label: String)] = [(1, "Mon"), (2, "Tue"), (3, "Wed"), (4, "Thu"), (5, "Fri")]

    init() {
        let today = Calendar.current.component(.weekday, from: Date()) - 1
        _day = State(initialValue: (1...5).contains(today) ? today : 1)
    }

    /// Periods this student has on `day`, in bell order (those without a time last).
    private var periods: [String] {
        let variant = pickBellSchedule(model.bells, day: day)
        let start: (String) -> Int = { p in
            variant?.periods.first { $0.period == p }.flatMap { parseClockTime($0.start) } ?? .max
        }
        var seen = Set<String>()
        return entriesForDay(model.scheduleEntries, day: day).map(\.period)
            .filter { seen.insert($0).inserted }
            .sorted { start($0) != start($1) ? start($0) < start($1) : periodSort($0, $1) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Layout.gap) {
                Picker("Day", selection: $day) {
                    ForEach(Self.days, id: \.day) { Text($0.label).tag($0.day) }
                }
                .pickerStyle(.segmented)

                if periods.isEmpty {
                    EmptyState(systemImage: "clock", message: "Load your schedule on the Today tab first.").card()
                } else {
                    BellEditor(day: day, periods: periods).id(day)
                }
            }
            .padding(Layout.screen)
        }
        .scrollDismissesKeyboard(.interactively)
        .velaBackground()
        .navigationTitle("Bell times")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct BellEditor: View {
    @Environment(AppModel.self) private var model
    let day: Int
    let periods: [String]

    @State private var draft: [String: (start: String, end: String)] = [:]
    @State private var message: (text: String, ok: Bool)?
    @State private var saving = false

    private var variant: BellSchedule? { pickBellSchedule(model.bells, day: day) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let variant { Text(variant.name).font(.headline).foregroundStyle(Palette.text) }
            Text(model.usingPresetBells
                 ? "Prefilled from your school's published schedule. Edit if wrong; applies to every day sharing it."
                 : "Infinite Campus doesn't provide period times. Enter e.g. 8:30 AM.")
                .font(.footnote).foregroundStyle(Palette.textDim)

            ForEach(periods, id: \.self) { p in
                HStack(spacing: 8) {
                    Text(p.allSatisfy(\.isNumber) ? "Period \(p)" : p)
                        .font(.subheadline).foregroundStyle(Palette.text)
                        .lineLimit(1).minimumScaleFactor(0.8).frame(width: 72, alignment: .leading)
                    field("8:30 AM", text: binding(p, \.start), label: "Period \(p) start")
                    Text("to").font(.footnote).foregroundStyle(Palette.textFaint)
                    field("9:20 AM", text: binding(p, \.end), label: "Period \(p) end")
                }
            }

            if let message {
                Text(message.text).font(.footnote).foregroundStyle(message.ok ? Palette.good : Palette.bad)
            }
            Button(saving ? "Saving…" : "Save", action: save)
                .buttonStyle(PrimaryButtonStyle())
                .disabled(saving)
                .padding(.top, 4)
        }
        .card()
        .onAppear(perform: loadDraft)
    }

    private func field(_ placeholder: String, text: Binding<String>, label: String) -> some View {
        TextField(placeholder, text: text)
            .textInputAutocapitalization(.characters)
            .autocorrectionDisabled()
            .keyboardType(.numbersAndPunctuation)
            .multilineTextAlignment(.center)
            .font(.subheadline).monospacedDigit()
            .foregroundStyle(Palette.text)
            .padding(.horizontal, 6)
            .frame(maxWidth: .infinity)
            .fieldChrome()
            .onChange(of: text.wrappedValue) { _, new in if new.count > 8 { text.wrappedValue = String(new.prefix(8)) } }
            .accessibilityLabel(label)
    }

    private func binding(_ p: String, _ key: WritableKeyPath<(start: String, end: String), String>) -> Binding<String> {
        Binding(
            get: { draft[p]?[keyPath: key] ?? "" },
            set: { v in
                var d = draft[p] ?? (start: "", end: "")
                d[keyPath: key] = v
                draft[p] = d
            })
    }

    private func loadDraft() {
        for p in periods {
            let bp = variant?.periods.first { $0.period == p }
            draft[p] = (start: bp.map { formatClock12($0.start) } ?? "", end: bp.map { formatClock12($0.end) } ?? "")
        }
    }

    private func save() {
        message = nil
        var times: [BellPeriod] = []
        for p in periods {
            let d = draft[p] ?? (start: "", end: "")
            if d.start.trimmingCharacters(in: .whitespaces).isEmpty && d.end.trimmingCharacters(in: .whitespaces).isEmpty { continue }
            guard let s = normalizeClockInput(d.start), let e = normalizeClockInput(d.end),
                  let sm = parseClockTime(s), let em = parseClockTime(e), sm < em else {
                message = ("Period \(p): use a time like 1:17 PM and make end after start", false)
                return
            }
            times.append(BellPeriod(period: p, start: s, end: e))
        }
        saving = true
        Task {
            let result = await model.saveBells(upsertPeriodTimes(model.bells, day: day, times: times))
            saving = false
            message = result == .synced ? ("Saved", true) : ("Saved on this device only (couldn't reach Vela)", false)
        }
    }
}
