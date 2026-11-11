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

/// Black-and-gray palette. Colour is reserved for meaning: green / yellow / red for grades, seats and status.
enum Palette {
    // Surfaces, darkest first.
    static let bg = Color(hex: 0x000000)
    static let bar = Color(hex: 0x0A0A0A)
    static let surface = Color(hex: 0x111111)
    static let field = Color(hex: 0x171717)
    static let elevated = Color(hex: 0x1C1C1C)
    static let border = Color(hex: 0x262626)
    static let borderStrong = Color(hex: 0x3A3A3A)

    // Text.
    static let text = Color(hex: 0xF5F5F5)
    static let textDim = Color(hex: 0xA3A3A3)
    static let textFaint = Color(hex: 0x7A7A7A)

    /// Neutral emphasis (selection, links, spinners). Deliberately not a hue.
    static let tint = Color(hex: 0xE5E5E5)
    /// Primary button fill and its label.
    static let action = Color(hex: 0xF5F5F5)
    static let actionInk = Color(hex: 0x0A0A0A)

    // Semantic colours.
    static let good = Color(hex: 0x34D399)
    static let warn = Color(hex: 0xFBBF24)
    static let bad = Color(hex: 0xF87171)

    static func grade(letter: String) -> Color {
        if letter.hasPrefix("A") { return good }
        if letter.hasPrefix("B") { return Color(hex: 0xA3E635) }
        if letter.hasPrefix("C") { return warn }
        return bad
    }

    static func grade(percent: Double) -> Color {
        grade(letter: percent >= 90 ? "A" : percent >= 80 ? "B" : percent >= 70 ? "C" : "F")
    }
}

/// One spacing and corner scale for every screen, so cards, rows and sheets line up.
enum Layout {
    /// Horizontal inset of screen content.
    static let screen: CGFloat = 16
    /// Gap between cards.
    static let gap: CGFloat = 12
    /// Inner padding of a card.
    static let card: CGFloat = 16
    static let radius: CGFloat = 14
    static let fieldRadius: CGFloat = 10
    /// Minimum height of a tappable row or control.
    static let row: CGFloat = 44
}

struct CardBackground: ViewModifier {
    var highlighted = false
    var padding: CGFloat = Layout.card

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: Layout.radius, style: .continuous)
                    .fill(highlighted ? Palette.elevated : Palette.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Layout.radius, style: .continuous)
                    .strokeBorder(highlighted ? Palette.borderStrong : Palette.border, lineWidth: 1)
            )
            // Rows inside a padding-0 card paint their own backgrounds; keep them inside the rounded corners.
            .clipShape(RoundedRectangle(cornerRadius: Layout.radius, style: .continuous))
    }
}

extension View {
    func card(highlighted: Bool = false, padding: CGFloat = Layout.card) -> some View {
        modifier(CardBackground(highlighted: highlighted, padding: padding))
    }

    /// Full-screen app background.
    func velaBackground() -> some View {
        background(Palette.bg.ignoresSafeArea())
    }

    /// Text field / picker chrome shared by every input in the app.
    func fieldChrome(height: CGFloat = Layout.row) -> some View {
        frame(minHeight: height)
            .background(RoundedRectangle(cornerRadius: Layout.fieldRadius, style: .continuous).fill(Palette.field))
            .overlay(RoundedRectangle(cornerRadius: Layout.fieldRadius, style: .continuous).strokeBorder(Palette.border))
    }

    /// Same detents and chrome for every sheet, so they all open at the same size.
    func velaSheet() -> some View {
        presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
            .presentationCornerRadius(20)
            .presentationBackground(Palette.bar)
            .preferredColorScheme(.dark)
    }
}

/// Hairline between rows inside a card.
struct RowDivider: View {
    var body: some View {
        Rectangle().fill(Palette.border).frame(height: 1).accessibilityHidden(true)
    }
}

struct SectionLabel: View {
    let title: String
    var body: some View {
        Text(title.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .foregroundStyle(Palette.textFaint)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityAddTraits(.isHeader)
    }
}

/// Small rounded label (Missing, Late, Closed, Now…).
struct Pill: View {
    let text: String
    var color: Color = Palette.textDim

    var body: some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(color)
            .lineLimit(1)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(Capsule().fill(color.opacity(0.14)))
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
    let value: String
    let label: String
    var warn = false

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title3.weight(.semibold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .foregroundStyle(warn ? Palette.warn : Palette.text)
            Text(label)
                .font(.caption)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .foregroundStyle(Palette.textDim)
        }
        .frame(maxWidth: .infinity, minHeight: 48)
        .card(padding: 12)
        .accessibilityElement(children: .combine)
    }
}

struct ErrorBanner: View {
    let message: String
    var body: some View {
        Text(message)
            .font(.subheadline)
            .foregroundStyle(Palette.bad)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(RoundedRectangle(cornerRadius: Layout.radius, style: .continuous).fill(Palette.bad.opacity(0.1)))
            .overlay(RoundedRectangle(cornerRadius: Layout.radius, style: .continuous).strokeBorder(Palette.bad.opacity(0.25)))
    }
}

/// Centered icon + message used for empty and failed states.
struct EmptyState: View {
    let systemImage: String
    let message: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage).font(.title).foregroundStyle(Palette.textFaint)
            Text(message).font(.subheadline).foregroundStyle(Palette.textDim).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(Palette.actionInk)
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(RoundedRectangle(cornerRadius: Layout.radius, style: .continuous).fill(Palette.action))
            .opacity(!isEnabled ? 0.5 : configuration.isPressed ? 0.8 : 1)
    }
}
