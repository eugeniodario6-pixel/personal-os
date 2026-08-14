/**
 * TDEE / projection utilities.
 * Fixed constants: male, age 28, height 178 cm, sedentary (×1.2).
 */

/** Mifflin-St Jeor BMR for male, age 28, height 178 cm */
export function calcBMR(weightKg: number): number {
  return 10 * weightKg + 6.25 * 178 - 5 * 28 + 5;
}

/** TDEE: BMR × 1.2 (sedentary activity multiplier) */
export function calcTDEE(weightKg: number): number {
  return calcBMR(weightKg) * 1.2;
}

/** Daily caloric deficit = TDEE − calorie target */
export function calcDeficit(tdee: number, calorieTarget: number): number {
  return tdee - calorieTarget;
}

/** Projected weekly weight loss rate in kg/week */
export function calcWeeklyRate(deficit: number): number {
  return (deficit * 7) / 7700;
}

/** Estimated weeks remaining to reach 84 kg midpoint */
export function calcETA(currentWeight: number, weeklyRate: number): number {
  if (weeklyRate <= 0) return Infinity;
  return (currentWeight - 84) / weeklyRate;
}
