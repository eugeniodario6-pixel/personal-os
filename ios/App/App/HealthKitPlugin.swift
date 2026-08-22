import Capacitor
import HealthKit

@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthKitPlugin"
    public let jsName = "HealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getData",            returnType: CAPPluginReturnPromise),
    ]

    private let store = HKHealthStore()

    private var readTypes: Set<HKObjectType> {
        var types = Set<HKObjectType>()
        let ids: [HKQuantityTypeIdentifier] = [
            .stepCount, .heartRate, .heartRateVariabilitySDNN,
            .bodyMass, .activeEnergyBurned,
        ]
        for id in ids {
            if let t = HKObjectType.quantityType(forIdentifier: id) { types.insert(t) }
        }
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(sleep) }
        types.insert(HKObjectType.workoutType())
        return types
    }

    @objc func requestPermissions(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit not available"); return
        }
        store.requestAuthorization(toShare: nil, read: readTypes) { success, error in
            if let error = error { call.reject(error.localizedDescription) }
            else { call.resolve(["granted": success]) }
        }
    }

    @objc func getData(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["available": false]); return
        }

        let group = DispatchGroup()
        var steps = 0, bpm = 0, hrv = 0.0, sleepHours = 0, sleepMinutes = 0, weight = 0.0, kcal = 0

        // Steps
        group.enter()
        if let type = HKQuantityType.quantityType(forIdentifier: .stepCount) {
            let start = Calendar.current.startOfDay(for: Date())
            let pred = HKQuery.predicateForSamples(withStart: start, end: Date())
            let q = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: pred, options: .cumulativeSum) { _, s, _ in
                steps = Int(s?.sumQuantity()?.doubleValue(for: .count()) ?? 0)
                group.leave()
            }
            store.execute(q)
        } else { group.leave() }

        // Heart rate
        group.enter()
        if let type = HKQuantityType.quantityType(forIdentifier: .heartRate) {
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
            let q = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, s, _ in
                if let sample = s?.first as? HKQuantitySample {
                    bpm = Int(sample.quantity.doubleValue(for: HKUnit(from: "count/min")))
                }
                group.leave()
            }
            store.execute(q)
        } else { group.leave() }

        // HRV
        group.enter()
        if let type = HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN) {
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
            let q = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, s, _ in
                if let sample = s?.first as? HKQuantitySample {
                    hrv = sample.quantity.doubleValue(for: HKUnit.secondUnit(with: .milli))
                }
                group.leave()
            }
            store.execute(q)
        } else { group.leave() }

        // Sleep
        group.enter()
        if let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            let start = Calendar.current.date(byAdding: .hour, value: -24, to: Date())!
            let pred = HKQuery.predicateForSamples(withStart: start, end: Date())
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
            let q = HKSampleQuery(sampleType: type, predicate: pred, limit: HKObjectQueryNoLimit, sortDescriptors: [sort]) { _, s, _ in
                if let samples = s as? [HKCategorySample] {
                    let asleep: Set<Int> = [
                        HKCategoryValueSleepAnalysis.asleep.rawValue,
                        HKCategoryValueSleepAnalysis.asleepCore.rawValue,
                        HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
                        HKCategoryValueSleepAnalysis.asleepREM.rawValue,
                    ]
                    let total = samples.filter { asleep.contains($0.value) }
                        .reduce(0.0) { $0 + $1.endDate.timeIntervalSince($1.startDate) }
                    sleepHours = Int(total / 3600)
                    sleepMinutes = Int((total.truncatingRemainder(dividingBy: 3600)) / 60)
                }
                group.leave()
            }
            store.execute(q)
        } else { group.leave() }

        // Weight
        group.enter()
        if let type = HKQuantityType.quantityType(forIdentifier: .bodyMass) {
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
            let q = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, s, _ in
                if let sample = s?.first as? HKQuantitySample {
                    weight = (sample.quantity.doubleValue(for: .gramUnit(with: .kilo)) * 10).rounded() / 10
                }
                group.leave()
            }
            store.execute(q)
        } else { group.leave() }

        // Active calories
        group.enter()
        if let type = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) {
            let start = Calendar.current.startOfDay(for: Date())
            let pred = HKQuery.predicateForSamples(withStart: start, end: Date())
            let q = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: pred, options: .cumulativeSum) { _, s, _ in
                kcal = Int(s?.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0)
                group.leave()
            }
            store.execute(q)
        } else { group.leave() }

        group.notify(queue: .main) {
            call.resolve([
                "available":     true,
                "steps":         steps,
                "bpm":           bpm,
                "hrv":           hrv,
                "sleepHours":    sleepHours,
                "sleepMinutes":  sleepMinutes,
                "weight":        weight,
                "kcal":          kcal,
            ])
        }
    }
}
