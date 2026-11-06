import Foundation

/// A dynamically-typed JSON value that preserves object key order.
///
/// Infinite Campus returns differently-shaped JSON per district and IC
/// version, and the parsers hunt through it recursively (see `Parsers`).
/// This type gives them JavaScript-like loose access: missing keys and
/// type mismatches yield `.null` rather than throwing, and `??` falls
/// through on `.null` the way JS falls through on null/undefined.
public enum JSON: Equatable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSON])
    case object(JSONObject)

    public struct JSONObject: Equatable, Sendable {
        public private(set) var keys: [String] = []
        private var storage: [String: JSON] = [:]

        public init() {}

        public subscript(key: String) -> JSON? {
            get { storage[key] }
            set {
                if let newValue {
                    if storage[key] == nil { keys.append(key) }
                    storage[key] = newValue
                } else if storage.removeValue(forKey: key) != nil {
                    keys.removeAll { $0 == key }
                }
            }
        }
    }

    // MARK: Access

    public subscript(key: String) -> JSON {
        if case .object(let o) = self { return o[key] ?? .null }
        return .null
    }

    public subscript(index: Int) -> JSON {
        if case .array(let a) = self, a.indices.contains(index) { return a[index] }
        return .null
    }

    public var isNull: Bool { if case .null = self { return true } else { return false } }
    public var array: [JSON]? { if case .array(let a) = self { return a } else { return nil } }
    public var object: JSONObject? { if case .object(let o) = self { return o } else { return nil } }
    public var isArray: Bool { array != nil }
    public var isObject: Bool { object != nil }

    /// The string, only when this really is a JSON string.
    public var string: String? { if case .string(let s) = self { return s } else { return nil } }

    /// JS `Boolean(x)`.
    public var truthy: Bool {
        switch self {
        case .null: return false
        case .bool(let b): return b
        case .number(let n): return n != 0 && !n.isNaN
        case .string(let s): return !s.isEmpty
        case .array, .object: return true
        }
    }

    /// JS `Number(x)` restricted to numbers and numeric strings; nil where JS gives NaN.
    public var number: Double? {
        switch self {
        case .number(let n): return n.isNaN ? nil : n
        case .string(let s):
            let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
            if t.isEmpty { return nil }
            return Double(t)
        case .bool(let b): return b ? 1 : 0
        default: return nil
        }
    }

    /// JS `parseFloat(x)`: numbers pass through, strings use their numeric prefix.
    public var parsedFloat: Double? {
        switch self {
        case .number(let n): return n.isNaN ? nil : n
        case .string(let s): return JSON.numericPrefix(s)
        default: return nil
        }
    }

    /// `parseFloat(x ?? 0) || 0` — the idiom used for weights and point totals.
    public var floatOrZero: Double {
        let v = parsedFloat ?? 0
        return v.isFinite ? v : 0
    }

    /// JS `String(x)` for non-null scalars; nil for null/array/object.
    public var stringified: String? {
        switch self {
        case .string(let s): return s
        case .number(let n):
            if n == n.rounded(), abs(n) < 1e15 { return String(Int64(n)) }
            return String(n)
        case .bool(let b): return b ? "true" : "false"
        default: return nil
        }
    }

    private static func numericPrefix(_ s: String) -> Double? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        var end = t.startIndex
        var seenDigit = false, seenDot = false, seenExp = false
        var i = t.startIndex
        if i < t.endIndex, t[i] == "+" || t[i] == "-" { i = t.index(after: i) }
        while i < t.endIndex {
            let c = t[i]
            if c.isASCII, c.isNumber { seenDigit = true; end = t.index(after: i) }
            else if c == ".", !seenDot, !seenExp { seenDot = true }
            else if (c == "e" || c == "E"), seenDigit, !seenExp {
                seenExp = true
                let n = t.index(after: i)
                if n < t.endIndex, t[n] == "+" || t[n] == "-" { i = n }
            } else { break }
            i = t.index(after: i)
        }
        guard seenDigit else { return nil }
        return Double(t[t.startIndex..<end])
    }

    // MARK: Parsing

    public init(data: Data) throws {
        var p = Parser(bytes: [UInt8](data))
        p.skipWhitespace()
        self = try p.parseValue()
        p.skipWhitespace()
        if p.index != p.bytes.count { throw ParseError.trailingData }
    }

    public enum ParseError: Error { case unexpected, trailingData }

    private struct Parser {
        let bytes: [UInt8]
        var index = 0

        mutating func skipWhitespace() {
            while index < bytes.count, [0x20, 0x09, 0x0A, 0x0D].contains(bytes[index]) { index += 1 }
        }

        mutating func parseValue() throws -> JSON {
            guard index < bytes.count else { throw ParseError.unexpected }
            switch bytes[index] {
            case UInt8(ascii: "{"): return try parseObject()
            case UInt8(ascii: "["): return try parseArray()
            case UInt8(ascii: "\""): return .string(try parseString())
            case UInt8(ascii: "t"): try expect("true"); return .bool(true)
            case UInt8(ascii: "f"): try expect("false"); return .bool(false)
            case UInt8(ascii: "n"): try expect("null"); return .null
            default: return try parseNumber()
            }
        }

        mutating func expect(_ word: String) throws {
            let w = Array(word.utf8)
            guard index + w.count <= bytes.count, Array(bytes[index..<index + w.count]) == w else {
                throw ParseError.unexpected
            }
            index += w.count
        }

        mutating func parseNumber() throws -> JSON {
            let start = index
            while index < bytes.count, "+-0123456789.eE".utf8.contains(bytes[index]) { index += 1 }
            guard index > start,
                  let s = String(bytes: bytes[start..<index], encoding: .utf8),
                  let d = Double(s) else { throw ParseError.unexpected }
            return .number(d)
        }

        mutating func parseString() throws -> String {
            index += 1 // opening quote
            var out = [UInt8]()
            while index < bytes.count {
                let b = bytes[index]
                if b == UInt8(ascii: "\"") {
                    index += 1
                    return String(decoding: out, as: UTF8.self)
                }
                if b == UInt8(ascii: "\\") {
                    index += 1
                    guard index < bytes.count else { throw ParseError.unexpected }
                    let e = bytes[index]
                    switch e {
                    case UInt8(ascii: "n"): out.append(0x0A)
                    case UInt8(ascii: "t"): out.append(0x09)
                    case UInt8(ascii: "r"): out.append(0x0D)
                    case UInt8(ascii: "b"): out.append(0x08)
                    case UInt8(ascii: "f"): out.append(0x0C)
                    case UInt8(ascii: "u"):
                        var scalar = try hex4()
                        if (0xD800...0xDBFF).contains(scalar),
                           index + 2 < bytes.count, bytes[index + 1] == UInt8(ascii: "\\"),
                           bytes[index + 2] == UInt8(ascii: "u") {
                            index += 2
                            let low = try hex4()
                            scalar = 0x10000 + ((scalar - 0xD800) << 10) + (low - 0xDC00)
                        }
                        let u = Unicode.Scalar(scalar) ?? "\u{FFFD}"
                        out.append(contentsOf: Array(String(Character(u)).utf8))
                    default: out.append(e)
                    }
                    index += 1
                } else {
                    out.append(b)
                    index += 1
                }
            }
            throw ParseError.unexpected
        }

        /// Reads the 4 hex digits after `\u`; leaves `index` on the last digit.
        mutating func hex4() throws -> UInt32 {
            guard index + 4 < bytes.count,
                  let s = String(bytes: bytes[(index + 1)...(index + 4)], encoding: .utf8),
                  let v = UInt32(s, radix: 16) else { throw ParseError.unexpected }
            index += 4
            return v
        }

        mutating func parseArray() throws -> JSON {
            index += 1
            var items = [JSON]()
            skipWhitespace()
            if index < bytes.count, bytes[index] == UInt8(ascii: "]") { index += 1; return .array(items) }
            while true {
                skipWhitespace()
                items.append(try parseValue())
                skipWhitespace()
                guard index < bytes.count else { throw ParseError.unexpected }
                if bytes[index] == UInt8(ascii: ",") { index += 1; continue }
                if bytes[index] == UInt8(ascii: "]") { index += 1; return .array(items) }
                throw ParseError.unexpected
            }
        }

        mutating func parseObject() throws -> JSON {
            index += 1
            var obj = JSONObject()
            skipWhitespace()
            if index < bytes.count, bytes[index] == UInt8(ascii: "}") { index += 1; return .object(obj) }
            while true {
                skipWhitespace()
                guard index < bytes.count, bytes[index] == UInt8(ascii: "\"") else { throw ParseError.unexpected }
                let key = try parseString()
                skipWhitespace()
                guard index < bytes.count, bytes[index] == UInt8(ascii: ":") else { throw ParseError.unexpected }
                index += 1
                skipWhitespace()
                obj[key] = try parseValue()
                skipWhitespace()
                guard index < bytes.count else { throw ParseError.unexpected }
                if bytes[index] == UInt8(ascii: ",") { index += 1; continue }
                if bytes[index] == UInt8(ascii: "}") { index += 1; return .object(obj) }
                throw ParseError.unexpected
            }
        }
    }
}

/// JS-style `a ?? b` for JSON: falls through only on `.null` (null/undefined).
public func ?? (lhs: JSON, rhs: @autoclosure () -> JSON) -> JSON {
    lhs.isNull ? rhs() : lhs
}
