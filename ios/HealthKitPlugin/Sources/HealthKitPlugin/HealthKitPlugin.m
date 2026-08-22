#import <Capacitor/Capacitor.h>

CAP_PLUGIN(HealthKitPlugin, "HealthKit",
  CAP_PLUGIN_METHOD(requestPermissions, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getSteps,           CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getHeartRate,       CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getHRV,             CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getSleep,           CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getWeight,          CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getActiveCalories,  CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getWorkouts,        CAPPluginReturnPromise);
)
