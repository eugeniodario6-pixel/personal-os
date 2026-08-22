// HealthKitBridge.swift
// Drop this into: ios/App/App/HealthKitBridge.swift (after running `npx cap add ios`)
//
// This reads from Apple Health (which Garmin writes to automatically)
// and exposes the data to the web app via Capacitor's bridge.

import Foundation
import HealthKit
import Capacitor

@objc(HealthKitBridge)
public class HealthKitBridge: CAPPlugin {

    private let store = HKHealthStore()

    // ── Types we want to read ──────────────────────────────────────────────────
    private var readTypes: Set<HKObjectType> {
        var types = Set<HKObjectType>()
        let quantityTypes: [HKQuantityTypeIdentifier] = [
            .bodyMass,
            .heartRate,
            .restingHeartRate,
            .heartRateVariabilitySDNN,
            .activeEnergyBurned,
            .basalEnergyBurned,
            .stepCount,
            .distanceWalkingRunning,
            .vo2Max,
            .bodyFatPercentage,
            .leanBodyMass,
        ]
        for id in quantityTypes {
            if let t = HKObjectType.quantityType(forIdentifier: id) { types.insert(t) }
        }
        // Workouts
        types.insert(HKObjectType.workoutType())
        // Sleep
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(sleep) }
        return types
    }

    private var writeTypes: Set<HKSampleType> {
        var types = Set<HKSampleType>()
        if let t = HKObjectType.quantityType(forIdentifier: .bodyMass)     { types.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .dietaryEnergyConsumed) { types.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .dietaryProtein) { types.insert(t) }
        types.insert(HKObjectType.workoutType())
        return types
    }

    // ── Request authorisation ──────────────────────────────────────────────────
    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit not available on this device")
            return
        }
        store.requestAuthorization(toShare: writeTypes, read: readTypes) { success, error in
            if success {
                call.resolve(["authorised": true])
            } else {
                call.reject("Authorisation failed: \(error?.localizedDescription ?? "unknown")")
            }
        }
    }

    // ── Latest body weight ─────────────────────────────────────────────────────
    @objc func getLatestWeight(_ call: CAPPluginCall) {
        guard let type = HKQuantityType.quantityType(forIdentifier: .bodyMass) else {
            call.reject("Type unavailable"); return
        }
        let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1,
                                  sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]) { _, samples, _ in
            if let sample = samples?.first as? HKQuantitySample {
                let kg = sample.quantity.doubleValue(for: .gramUnit(with: .kilo))
                call.resolve(["weight_kg": kg, "date": ISO8601DateFormatter().string(from: sample.endDate)])
            } else {
                call.resolve(["weight_kg": nil])
            }
        }
        store.execute(query)
    }

    // ── Workouts (last N days) ─────────────────────────────────────────────────
    @objc func getWorkouts(_ call: CAPPluginCall) {
        let days = call.getInt("days") ?? 30
        let start = Calendar.current.date(byAdding: .day, value: -days, to: Date())!
        let pred  = HKQuery.predicateForSamples(withStart: start, end: Date())
        let query = HKSampleQuery(sampleType: .workoutType(), predicate: pred, limit: 100,
                                  sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]) { _, samples, _ in
            let workouts = (samples as? [HKWorkout] ?? []).map { w -> [String: Any] in
                return [
                    "type":         w.workoutActivityType.name,
                    "duration_min": Int(w.duration / 60),
                    "calories":     w.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0,
                    "distance_m":   w.totalDistance?.doubleValue(for: .meter()) ?? 0,
                    "start":        ISO8601DateFormatter().string(from: w.startDate),
                    "end":          ISO8601DateFormatter().string(from: w.endDate),
                    "source":       w.sourceRevision.source.name,
                ]
            }
            call.resolve(["workouts": workouts])
        }
        store.execute(query)
    }

    // ── Heart rate (last 24h avg) ──────────────────────────────────────────────
    @objc func getHeartRate(_ call: CAPPluginCall) {
        guard let type = HKQuantityType.quantityType(forIdentifier: .heartRate) else {
            call.reject("Type unavailable"); return
        }
        let start = Calendar.current.date(byAdding: .hour, value: -24, to: Date())!
        let pred  = HKQuery.predicateForSamples(withStart: start, end: Date())
        let query = HKSampleQuery(sampleType: type, predicate: pred, limit: HKObjectQueryNoLimit,
                                  sortDescriptors: nil) { _, samples, _ in
            let values = (samples as? [HKQuantitySample] ?? []).map {
                $0.quantity.doubleValue(for: HKUnit(from: "count/min"))
            }
            let avg = values.isEmpty ? 0 : values.reduce(0, +) / Double(values.count)
            call.resolve(["avg_bpm": Int(avg), "resting_bpm": 0, "samples": values.count])
        }
        store.execute(query)
    }

    // ── Sleep (last night) ─────────────────────────────────────────────────────
    @objc func getSleep(_ call: CAPPluginCall) {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            call.reject("Type unavailable"); return
        }
        let start = Calendar.current.date(byAdding: .day, value: -2, to: Date())!
        let pred  = HKQuery.predicateForSamples(withStart: start, end: Date())
        let query = HKSampleQuery(sampleType: type, predicate: pred, limit: HKObjectQueryNoLimit,
                                  sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]) { _, samples, _ in
            var totalSecs = 0.0
            for sample in samples as? [HKCategorySample] ?? [] {
                if sample.value == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue ||
                   sample.value == HKCategoryValueSleepAnalysis.asleepCore.rawValue ||
                   sample.value == HKCategoryValueSleepAnalysis.asleepDeep.rawValue ||
                   sample.value == HKCategoryValueSleepAnalysis.asleepREM.rawValue {
                    totalSecs += sample.endDate.timeIntervalSince(sample.startDate)
                }
            }
            call.resolve(["hours": totalSecs / 3600])
        }
        store.execute(query)
    }

    // ── Step count (today) ─────────────────────────────────────────────────────
    @objc func getSteps(_ call: CAPPluginCall) {
        guard let type = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            call.reject("Type unavailable"); return
        }
        let start = Calendar.current.startOfDay(for: Date())
        let pred  = HKQuery.predicateForSamples(withStart: start, end: Date())
        let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: pred, options: .cumulativeSum) { _, stats, _ in
            let steps = stats?.sumQuantity()?.doubleValue(for: .count()) ?? 0
            call.resolve(["steps": Int(steps)])
        }
        store.execute(query)
    }

    // ── Write weight to Health ─────────────────────────────────────────────────
    @objc func writeWeight(_ call: CAPPluginCall) {
        guard let kg = call.getDouble("weight_kg"),
              let type = HKQuantityType.quantityType(forIdentifier: .bodyMass) else {
            call.reject("Invalid input"); return
        }
        let qty    = HKQuantity(unit: .gramUnit(with: .kilo), doubleValue: kg)
        let sample = HKQuantitySample(type: type, quantity: qty, start: Date(), end: Date())
        store.save(sample) { success, error in
            success ? call.resolve() : call.reject(error?.localizedDescription ?? "Write failed")
        }
    }
}

// ── Workout type name helper ───────────────────────────────────────────────────
extension HKWorkoutActivityType {
    var name: String {
        switch self {
        case .running:          return "Running"
        case .cycling:          return "Cycling"
        case .swimming:         return "Swimming"
        case .functionalStrengthTraining, .traditionalStrengthTraining: return "Strength"
        case .highIntensityIntervalTraining: return "HIIT"
        case .yoga:             return "Yoga"
        case .walking:          return "Walking"
        case .rowing:           return "Rowing"
        case .boxing:           return "Boxing"
        default:                return "Workout"
        }
    }
}
