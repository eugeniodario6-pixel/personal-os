import UIKit
import Capacitor
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        let bridgeVC = CAPBridgeViewController()
        // Allow WebView to access microphone for Veronica voice input
        bridgeVC.webView?.configuration.allowsAirPlayForMediaPlayback = true
        if #available(iOS 15.0, *) {
            bridgeVC.webView?.configuration.upgradeKnownHostsToHTTPS = false
        }
        window?.rootViewController = bridgeVC
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        // Lock on launch and every foreground — window is guaranteed ready here
        FaceIDLock.shared.lock(in: window)
    }

    func sceneWillResignActive(_ scene: UIScene) {
        // Reset so it re-locks next foreground
        FaceIDLock.shared.reset()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
