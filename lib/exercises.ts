export type Exercise = {
  key: string
  name: string
  sets: number
  reps: string
}

export type DayPlan = {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  label: string
  session: string
  exercises: Exercise[]
}

export const WEEKLY_PLAN: DayPlan[] = [
  {
    day: 'monday',
    label: 'Mon',
    session: 'upper body — push',
    exercises: [
      { key: 'mon_bench', name: 'bench press', sets: 4, reps: '8–10' },
      { key: 'mon_ohp', name: 'overhead press', sets: 3, reps: '10–12' },
      { key: 'mon_incline', name: 'incline dumbbell press', sets: 3, reps: '10–12' },
      { key: 'mon_tricep', name: 'tricep pushdown', sets: 3, reps: '12–15' },
      { key: 'mon_lateral', name: 'lateral raise', sets: 3, reps: '15–20' },
    ],
  },
  {
    day: 'tuesday',
    label: 'Tue',
    session: 'lower body — squat',
    exercises: [
      { key: 'tue_squat', name: 'back squat', sets: 4, reps: '6–8' },
      { key: 'tue_legpress', name: 'leg press', sets: 3, reps: '10–12' },
      { key: 'tue_rdl', name: 'romanian deadlift', sets: 3, reps: '10–12' },
      { key: 'tue_legcurl', name: 'leg curl', sets: 3, reps: '12–15' },
      { key: 'tue_calf', name: 'calf raise', sets: 4, reps: '15–20' },
    ],
  },
  {
    day: 'wednesday',
    label: 'Wed',
    session: 'rest day',
    exercises: [],
  },
  {
    day: 'thursday',
    label: 'Thu',
    session: 'upper body — pull',
    exercises: [
      { key: 'thu_pullup', name: 'pull-up', sets: 4, reps: '6–10' },
      { key: 'thu_row', name: 'barbell row', sets: 4, reps: '8–10' },
      { key: 'thu_pulldown', name: 'lat pulldown', sets: 3, reps: '10–12' },
      { key: 'thu_facepull', name: 'face pull', sets: 3, reps: '15–20' },
      { key: 'thu_curl', name: 'bicep curl', sets: 3, reps: '10–12' },
    ],
  },
  {
    day: 'friday',
    label: 'Fri',
    session: 'lower body — hinge',
    exercises: [
      { key: 'fri_deadlift', name: 'deadlift', sets: 4, reps: '5–6' },
      { key: 'fri_frontsquat', name: 'front squat', sets: 3, reps: '8–10' },
      { key: 'fri_splitsquat', name: 'bulgarian split squat', sets: 3, reps: '10 each' },
      { key: 'fri_legcurl', name: 'lying leg curl', sets: 3, reps: '12–15' },
      { key: 'fri_ab', name: 'ab wheel rollout', sets: 3, reps: '10–12' },
    ],
  },
  {
    day: 'saturday',
    label: 'Sat',
    session: 'conditioning',
    exercises: [
      { key: 'sat_row', name: 'rowing machine', sets: 1, reps: '20 min' },
      { key: 'sat_jumprope', name: 'jump rope', sets: 5, reps: '3 min' },
      { key: 'sat_plank', name: 'plank hold', sets: 3, reps: '60s' },
    ],
  },
  {
    day: 'sunday',
    label: 'Sun',
    session: 'rest day',
    exercises: [],
  },
]

export function getTodayPlan(): DayPlan {
  const days: DayPlan['day'][] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ]
  const today = days[new Date().getDay()]
  return WEEKLY_PLAN.find((p) => p.day === today) ?? WEEKLY_PLAN[0]
}
