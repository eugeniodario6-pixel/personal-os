// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "HealthKitPlugin",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "HealthKitPlugin", targets: ["HealthKitPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.0")
    ],
    targets: [
        .target(
            name: "HealthKitPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "Sources/HealthKitPlugin"
        )
    ]
)
