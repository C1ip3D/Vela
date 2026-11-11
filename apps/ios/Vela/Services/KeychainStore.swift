import Foundation
import Security

/// Minimal Keychain wrapper for the persisted IC session (cookies are credentials).
enum KeychainStore {
    private static let service = "com.avaneesh.vela"

    private static func query(_ key: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: key]
    }

    static func save(_ data: Data, for key: String) {
        SecItemDelete(query(key) as CFDictionary)
        var q = query(key)
        q[kSecValueData as String] = data
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(q as CFDictionary, nil)
        if status != errSecSuccess { NSLog("[keychain] save %@ failed: %d", key, status) }
    }

    static func load(_ key: String) -> Data? {
        var q = query(key)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess else { return nil }
        return out as? Data
    }

    static func delete(_ key: String) {
        SecItemDelete(query(key) as CFDictionary)
    }

    static func save<T: Encodable>(_ value: T, for key: String) {
        if let data = try? JSONEncoder().encode(value) { save(data, for: key) }
    }

    static func load<T: Decodable>(_ type: T.Type, for key: String) -> T? {
        load(key).flatMap { try? JSONDecoder().decode(type, from: $0) }
    }
}

/// Cached values (last district, grades, schedule, bells). Grades are a student's records, so they live in files with
/// data protection (encrypted while the device is locked) rather than plain UserDefaults.
enum Persistence {
    private static func url(_ key: String) -> URL? {
        guard let dir = try? FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true) else { return nil }
        return dir.appendingPathComponent("\(key).json")
    }

    static func save<T: Encodable>(_ value: T, for key: String) {
        guard let data = try? JSONEncoder().encode(value), let url = url(key) else { return }
        try? data.write(to: url, options: [.atomic, .completeFileProtection])
        UserDefaults.standard.removeObject(forKey: key) // drop any copy from before this moved to files
    }

    static func load<T: Decodable>(_ type: T.Type, for key: String) -> T? {
        if let url = url(key), let data = try? Data(contentsOf: url), let v = try? JSONDecoder().decode(type, from: data) { return v }
        return UserDefaults.standard.data(forKey: key).flatMap { try? JSONDecoder().decode(type, from: $0) }
    }

    static func remove(_ key: String) {
        if let url = url(key) { try? FileManager.default.removeItem(at: url) }
        UserDefaults.standard.removeObject(forKey: key)
    }
}
