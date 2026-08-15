'use client';

interface StatCellProps {
  label: string;
  value: string | number;
  sub?: string;
  inverted?: boolean;
}

function StatCell({ label, value, sub, inverted }: StatCellProps) {
  return (
    <div
      className="stat-cell"
      style={
        inverted
          ? { background: '#fff', color: '#000', borderColor: '#fff' }
          : {}
      }
    >
      <span className="label" style={inverted ? { color: '#444' } : {}}>
        {label}
      </span>
      <span
        className="number-medium"
        style={inverted ? { color: '#000' } : { color: '#fff' }}
      >
        {value}
      </span>
      {sub && (
        <span
          style={{
            fontSize: '0.65rem',
            color: inverted ? '#444' : '#888',
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

interface StatusGridProps {
  calories: number;
  calorieTarget: number;
  habitsCompleted: number;
  habitsTotal: number;
  workoutsToday: number;
  meditationToday: number;
}

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

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0',
          borderBottom: '2px solid #444',
        }}
      >
        <div style={{ borderRight: '1px solid #444' }}>
          <StatCell
            label="CALORIES"
            value={Math.round(calories)}
            sub={`/ ${calorieTarget} TARGET`}
          />
          <div
            style={{
              margin: '0 0.75rem 0.75rem',
              height: '4px',
              background: '#111',
              border: '1px solid #444',
            }}
          >
            <div
              style={{
                height: '100%',
                background: '#fff',
                width: `${calPct * 100}%`,
              }}
            />
          </div>
        </div>

        <div>
          <StatCell
            label="HABITS"
            value={`${habitsCompleted}/${habitsTotal}`}
            sub={
              habitsTotal > 0
                ? `${Math.round(habitPct * 100)}% DONE`
                : 'NO HABITS'
            }
            inverted={habitsCompleted > 0 && habitsCompleted === habitsTotal}
          />
          <div
            style={{
              margin: '0 0.75rem 0.75rem',
              height: '4px',
              background: '#111',
              border: '1px solid #444',
            }}
          >
            <div
              style={{
                height: '100%',
                background: '#fff',
                width: `${habitPct * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          borderBottom: '2px solid #444',
        }}
      >
        <div style={{ borderRight: '1px solid #444' }}>
          <StatCell
            label="WORKOUTS"
            value={workoutsToday}
            sub="TODAY"
            inverted={workoutsToday > 0}
          />
        </div>
        <div>
          <StatCell
            label="MEDITATION"
            value={meditationToday > 0 ? `${meditationToday}min` : '—'}
            sub="TODAY"
            inverted={meditationToday > 0}
          />
        </div>
      </div>
    </div>
  );
}
