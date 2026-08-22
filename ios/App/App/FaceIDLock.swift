import LocalAuthentication
import UIKit

/// Call `FaceIDLock.authenticate()` on app launch / foreground.
/// Blocks the UI with a blur overlay until the user authenticates.
class FaceIDLock {

    static let shared = FaceIDLock()
    private var overlay: UIView?
    private var authenticated = false

    /// Show lock screen and prompt Face ID
    func lock(in window: UIWindow?) {
        guard !authenticated else { return }
        guard let window else { return }

        DispatchQueue.main.async {
            // Blur overlay
            let blur = UIBlurEffect(style: .systemUltraThinMaterialDark)
            let blurView = UIVisualEffectView(effect: blur)
            blurView.frame = window.bounds
            blurView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            blurView.tag = 9999

            // Lock icon
            let icon = UILabel()
            icon.text = "🦇"
            icon.font = .systemFont(ofSize: 52)
            icon.translatesAutoresizingMaskIntoConstraints = false
            blurView.contentView.addSubview(icon)

            // App name
            let label = UILabel()
            label.text = "Personal OS"
            label.font = .systemFont(ofSize: 17, weight: .semibold)
            label.textColor = .white
            label.translatesAutoresizingMaskIntoConstraints = false
            blurView.contentView.addSubview(label)

            // Unlock button
            let btn = UIButton(type: .system)
            btn.setTitle("Unlock with Face ID", for: .normal)
            btn.setTitleColor(.white, for: .normal)
            btn.titleLabel?.font = .systemFont(ofSize: 15, weight: .medium)
            btn.backgroundColor = UIColor.white.withAlphaComponent(0.15)
            btn.layer.cornerRadius = 14
            btn.contentEdgeInsets = UIEdgeInsets(top: 12, left: 24, bottom: 12, right: 24)
            btn.translatesAutoresizingMaskIntoConstraints = false
            btn.addTarget(self, action: #selector(self.authenticate), for: .touchUpInside)
            blurView.contentView.addSubview(btn)

            NSLayoutConstraint.activate([
                icon.centerXAnchor.constraint(equalTo: blurView.contentView.centerXAnchor),
                icon.centerYAnchor.constraint(equalTo: blurView.contentView.centerYAnchor, constant: -60),

                label.centerXAnchor.constraint(equalTo: blurView.contentView.centerXAnchor),
                label.topAnchor.constraint(equalTo: icon.bottomAnchor, constant: 12),

                btn.centerXAnchor.constraint(equalTo: blurView.contentView.centerXAnchor),
                btn.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 32),
            ])

            window.addSubview(blurView)
            self.overlay = blurView

            // Auto-prompt Face ID immediately
            self.authenticate()
        }
    }

    @objc func authenticate() {
        let context = LAContext()
        var error: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            // No biometrics — fall back to passcode
            authenticateWithPasscode()
            return
        }

        context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: "Unlock Personal OS"
        ) { success, _ in
            DispatchQueue.main.async {
                if success {
                    self.unlock()
                }
                // If failed, overlay stays — user can tap "Unlock with Face ID" to retry
            }
        }
    }

    private func authenticateWithPasscode() {
        let context = LAContext()
        context.evaluatePolicy(
            .deviceOwnerAuthentication,
            localizedReason: "Unlock Personal OS"
        ) { success, _ in
            DispatchQueue.main.async {
                if success { self.unlock() }
            }
        }
    }

    private func unlock() {
        authenticated = true
        UIView.animate(withDuration: 0.3, animations: {
            self.overlay?.alpha = 0
        }) { _ in
            self.overlay?.removeFromSuperview()
            self.overlay = nil
        }
    }

    /// Reset on background — re-lock when app comes back to foreground
    func reset() {
        authenticated = false
    }
}
