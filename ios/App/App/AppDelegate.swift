import UIKit
import Capacitor
import HealthKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    let healthStore = HKHealthStore()

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
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

// ── HealthKit Capacitor Plugin ────────────────────────────────────────────────
@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin {

    private let store = HKHealthStore()

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

    @objc func requestPermissions(_ call: CAPPluginCall) {
        print("[HealthKitPlugin] requestPermissions called")
        guard HKHealthStore.isHealthDataAvailable() else {
            print("[HealthKitPlugin] HealthKit NOT available")
            call.resolve(["granted": false])
            return
        }
        store.requestAuthorization(toShare: nil, read: readTypes) { success, error in
            print("[HealthKitPlugin] auth result — success: \(success), error: \(String(describing: error))")
            call.resolve(["granted": success])
        }
    }

    @objc func getSteps(_ call: CAPPluginCall) {
        guard let type = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            call.resolve(["steps": 0]); return
        }
        let start = Calendar.current.startOfDay(for: Date())
        let pred = HKQuery.predicateForSamples(withStart: start, end: Date())
        let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: pred, options: .cumulativeSum) { _, stats, _ in
            let steps = stats?.sumQuantity()?.doubleValue(for: .count()) ?? 0
            call.resolve(["steps": Int(steps)])
        }
        store.execute(query)
    }

    @objc func getHeartRate(_ call: CAPPluginCall) {
        guard let type = HKQuantityType.quantityType(forIdentifier: .heartRate) else {
            call.resolve(["bpm": 0]); return
        }
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
            guard let sample = samples?.first as? HKQuantitySample else { call.resolve(["bpm": 0]); return }
            let bpm = sample.quantity.doubleValue(for: HKUnit(from: "count/min"))
            call.resolve(["bpm": Int(bpm)])
        }
        store.execute(query)
    }

    @objc func getHRV(_ call: CAPPluginCall) {
        guard let type = HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN) else {
            call.resolve(["ms": 0]); return
        }
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
            guard let sample = samples?.first as? HKQuantitySample else { call.resolve(["ms": 0]); return }
            let ms = sample.quantity.doubleValue(for: HKUnit.secondUnit(with: .milli))
            call.resolve(["ms": ms])
        }
        store.execute(query)
    }

    @objc func getSleep(_ call: CAPPluginCall) {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            call.resolve(["hours": 0, "minutes": 0]); return
        }
        let start = Calendar.current.date(byAdding: .hour, value: -24, to: Date())!
        let pred = HKQuery.predicateForSamples(withStart: start, end: Date())
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(sampleType: type, predicate: pred, limit: HKObjectQueryNoLimit, sortDescriptors: [sort]) { _, samples, _ in
            guard let samples = samples as? [HKCategorySample] else { call.resolve(["hours": 0, "minutes": 0]); return }
            var asleepValues: Set<Int> = [HKCategoryValueSleepAnalysis.asleep.rawValue]
            if #available(iOS 16.0, *) {
                asleepValues.insert(HKCategoryValueSleepAnalysis.asleepCore.rawValue)
                asleepValues.insert(HKCategoryValueSleepAnalysis.asleepDeep.rawValue)
                asleepValues.insert(HKCategoryValueSleepAnalysis.asleepREM.rawValue)
            }
            let totalSecs = samples.filter { asleepValues.contains($0.value) }
                .reduce(0.0) { $0 + $1.endDate.timeIntervalSince($1.startDate) }
            call.resolve(["hours": Int(totalSecs / 3600), "minutes": Int((totalSecs.truncatingRemainder(dividingBy: 3600)) / 60), "totalMinutes": Int(totalSecs / 60)])
        }
        store.execute(query)
    }

    @objc func getWeight(_ call: CAPPluginCall) {
        guard let type = HKQuantityType.quantityType(forIdentifier: .bodyMass) else {
            call.resolve(["kg": 0]); return
        }
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
            guard let sample = samples?.first as? HKQuantitySample else { call.resolve(["kg": 0]); return }
            let kg = sample.quantity.doubleValue(for: .gramUnit(with: .kilo))
            call.resolve(["kg": (kg * 10).rounded() / 10])
        }
        store.execute(query)
    }

    @objc func getActiveCalories(_ call: CAPPluginCall) {
        guard let type = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) else {
            call.resolve(["kcal": 0]); return
        }
        let start = Calendar.current.startOfDay(for: Date())
        let pred = HKQuery.predicateForSamples(withStart: start, end: Date())
        let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: pred, options: .cumulativeSum) { _, stats, _ in
            let kcal = stats?.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0
            call.resolve(["kcal": Int(kcal)])
        }
        store.execute(query)
    }

    @objc func getWorkouts(_ call: CAPPluginCall) {
        let start = Calendar.current.date(byAdding: .day, value: -7, to: Date())!
        let pred = HKQuery.predicateForSamples(withStart: start, end: Date())
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(sampleType: .workoutType(), predicate: pred, limit: 20, sortDescriptors: [sort]) { _, samples, _ in
            guard let workouts = samples as? [HKWorkout] else { call.resolve(["workouts": []]); return }
            let df = ISO8601DateFormatter()
            let result: [[String: Any]] = workouts.map { w in
                var calories = 0
                if #available(iOS 16.0, *) {
                    calories = Int(w.statistics(for: HKQuantityType(.activeEnergyBurned))?.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0)
                } else {
                    calories = Int(w.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0)
                }
                return ["type": w.workoutActivityType.name, "duration": Int(w.duration / 60), "calories": calories, "date": df.string(from: w.endDate)]
            }
            call.resolve(["workouts": result])
        }
        store.execute(query)
    }
}

// ── Registration ──────────────────────────────────────────────────────────────
extension HKWorkoutActivityType {
    var name: String {
        switch self {
        case .running: return "Running"
        case .cycling: return "Cycling"
        case .swimming: return "Swimming"
        case .walking: return "Walking"
        case .hiking: return "Hiking"
        case .yoga: return "Yoga"
        case .functionalStrengthTraining, .traditionalStrengthTraining: return "Strength"
        case .highIntensityIntervalTraining: return "HIIT"
        case .boxing: return "Boxing"
        case .rowing: return "Rowing"
        case .elliptical: return "Elliptical"
        default: return "Workout"
        }
    }
}
