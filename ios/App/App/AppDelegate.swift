import UIKit
import Capacitor
import HealthKit
import AVFoundation
import Speech

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private let store = HKHealthStore()

    // ── Speech properties (used by SceneDelegate message handlers) ──
    var speechAudioEngine = AVAudioEngine()
    var speechRequest: SFSpeechAudioBufferRecognitionRequest?
    var speechTask: SFSpeechRecognitionTask?
    var speechIsListening = false

    func startSpeechFromJS() {
        guard !speechIsListening else { return }
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            guard status == .authorized else {
                self?.pushSpeechResult(transcript: "", error: "Not authorized")
                return
            }
            DispatchQueue.main.async { self?.doStartSpeech() }
        }
    }

    func doStartSpeech() {
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
        guard recognizer?.isAvailable == true else {
            pushSpeechResult(transcript: "", error: "Unavailable"); return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            speechRequest = SFSpeechAudioBufferRecognitionRequest()
            guard let req = speechRequest else { return }
            req.shouldReportPartialResults = false
            let node = speechAudioEngine.inputNode
            let fmt  = node.outputFormat(forBus: 0)
            node.installTap(onBus: 0, bufferSize: 1024, format: fmt) { [weak self] buf, _ in
                self?.speechRequest?.append(buf)
            }
            speechAudioEngine.prepare()
            try speechAudioEngine.start()
            speechIsListening = true
            print("[Speech] Listening...")
            evalJS("window.dispatchEvent(new CustomEvent('speech-listening',{detail:{listening:true}}));")
            speechTask = recognizer?.recognitionTask(with: req) { [weak self] result, error in
                guard let self else { return }
                if let result = result, result.isFinal {
                    let text = result.bestTranscription.formattedString
                    print("[Speech] Got: \(text)")
                    self.stopSpeech()
                    self.pushSpeechResult(transcript: text, error: nil)
                } else if let error = error {
                    print("[Speech] Error: \(error)")
                    self.stopSpeech()
                    self.pushSpeechResult(transcript: "", error: error.localizedDescription)
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in
                self?.speechRequest?.endAudio()
            }
        } catch {
            pushSpeechResult(transcript: "", error: error.localizedDescription)
        }
    }

    func stopSpeech() {
        speechRequest?.endAudio()
        speechAudioEngine.stop()
        if speechAudioEngine.inputNode.numberOfInputs > 0 {
            speechAudioEngine.inputNode.removeTap(onBus: 0)
        }
        speechTask?.cancel()
        speechRequest = nil
        speechTask = nil
        speechIsListening = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        evalJS("window.dispatchEvent(new CustomEvent('speech-listening',{detail:{listening:false}}));")
    }

    private func pushSpeechResult(transcript: String, error: String?) {
        let escaped = transcript.replacingOccurrences(of: "'", with: "\\'")
        let errStr  = error != nil ? "'\(error!)'" : "null"
        evalJS("window.dispatchEvent(new CustomEvent('speech-result',{detail:{transcript:'\(escaped)',error:\(errStr)}}));")
    }

    private var readTypes: Set<HKObjectType> {
        var types = Set<HKObjectType>()
        let ids: [HKQuantityTypeIdentifier] = [
            .stepCount, .heartRate, .heartRateVariabilitySDNN,
            .bodyMass, .activeEnergyBurned, .restingHeartRate,
        ]
        for id in ids {
            if let t = HKObjectType.quantityType(forIdentifier: id) { types.insert(t) }
        }
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(sleep) }
        types.insert(HKObjectType.workoutType())
        return types
    }

    // Cached health data — pushed to JS whenever the page is ready
    private var cachedHealthJS: String?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Request microphone permission for Veronica voice input
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            print("[Mic] Permission granted: \(granted)")
        }

        // Request HealthKit permissions then push data to JS
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
            self.initHealthKit()
        }
        return true
    }

    // Face ID handled in SceneDelegate

    private func initHealthKit() {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        store.requestAuthorization(toShare: nil, read: readTypes) { success, _ in
            guard success else { return }
            self.fetchAndPushToJS()
        }
    }

    private func fetchAndPushToJS() {
        let group = DispatchGroup()
        var steps = 0, bpm = 0, hrv = 0.0, sleepHours = 0, sleepMins = 0, weightKg = 0.0, kcal = 0

        // Steps today
        group.enter()
        if let type = HKQuantityType.quantityType(forIdentifier: .stepCount) {
            let start = Calendar.current.startOfDay(for: Date())
            let pred = HKQuery.predicateForSamples(withStart: start, end: Date())
            store.execute(HKStatisticsQuery(quantityType: type, quantitySamplePredicate: pred, options: .cumulativeSum) { _, stats, _ in
                steps = Int(stats?.sumQuantity()?.doubleValue(for: .count()) ?? 0)
                group.leave()
            })
        } else { group.leave() }

        // Heart rate
        group.enter()
        if let type = HKQuantityType.quantityType(forIdentifier: .heartRate) {
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
            store.execute(HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, s, _ in
                bpm = Int((s?.first as? HKQuantitySample)?.quantity.doubleValue(for: HKUnit(from: "count/min")) ?? 0)
                group.leave()
            })
        } else { group.leave() }

        // HRV
        group.enter()
        if let type = HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN) {
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
            store.execute(HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, s, _ in
                hrv = (s?.first as? HKQuantitySample)?.quantity.doubleValue(for: HKUnit.secondUnit(with: .milli)) ?? 0
                group.leave()
            })
        } else { group.leave() }

        // Sleep
        group.enter()
        if let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            let start = Calendar.current.date(byAdding: .hour, value: -24, to: Date())!
            let pred = HKQuery.predicateForSamples(withStart: start, end: Date())
            store.execute(HKSampleQuery(sampleType: type, predicate: pred, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, s, _ in
                var asleepVals: Set<Int> = [HKCategoryValueSleepAnalysis.asleep.rawValue]
                if #available(iOS 16.0, *) {
                    asleepVals.insert(HKCategoryValueSleepAnalysis.asleepCore.rawValue)
                    asleepVals.insert(HKCategoryValueSleepAnalysis.asleepDeep.rawValue)
                    asleepVals.insert(HKCategoryValueSleepAnalysis.asleepREM.rawValue)
                }
                let secs = (s as? [HKCategorySample] ?? []).filter { asleepVals.contains($0.value) }
                    .reduce(0.0) { $0 + $1.endDate.timeIntervalSince($1.startDate) }
                sleepHours = Int(secs / 3600)
                sleepMins  = Int((secs.truncatingRemainder(dividingBy: 3600)) / 60)
                group.leave()
            })
        } else { group.leave() }

        // Weight
        group.enter()
        if let type = HKQuantityType.quantityType(forIdentifier: .bodyMass) {
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
            store.execute(HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, s, _ in
                let kg = (s?.first as? HKQuantitySample)?.quantity.doubleValue(for: .gramUnit(with: .kilo)) ?? 0
                weightKg = (kg * 10).rounded() / 10
                group.leave()
            })
        } else { group.leave() }

        // Active calories
        group.enter()
        if let type = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) {
            let start = Calendar.current.startOfDay(for: Date())
            let pred = HKQuery.predicateForSamples(withStart: start, end: Date())
            store.execute(HKStatisticsQuery(quantityType: type, quantitySamplePredicate: pred, options: .cumulativeSum) { _, stats, _ in
                kcal = Int(stats?.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0)
                group.leave()
            })
        } else { group.leave() }

        // Push to JS when all done
        group.notify(queue: .main) {
            let js = """
            (function() {
                var data = {
                    steps: \(steps),
                    heartRate: \(bpm),
                    hrv: \(hrv),
                    sleepHours: \(sleepHours),
                    sleepMinutes: \(sleepMins),
                    weight: \(weightKg),
                    activeCalories: \(kcal),
                    available: true
                };
                window.__healthKitData = data;
                window.dispatchEvent(new CustomEvent('healthkit-data', { detail: data }));
            })();
            """
            print("[HealthKit] Pushing to JS — steps:\(steps) bpm:\(bpm) weight:\(weightKg)kg sleep:\(sleepHours)h\(sleepMins)m kcal:\(kcal)")
            self.cachedHealthJS = js
            self.evalJS(js)
        }
    }

    func evalJS(_ js: String, retries: Int = 5) {
        DispatchQueue.main.async {
            if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
               let vc = scene.windows.first?.rootViewController as? CAPBridgeViewController,
               let webView = vc.webView {
                webView.evaluateJavaScript(js) { _, err in
                    if let err = err {
                        print("[HealthKit] JS eval error (retries left: \(retries)): \(err)")
                        if retries > 0 {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                                self.evalJS(js, retries: retries - 1)
                            }
                        }
                    } else {
                        print("[HealthKit] JS event dispatched OK")
                    }
                }
            } else if retries > 0 {
                print("[HealthKit] WebView not ready, retrying...")
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    self.evalJS(js, retries: retries - 1)
                }
            }
        }
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// ── Speech stub (plugin bridge unused — WKScriptMessageHandler used instead) ─────────
@objc(SpeechPlugin)
public class SpeechPlugin: CAPPlugin {
    @objc public override func requestPermissions(_ call: CAPPluginCall) { call.resolve(["granted": true]) }
    @objc func start(_ call: CAPPluginCall) { call.resolve(["transcript": ""]) }
    @objc func stop(_ call: CAPPluginCall) { call.resolve() }
}

