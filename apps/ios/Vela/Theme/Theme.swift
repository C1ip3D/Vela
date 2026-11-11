import SwiftUI

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}

/// Palette carried over from apps/mobile/tailwind.config.js.
enum Palette {
    static let void = Color(hex: 0x03060D)
    static let deep = Color(hex: 0x070B16)
    static let mid = Color(hex: 0x0C1220)
    static let surface = Color(hex: 0x101828)
    static let elevated = Color(hex: 0x162032)
    static let border = Color(hex: 0x1C2A45)
    static let borderLit = Color(hex: 0x253A5E)

    static let vela300 = Color(hex: 0xA5B4FC)
    static let vela400 = Color(hex: 0x818CF8)

    static let starBright = Color(hex: 0xE8ECFF)
    static let starWhite = Color(hex: 0xD4DAF0)
    static let starDim = Color(hex: 0x8B98B8)
    static let starFaint = Color(hex: 0x4A5578)

    static let accent = Color(hex: 0xE879F9)
    static let accentInk = Color(hex: 0x0C1220)
    static let emerald = Color(hex: 0x34D399)
    static let amber = Color(hex: 0xFBBF24)
    static let rose = Color(hex: 0xF87171)

    static func grade(letter: String) -> Color {
        if letter.hasPrefix("A") { return Color(hex: 0x34D399) }
        if letter.hasPrefix("B") { return Color(hex: 0xA7F3D0) }
        if letter.hasPrefix("C") { return Color(hex: 0xFACC15) }
        return Color(hex: 0xEF4444)
    }

    static func grade(percent: Double) -> Color {
        grade(letter: percent >= 90 ? "A" : percent >= 80 ? "B" : percent >= 70 ? "C" : "F")
    }
}

struct CardBackground: ViewModifier {
    var highlighted = false
    var padding: CGFloat = 18

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(highlighted ? Palette.vela400.opacity(0.1) : Palette.surface.opacity(0.5))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(highlighted ? Palette.vela400.opacity(0.4) : Palette.border, lineWidth: 1)
            )
    }
}

extension View {
    func card(highlighted: Bool = false, padding: CGFloat = 18) -> some View {
        modifier(CardBackground(highlighted: highlighted, padding: padding))
    }

    /// Full-screen app background.
    func velaBackground() -> some View {
        background(Palette.void.ignoresSafeArea())
    }
}

struct SectionLabel: View {
    let title: String
    var body: some View {
        Text(title.uppercased())
            .font(.footnote.weight(.semibold))
            .tracking(1.6)
            .foregroundStyle(Palette.vela300)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityAddTraits(.isHeader)
    }
}

struct GradeBar: View {
    let percent: Double
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Palette.border)
                Capsule()
                    .fill(Palette.grade(percent: percent))
                    .frame(width: geo.size.width * min(max(percent, 0), 100) / 100)
            }
        }
        .frame(height: 4)
        .accessibilityHidden(true)
    }
}

struct StatCard: View {
    let systemImage: String
    let value: String
    let label: String
    var warn = false

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.subheadline)
                .foregroundStyle(warn ? Palette.amber : Palette.starFaint)
            Text(value)
                .font(.title2.weight(.bold))
                .monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.7)
                .foregroundStyle(warn ? Palette.amber : Palette.starBright)
            Text(label)
                .font(.caption)
                .foregroundStyle(Palette.starDim)
        }
        .frame(maxWidth: .infinity)
        .card(padding: 14)
        .accessibilityElement(children: .combine)
    }
}

struct ErrorBanner: View {
    let message: String
    var body: some View {
        Text(message)
            .font(.subheadline)
            .foregroundStyle(Palette.rose)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(RoundedRectangle(cornerRadius: 14).fill(Color.red.opacity(0.1)))
            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.red.opacity(0.25)))
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(Palette.accentInk)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.accent))
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}
