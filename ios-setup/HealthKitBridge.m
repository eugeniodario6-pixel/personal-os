// HealthKitBridge.m
// Capacitor plugin registration — Objective-C bridge
// Drop into: ios/App/App/HealthKitBridge.m

#import <Capacitor/Capacitor.h>

CAP_PLUGIN(HealthKitBridge, "HealthKitBridge",
  CAP_PLUGIN_METHOD(requestAuthorization, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getLatestWeight, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getWorkouts, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getHeartRate, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getSleep, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getSteps, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(writeWeight, CAPPluginReturnPromise);
)
