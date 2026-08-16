// ─────────────────────────────────────────────────────────────────────────────
// Fitness Calculators — Pure Functions
// No dependencies. Fully typed. Works in any stack.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────────────────

export type Sex = 'male' | 'female';

export type ActivityLevel =
  | 'sedentary'    // little or no exercise
  | 'light'        // 1–3 days/week
  | 'moderate'     // 3–5 days/week
  | 'active'       // 6–7 days/week
  | 'very_active'; // hard exercise + physical job

export type Goal = 'lose' | 'maintain' | 'gain';

export interface MacroInput {
  sex: Sex;
  age: number;          // years
  heightCm: number;     // centimetres
  weightKg: number;     // kilograms
  activity: ActivityLevel;
  goal: Goal;
}

export interface MacroSet {
  calories: number;
  carbsG: number;
  fatG: number;
  proteinG: number;
  carbsPct: number;
  fatPct: number;
  proteinPct: number;
}

export interface MacroResult {
  bmr: number;
  tdee: number;
  targetCalories: number;
  standard: MacroSet;    // 50 / 30 / 20
  lowCarb: MacroSet;     // 40 / 30 / 30
  highProtein: MacroSet; // 44 / 30 / 26
  tailored: MacroSet;    // dynamic protein @ 1.6g/kg
}

export interface BMIResult {
  bmi: number;
  category: 'underweight' | 'normal' | 'overweight' | 'obese';
}

export interface OneRepMaxResult {
  oneRM: number;        // kg
  percentages: {        // useful for programming
    p90: number;
    p85: number;
    p80: number;
    p75: number;
    p70: number;
  };
}

export interface BodyFatInput {
  sex: Sex;
  heightCm: number;
  waistCm: number;
  neckCm: number;
  hipsCm?: number; // required for female
}

export interface BodyFatResult {
  bodyFatPct: number;
  category: 'essential' | 'athlete' | 'fitness' | 'average' | 'obese';
  leanMassKg: number;
  fatMassKg: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  lose: -500,
  maintain: 0,
  gain: 300,
};

// ─── Macro Calculator ─────────────────────────────────────────────────────────

/**
 * Calculate BMR using Mifflin-St Jeor equation.
 */
export function calcBMR(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/**
 * Calculate TDEE (Total Daily Energy Expenditure).
 */
export function calcTDEE(bmr: number, activity: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activity];
}

/**
 * Build a MacroSet from a calorie target and percentage split.
 * carbs/fat/protein percentages should sum to 100.
 */
function buildMacroSet(
  calories: number,
  carbsPct: number,
  fatPct: number,
  proteinPct: number,
): MacroSet {
  return {
    calories: Math.round(calories),
    carbsG: Math.round((calories * (carbsPct / 100)) / 4),
    fatG: Math.round((calories * (fatPct / 100)) / 9),
    proteinG: Math.round((calories * (proteinPct / 100)) / 4),
    carbsPct,
    fatPct,
    proteinPct,
  };
}

/**
 * Build a tailored MacroSet with protein anchored at 1.6g/kg bodyweight.
 * Fat fixed at 30%. Remaining calories go to carbs.
 */
function buildTailoredMacroSet(calories: number, weightKg: number): MacroSet {
  const proteinG = Math.round(1.6 * weightKg);
  const proteinCal = proteinG * 4;
  const fatCal = calories * 0.3;
  const fatG = Math.round(fatCal / 9);
  const carbsCal = Math.max(0, calories - proteinCal - fatCal);
  const carbsG = Math.round(carbsCal / 4);

  const proteinPct = Math.round((proteinCal / calories) * 100);
  const fatPct = Math.round((fatCal / calories) * 100);
  const carbsPct = 100 - proteinPct - fatPct;

  return {
    calories: Math.round(calories),
    carbsG,
    fatG,
    proteinG,
    carbsPct,
    fatPct,
    proteinPct,
  };
}

/**
 * Full macro calculator.
 */
export function calcMacros(input: MacroInput): MacroResult {
  const bmr = calcBMR(input.sex, input.weightKg, input.heightCm, input.age);
  const tdee = calcTDEE(bmr, input.activity);
  const targetCalories = Math.max(1200, tdee + GOAL_ADJUSTMENTS[input.goal]);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories: Math.round(targetCalories),
    standard: buildMacroSet(targetCalories, 50, 30, 20),
    lowCarb: buildMacroSet(targetCalories, 40, 30, 30),
    highProtein: buildMacroSet(targetCalories, 44, 30, 26),
    tailored: buildTailoredMacroSet(targetCalories, input.weightKg),
  };
}