// ── HealthKit Capacitor Plugin (keeps JS bridge as fallback) ──────────────────
@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin {
    private let store = HKHealthStore()

    @objc public override func requestPermissions(_ call: CAPPluginCall) {
        call.resolve(["granted": true])
    }

    @objc func getSteps(_ call: CAPPluginCall) { call.resolve(["steps": 0]) }
    @objc func getHeartRate(_ call: CAPPluginCall) { call.resolve(["bpm": 0]) }
    @objc func getHRV(_ call: CAPPluginCall) { call.resolve(["ms": 0]) }
    @objc func getSleep(_ call: CAPPluginCall) { call.resolve(["hours": 0, "minutes": 0, "totalMinutes": 0]) }
    @objc func getWeight(_ call: CAPPluginCall) { call.resolve(["kg": 0]) }
    @objc func getActiveCalories(_ call: CAPPluginCall) { call.resolve(["kcal": 0]) }
    @objc func getWorkouts(_ call: CAPPluginCall) { call.resolve(["workouts": []]) }
}

extension HKWorkoutActivityType {
    var name: String {
        switch self {
        case .running: return "Running"
        case .cycling: return "Cycling"
        case .swimming: return "Swimming"
        case .walking: return "Walking"
        case .functionalStrengthTraining, .traditionalStrengthTraining: return "Strength"
        case .highIntensityIntervalTraining: return "HIIT"
        default: return "Workout"
        }
    }
}
