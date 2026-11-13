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

/// Deep navy-charcoal surfaces with two flat accents (no gradients anywhere): tan (identity: titles, selection, primary actions) and blue
/// (time and information: the countdown, periods, hints). Green / yellow / red stay reserved for grades, seats and status.
enum Palette {
    // Surfaces, darkest first. Slightly blue so the tan reads warm against them.
    static let bg = Color(hex: 0x0A0D12)
    static let bar = Color(hex: 0x0D1118)
    static let surface = Color(hex: 0x131821)
    static let field = Color(hex: 0x19202B)
    static let elevated = Color(hex: 0x1D2531)
    static let border = Color(hex: 0x252D3A)
    static let borderStrong = Color(hex: 0x3B4658)

    // Text: warm ivory, not pure white.
    static let text = Color(hex: 0xF3EEE6)
    static let textDim = Color(hex: 0xAEA9A0)
    static let textFaint = Color(hex: 0x858279)

    // Accents.
    static let tan = Color(hex: 0xD8B98A)
    static let blue = Color(hex: 0x7FB2E8)

    /// Default emphasis for links, selection and spinners.
    static let tint = tan
    /// Primary button fill and its label.
    static let action = tan
    static let actionInk = Color(hex: 0x14110B)

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

    /// The one accented card per screen: a flat surface with a solid `tint` edge and outline. No gradients.
    func heroCard(_ tint: Color = Palette.tan, padding: CGFloat = 20) -> some View {
        let shape = RoundedRectangle(cornerRadius: Layout.radius + 4, style: .continuous)
        return self
            .padding(padding)
            .background(shape.fill(Palette.surface))
            .overlay(alignment: .leading) { Rectangle().fill(tint).frame(width: 3) }
            .overlay(shape.strokeBorder(tint.opacity(0.35), lineWidth: 1))
            .clipShape(shape)
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
            .foregroundStyle(Palette.tan)
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

/// Square blue badge for a period number ("2") or short period name ("Access").
struct PeriodBadge: View {
    let period: String?

    var body: some View {
        Text(period.map { $0.count > 3 ? String($0.prefix(1)) : $0 } ?? "–")
            .font(.subheadline.weight(.bold)).monospacedDigit()
            .foregroundStyle(Palette.blue)
            .lineLimit(1).minimumScaleFactor(0.6)
            .frame(width: 36, height: 36)
            .background(RoundedRectangle(cornerRadius: 9, style: .continuous).fill(Palette.blue.opacity(0.14)))
            .accessibilityHidden(true)
    }
}

/// The small "more" control on rows. Quiet on purpose: it is a secondary action.
struct MoreGlyph: View {
    var body: some View {
        Image(systemName: "ellipsis")
            .font(.caption2.weight(.bold))
            .foregroundStyle(Palette.textFaint)
            .frame(width: 28, height: 36)
            .contentShape(Rectangle())
    }
}

struct GradeBar: View {
    let percent: Double
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Palette.field)
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
    var color: Color = Palette.text

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title3.weight(.semibold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .foregroundStyle(color)
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
