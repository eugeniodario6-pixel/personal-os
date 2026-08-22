import UIKit
import Capacitor
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        let bridgeVC = CAPBridgeViewController()
        // Register message handlers so JS can trigger native speech
        let appDelegate = UIApplication.shared.delegate as? AppDelegate
        if let wv = bridgeVC.webView {
            wv.configuration.userContentController.add(
                SpeechMessageHandler(appDelegate: appDelegate), name: "startSpeech"
            )
            wv.configuration.userContentController.add(
                StopSpeechMessageHandler(appDelegate: appDelegate), name: "stopSpeech"
            )
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

}

// ── Speech message handlers ───────────────────────────────────────────────────
import WebKit

class SpeechMessageHandler: NSObject, WKScriptMessageHandler {
    weak var appDelegate: AppDelegate?
    init(appDelegate: AppDelegate?) { self.appDelegate = appDelegate }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        print("[Speech] startSpeech message received from JS")
        appDelegate?.startSpeechFromJS()
    }
}

class StopSpeechMessageHandler: NSObject, WKScriptMessageHandler {
    weak var appDelegate: AppDelegate?
    init(appDelegate: AppDelegate?) { self.appDelegate = appDelegate }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        appDelegate?.stopSpeech()
    }
}

extension SceneDelegate {
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
