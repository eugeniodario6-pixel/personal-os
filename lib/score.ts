// Daily score calculator — 0–100 points
// Habits: 40 | Calories: 25 | Workout: 20 | Meditation: 15

export interface ScoreInput {
  calorieTarget: number;
  calories: number;
  habitDone: number;
  habitTotal: number;
  workoutsToday: number;
  medDone: boolean;
}

export function calcDailyScore(input: ScoreInput): number {
  const { calorieTarget, calories, habitDone, habitTotal, workoutsToday, medDone } = input;

  // Habits: 40 points max
  const habitsScore = (habitDone / Math.max(habitTotal, 1)) * 40;

  // Calories on target: 25 points
  let calScore = 0;
  if (calories > 0 && calorieTarget > 0) {
    const diff = Math.abs(calories - calorieTarget) / calorieTarget;
    if (diff <= 0.15) calScore = 25;
    else if (diff <= 0.30) calScore = 15;
  }

  // Workout: 20 points
  const workoutScore = workoutsToday > 0 ? 20 : 0;

  // Meditation: 15 points
  const medScore = medDone ? 15 : 0;

  const total = habitsScore + calScore + workoutScore + medScore;
  return Math.min(100, Math.max(0, Math.round(total)));
}

export function scoreGrade(score: number): string {
  if (score >= 90) return 'ELITE';
  if (score >= 75) return 'STRONG';
  if (score >= 50) return 'SOLID';
  if (score >= 25) return 'BUILDING';
  return 'START';
}
