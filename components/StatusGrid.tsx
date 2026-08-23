'use client';

interface StatusGridProps {
  calories: number;
  calorieTarget: number;
  habitsCompleted: number;
  habitsTotal: number;
  workoutsToday: number;
  meditationToday: number;
}

const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.80), 0 4px 12px rgba(0,0,0,0.40)';

export default function StatusGrid({
  calories,
  calorieTarget,
  habitsCompleted,
  habitsTotal,
  workoutsToday,
  meditationToday,
}: StatusGridProps) {
  const calPct = calorieTarget > 0 ? Math.min(calories / calorieTarget, 1) : 0;
  const habitPct = habitsTotal > 0 ? habitsCompleted / habitsTotal : 0;

  const cells = [
    {
      label: 'CALORIES',
      value: Math.round(calories).toLocaleString(),
      sub: `of ${calorieTarget}`,
      pct: calPct,
      active: calories > 0,
    },
    {
      label: 'HABITS',
      value: `${habitsCompleted}/${habitsTotal}`,
      sub: habitsTotal > 0 ? `${Math.round(habitPct * 100)}% done` : 'none set',
      pct: habitPct,
      active: habitsCompleted > 0,
    },
    {
      label: 'WORKOUTS',
      value: workoutsToday > 0 ? String(workoutsToday) : '—',
      sub: 'today',
      pct: workoutsToday > 0 ? 1 : 0,
      active: workoutsToday > 0,
    },
    {
      label: 'MEDITATE',
      value: meditationToday > 0 ? `${meditationToday}m` : '—',
      sub: 'today',
      pct: meditationToday > 0 ? 1 : 0,
      active: meditationToday > 0,
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {cells.map((cell) => (
        <div
          key={cell.label}
          style={{
            background: 'var(--color-carbon)',
            borderRadius: 18,
            border: 'none',
            boxShadow: CARD_SHADOW,
            padding: '14px 16px',
          }}
        >
          <p style={{
            fontSize: 10, fontWeight: 500,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.28)',
            margin: '0 0 6px',
            fontFamily: 'var(--font-mono)',
          }}>
            {cell.label}
          </p>
          <p style={{
            fontSize: 28, fontWeight: 700,
            letterSpacing: '-0.03em', lineHeight: 1,
            color: '#fff',
            margin: '0 0 3px',
          }}>
            {cell.value}
          </p>
          <p style={{
            fontSize: 11, color: 'rgba(255,255,255,0.30)',
            margin: '0 0 10px',
          }}>
            {cell.sub}
          </p>
          <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${cell.pct * 100}%`,
              background: cell.active ? '#fff' : 'transparent',
              borderRadius: 99,
              transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}
