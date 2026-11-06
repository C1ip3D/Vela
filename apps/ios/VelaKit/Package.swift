// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "VelaKit",
    platforms: [.iOS(.v18), .macOS(.v15)],
    products: [
        .library(name: "VelaKit", targets: ["VelaKit"]),
    ],
    targets: [
        .target(name: "VelaKit"),
        .testTarget(
            name: "VelaKitTests",
            dependencies: ["VelaKit"],
            resources: [.copy("Fixtures")]
        ),
    ],
    swiftLanguageModes: [.v5]
)