// ─── BMI Calculator ───────────────────────────────────────────────────────────

/**
 * Calculate BMI and category.
 */
export function calcBMI(weightKg: number, heightCm: number): BMIResult {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const rounded = Math.round(bmi * 10) / 10;

  let category: BMIResult['category'];
  if (bmi < 18.5) category = 'underweight';
  else if (bmi < 25) category = 'normal';
  else if (bmi < 30) category = 'overweight';
  else category = 'obese';

  return { bmi: rounded, category };
}

// ─── One-Rep Max ──────────────────────────────────────────────────────────────

/**
 * Estimate one-rep max using the Epley formula.
 * weight: kg lifted, reps: number of reps performed (≥1, best accuracy at 1–10).
 */
export function calcOneRepMax(weightKg: number, reps: number): OneRepMaxResult {
  if (reps === 1) {
    return {
      oneRM: Math.round(weightKg),
      percentages: {
        p90: Math.round(weightKg * 0.9),
        p85: Math.round(weightKg * 0.85),
        p80: Math.round(weightKg * 0.8),
        p75: Math.round(weightKg * 0.75),
        p70: Math.round(weightKg * 0.7),
      },
    };
  }

  const oneRM = weightKg * (1 + reps / 30);
  const rounded = Math.round(oneRM);

  return {
    oneRM: rounded,
    percentages: {
      p90: Math.round(oneRM * 0.9),
      p85: Math.round(oneRM * 0.85),
      p80: Math.round(oneRM * 0.8),
      p75: Math.round(oneRM * 0.75),
      p70: Math.round(oneRM * 0.7),
    },
  };
}

// ─── Body Fat % (US Navy Method) ─────────────────────────────────────────────

/**
 * Estimate body fat percentage using the US Navy circumference method.
 * All measurements in centimetres.
 * hips is required for females.
 */
export function calcBodyFat(input: BodyFatInput, totalWeightKg: number): BodyFatResult {
  const { sex, heightCm, waistCm, neckCm, hipsCm } = input;

  let bodyFatPct: number;

  if (sex === 'male') {
    // Male formula
    bodyFatPct =
      495 /
        (1.0324 -
          0.19077 * Math.log10(waistCm - neckCm) +
          0.15456 * Math.log10(heightCm)) -
      450;
  } else {
    // Female formula (requires hips)
    const hips = hipsCm ?? waistCm; // fallback if not provided
    bodyFatPct =
      495 /
        (1.29579 -
          0.35004 * Math.log10(waistCm + hips - neckCm) +
          0.221 * Math.log10(heightCm)) -
      450;
  }

  bodyFatPct = Math.max(0, Math.round(bodyFatPct * 10) / 10);

  const fatMassKg = Math.round((bodyFatPct / 100) * totalWeightKg * 10) / 10;
  const leanMassKg = Math.round((totalWeightKg - fatMassKg) * 10) / 10;

  let category: BodyFatResult['category'];
  if (sex === 'male') {
    if (bodyFatPct < 6) category = 'essential';
    else if (bodyFatPct < 14) category = 'athlete';
    else if (bodyFatPct < 18) category = 'fitness';
    else if (bodyFatPct < 25) category = 'average';
    else category = 'obese';
  } else {
    if (bodyFatPct < 14) category = 'essential';
    else if (bodyFatPct < 21) category = 'athlete';
    else if (bodyFatPct < 25) category = 'fitness';
    else if (bodyFatPct < 32) category = 'average';
    else category = 'obese';
  }

  return { bodyFatPct, category, leanMassKg, fatMassKg };
}

// ─── Unit Helpers ─────────────────────────────────────────────────────────────

export function lbsToKg(lbs: number): number {
  return Math.round(lbs * 0.453592 * 10) / 10;
}

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

export function feetInchesToCm(feet: number, inches: number): number {
  return Math.round((feet * 30.48 + inches * 2.54) * 10) / 10;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  return {
    feet: Math.floor(totalInches / 12),
    inches: Math.round(totalInches % 12),
  };
}
