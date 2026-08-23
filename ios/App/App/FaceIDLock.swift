import LocalAuthentication
import UIKit

private extension UILabel {
    func letterSpacing(_ spacing: CGFloat) {
        guard let text = text else { return }
        let attrs = NSMutableAttributedString(string: text)
        attrs.addAttribute(.kern, value: spacing, range: NSRange(location: 0, length: text.count))
        attributedText = attrs
    }
}

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
            let blur = UIBlurEffect(style: .systemMaterialDark)
            let blurView = UIVisualEffectView(effect: blur)
            blurView.frame = window.bounds
            blurView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            blurView.tag = 9999

            // Batman logo
            let icon = UILabel()
            icon.text = "🦇"
            icon.font = .systemFont(ofSize: 64)
            icon.translatesAutoresizingMaskIntoConstraints = false
            blurView.contentView.addSubview(icon)

            // Title
            let label = UILabel()
            label.text = "PERSONAL OS"
            label.font = .systemFont(ofSize: 13, weight: .bold)
            label.textColor = UIColor.white.withAlphaComponent(0.5)
            label.letterSpacing(1.8)
            label.translatesAutoresizingMaskIntoConstraints = false
            blurView.contentView.addSubview(label)

            // Subtitle
            let sub = UILabel()
            sub.text = "Identify yourself."
            sub.font = .systemFont(ofSize: 28, weight: .semibold)
            sub.textColor = .white
            sub.translatesAutoresizingMaskIntoConstraints = false
            blurView.contentView.addSubview(sub)

            // Unlock button — yellow accent
            let btn = UIButton(type: .system)
            btn.setTitle("Scan Face ID", for: .normal)
            btn.setTitleColor(.white, for: .normal)
            btn.titleLabel?.font = .systemFont(ofSize: 15, weight: .bold)
            btn.backgroundColor = UIColor(red: 31/255, green: 88/255, blue: 242/255, alpha: 1) // #1F58F2
            btn.layer.cornerRadius = 16
            btn.contentEdgeInsets = UIEdgeInsets(top: 14, left: 32, bottom: 14, right: 32)
            btn.translatesAutoresizingMaskIntoConstraints = false
            btn.addTarget(self, action: #selector(self.authenticate), for: .touchUpInside)
            blurView.contentView.addSubview(btn)

            NSLayoutConstraint.activate([
                icon.centerXAnchor.constraint(equalTo: blurView.contentView.centerXAnchor),
                icon.centerYAnchor.constraint(equalTo: blurView.contentView.centerYAnchor, constant: -80),

                label.centerXAnchor.constraint(equalTo: blurView.contentView.centerXAnchor),
                label.topAnchor.constraint(equalTo: icon.bottomAnchor, constant: 16),

                sub.centerXAnchor.constraint(equalTo: blurView.contentView.centerXAnchor),
                sub.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 8),

                btn.centerXAnchor.constraint(equalTo: blurView.contentView.centerXAnchor),
                btn.topAnchor.constraint(equalTo: sub.bottomAnchor, constant: 36),
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
