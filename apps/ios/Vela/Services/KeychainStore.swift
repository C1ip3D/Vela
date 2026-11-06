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
        SecItemAdd(q as CFDictionary, nil)
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

/// Non-secret cached values (last district, schedule cache).
enum Persistence {
    static func save<T: Encodable>(_ value: T, for key: String) {
        if let data = try? JSONEncoder().encode(value) { UserDefaults.standard.set(data, forKey: key) }
    }

    static func load<T: Decodable>(_ type: T.Type, for key: String) -> T? {
        UserDefaults.standard.data(forKey: key).flatMap { try? JSONDecoder().decode(type, from: $0) }
    }

    static func remove(_ key: String) {
        UserDefaults.standard.removeObject(forKey: key)
    }
}
