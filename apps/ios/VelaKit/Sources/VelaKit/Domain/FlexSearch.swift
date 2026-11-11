import Foundation

/// The teacher's last name from Infinite Campus's `teacherDisplay`, which is "Last, First" in most districts and
/// "First Last" in some. Suffixes like "Jr." are skipped in the second form.
public func teacherLastName(_ teacher: String?) -> String? {
    guard let teacher else { return nil }
    let trimmed = teacher.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return nil }
    if let comma = trimmed.firstIndex(of: ",") {
        let last = trimmed[..<comma].trimmingCharacters(in: .whitespaces)
        return last.isEmpty ? nil : last
    }
    let suffixes: Set<String> = ["jr", "jr.", "sr", "sr.", "ii", "iii", "iv"]
    let words = trimmed.split(whereSeparator: \.isWhitespace).map(String.init)
    return words.last { !suffixes.contains($0.lowercased()) } ?? words.last
}

/// Offerings matching `query`, best match first: teacher's last name starting with the query, then any other part of
/// the teacher's name, then the session name or room. Ties keep the incoming order. An empty query returns everything.
public func searchOfferings(_ offerings: [ICResponsiveOffering], query: String) -> [ICResponsiveOffering] {
    let needle = fold(query.trimmingCharacters(in: .whitespacesAndNewlines))
    if needle.isEmpty { return offerings }

    func rank(_ o: ICResponsiveOffering) -> Int? {
        if let last = teacherLastName(o.teacher), fold(last).hasPrefix(needle) { return 0 }
        if let teacher = o.teacher, fold(teacher).contains(needle) { return 1 }
        if fold(o.name).contains(needle) || (o.room.map { fold($0).contains(needle) } ?? false) { return 2 }
        return nil
    }

    return offerings.enumerated()
        .compactMap { i, o in rank(o).map { (rank: $0, index: i, offering: o) } }
        .sorted { $0.rank != $1.rank ? $0.rank < $1.rank : $0.index < $1.index }
        .map(\.offering)
}

/// Case- and accent-insensitive form, so "pena" finds "Peña".
private func fold(_ s: String) -> String {
    s.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil)
}
