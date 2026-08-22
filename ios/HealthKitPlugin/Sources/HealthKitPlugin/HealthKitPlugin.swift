import Capacitor
import HealthKit

@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthKitPlugin"
    public let jsName = "HealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSteps",           returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getHeartRate",       returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSleep",           returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getWeight",          returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getWorkouts",        returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getHRV",             returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getActiveCalories",  returnType: CAPPluginReturnPromise),
    ]

    private let store = HKHealthStore()

    // ── Read types we need ────────────────────────────────────────────────────
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

    // ── Request permissions ───────────────────────────────────────────────────
    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        print("[HealthKitPlugin] requestPermissions called")
        print("[HealthKitPlugin] isHealthDataAvailable: \(HKHealthStore.isHealthDataAvailable())")
        guard HKHealthStore.isHealthDataAvailable() else {
            print("[HealthKitPlugin] HealthKit NOT available on this device")
            call.reject("HealthKit not available on this device")
            return
        }
        print("[HealthKitPlugin] Requesting authorization for \(readTypes.count) types")
        store.requestAuthorization(toShare: nil, read: readTypes) { success, error in
            print("[HealthKitPlugin] Authorization result — success: \(success), error: \(String(describing: error))")
            if let error = error {
                call.reject(error.localizedDescription)
            } else {
                call.resolve(["granted": success])
            }
        }
    }

    // ── Steps today ───────────────────────────────────────────────────────────
    @objc func getSteps(_ call: CAPPluginCall) {
        guard let type = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            call.reject("Steps type unavailable"); return
        }
        let start = Calendar.current.startOfDay(for: Date())
        let pred  = HKQuery.predicateForSamples(withStart: start, end: Date())
        let query = HKStatisticsQuery(
            quantityType: type,
            quantitySamplePredicate: pred,
            options: .cumulativeSum
        ) { _, stats, error in
            if let error = error { call.reject(error.localizedDescription); return }
            let steps = stats?.sumQuantity()?.doubleValue(for: .count()) ?? 0
            call.resolve(["steps": Int(steps)])
        }
        store.execute(query)
    }

    // ── Heart rate (latest sample) ────────────────────────────────────────────
    @objc func getHeartRate(_ call: CAPPluginCall) {
        guard let type = HKQuantityType.quantityType(forIdentifier: .heartRate) else {
            call.reject("HR type unavailable"); return
        }
        let sort  = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, error in
            if let error = error { call.reject(error.localizedDescription); return }
            guard let sample = samples?.first as? HKQuantitySample else {
                call.resolve(["bpm": 0]); return
            }
            let bpm = sample.quantity.doubleValue(for: HKUnit(from: "count/min"))
            call.resolve(["bpm": Int(bpm)])
        }
        store.execute(query)
    }

    // ── HRV (latest) ─────────────────────────────────────────────────────────
    @objc func getHRV(_ call: CAPPluginCall) {
        guard let type = HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN) else {
            call.reject("HRV type unavailable"); return
        }
        let sort  = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, error in
            if let error = error { call.reject(error.localizedDescription); return }
            guard let sample = samples?.first as? HKQuantitySample else {
                call.resolve(["ms": 0]); return
            }
            let ms = sample.quantity.doubleValue(for: HKUnit.secondUnit(with: .milli))
            call.resolve(["ms": ms])
        }
        store.execute(query)
    }

    // ── Sleep last night ──────────────────────────────────────────────────────
    @objc func getSleep(_ call: CAPPluginCall) {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            call.reject("Sleep type unavailable"); return
        }
        let now   = Date()
        let start = Calendar.current.date(byAdding: .hour, value: -24, to: now)!
        let pred  = HKQuery.predicateForSamples(withStart: start, end: now)
        let sort  = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(
            sampleType: type,
            predicate: pred,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: [sort]
        ) { _, samples, error in
            if let error = error { call.reject(error.localizedDescription); return }
            guard let samples = samples as? [HKCategorySample], !samples.isEmpty else {
                call.resolve(["hours": 0, "minutes": 0]); return
            }

            // Build set of "asleep" values — iOS 16+ adds granular stages
            var asleepValues: Set<Int> = [HKCategoryValueSleepAnalysis.asleep.rawValue]
            if #available(iOS 16.0, *) {
                asleepValues.insert(HKCategoryValueSleepAnalysis.asleepCore.rawValue)
                asleepValues.insert(HKCategoryValueSleepAnalysis.asleepDeep.rawValue)
                asleepValues.insert(HKCategoryValueSleepAnalysis.asleepREM.rawValue)
            }

            let totalSecs = samples
                .filter { asleepValues.contains($0.value) }
                .reduce(0.0) { $0 + $1.endDate.timeIntervalSince($1.startDate) }

            let hours   = Int(totalSecs / 3600)
            let minutes = Int((totalSecs.truncatingRemainder(dividingBy: 3600)) / 60)
            call.resolve(["hours": hours, "minutes": minutes, "totalMinutes": Int(totalSecs / 60)])
        }
        store.execute(query)
    }

    // ── Latest body weight ────────────────────────────────────────────────────
    @objc func getWeight(_ call: CAPPluginCall) {
        guard let type = HKQuantityType.quantityType(forIdentifier: .bodyMass) else {
            call.reject("Weight type unavailable"); return
        }
        let sort  = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, error in
            if let error = error { call.reject(error.localizedDescription); return }
            guard let sample = samples?.first as? HKQuantitySample else {
                call.resolve(["kg": 0]); return
            }
            let kg = sample.quantity.doubleValue(for: .gramUnit(with: .kilo))
            call.resolve(["kg": (kg * 10).rounded() / 10])
        }
        store.execute(query)
    }

    // ── Active calories today ─────────────────────────────────────────────────
    @objc func getActiveCalories(_ call: CAPPluginCall) {
        guard let type = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) else {
            call.reject("Active calories type unavailable"); return
        }
        let start = Calendar.current.startOfDay(for: Date())
        let pred  = HKQuery.predicateForSamples(withStart: start, end: Date())
        let query = HKStatisticsQuery(
            quantityType: type,
            quantitySamplePredicate: pred,
            options: .cumulativeSum
        ) { _, stats, error in
            if let error = error { call.reject(error.localizedDescription); return }
            let kcal = stats?.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0
            call.resolve(["kcal": Int(kcal)])
        }
        store.execute(query)
    }

    // ── Recent workouts (last 7 days) ─────────────────────────────────────────
    @objc func getWorkouts(_ call: CAPPluginCall) {
        let start = Calendar.current.date(byAdding: .day, value: -7, to: Date())!
        let pred  = HKQuery.predicateForSamples(withStart: start, end: Date())
        let sort  = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(
            sampleType: .workoutType(),
            predicate: pred,
            limit: 20,
            sortDescriptors: [sort]
        ) { _, samples, error in
            if let error = error { call.reject(error.localizedDescription); return }
            guard let workouts = samples as? [HKWorkout] else {
                call.resolve(["workouts": []]); return
            }
            let df = ISO8601DateFormatter()
            let result: [[String: Any]] = workouts.map { w in
                let durationMins = Int(w.duration / 60)

                // calories — use totalEnergyBurned for compatibility with iOS 14/15
                var calories = 0
                if #available(iOS 16.0, *) {
                    calories = Int(
                        w.statistics(for: HKQuantityType(.activeEnergyBurned))?
                            .sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0
                    )
                } else {
                    calories = Int(
                        w.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0
                    )
                }

                return [
                    "type":     w.workoutActivityType.name,
                    "duration": durationMins,
                    "calories": calories,
                    "date":     df.string(from: w.endDate),
                ]
            }
            call.resolve(["workouts": result])
        }
        store.execute(query)
    }
}

// ── HKWorkoutActivityType readable name ──────────────────────────────────────
extension HKWorkoutActivityType {
    var name: String {
        switch self {
        case .running:                       return "Running"
        case .cycling:                       return "Cycling"
        case .swimming:                      return "Swimming"
        case .walking:                       return "Walking"
        case .hiking:                        return "Hiking"
        case .yoga:                          return "Yoga"
        case .functionalStrengthTraining:    return "Strength"
        case .traditionalStrengthTraining:   return "Strength"
        case .highIntensityIntervalTraining: return "HIIT"
        case .boxing:                        return "Boxing"
        case .soccer:                        return "Soccer"
        case .basketball:                    return "Basketball"
        case .tennis:                        return "Tennis"
        case .rowing:                        return "Rowing"
        case .elliptical:                    return "Elliptical"
        case .stairClimbing:                 return "Stair Climbing"
        case .pilates:                       return "Pilates"
        case .dance:                         return "Dance"
        case .golf:                          return "Golf"
        default:                             return "Workout"
        }
    }
}
