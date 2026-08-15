'use client';

import { useEffect, useState, useCallback } from 'react';
import { db, todayISO, type Insight } from '@/lib/db';

type Period = 'week' | 'month';

interface Summary {
  label: string;
  value: string;
  sub?: string;
}

export default function InsightsPage() {
  const [period, setPeriod] = useState<Period>('week');
  const [insights, setInsights] = useState<Insight[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataPoints, setDataPoints] = useState(0);

  const loadData = useCallback(async () => {
    const today = new Date();
    const days = period === 'week' ? 7 : 30;
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    const dateSet = new Set(dates);

    const [allInsights, mealLogs, workoutLogs, habitCompletions, medLogs, allFoods, allHabits] =
      await Promise.all([
        db.insight.orderBy('generated_at').reverse().limit(20).toArray(),
        db.meal_log.filter((l) => dateSet.has(l.date)).toArray(),
        db.workout_log.filter((l) => dateSet.has(l.date)).toArray(),
        db.habit_completion.filter((c) => dateSet.has(c.date) && c.completed_at !== null).toArray(),
        db.meditation_log.filter((l) => dateSet.has(l.date)).toArray(),
        db.food_item.toArray(),
        db.habit.toArray(),
      ]);

    setInsights(allInsights);

    // Compute summaries
    const foodMap = new Map(allFoods.map((f) => [f.id, f]));
    let totalCals = 0;
    for (const log of mealLogs) {
      const food = foodMap.get(log.food_item_id);
      if (food) {
        totalCals += food.calories * (log.quantity / food.serving_size);
      }
    }

    const avgCals = mealLogs.length > 0 ? Math.round(totalCals / days) : 0;
    const totalWorkouts = workoutLogs.length;
    const totalWorkoutMin = workoutLogs.reduce((a, l) => a + l.duration_min, 0);
    const activeHabits = allHabits.filter((h) => h.active);
    const possibleCompletions = activeHabits.length * days;
    const habitPct = possibleCompletions > 0 ? Math.round((habitCompletions.length / possibleCompletions) * 100) : 0;
    const totalMedMin = medLogs.reduce((a, l) => a + l.duration_actual_min, 0);
    const medSessions = medLogs.length;

    const computed: Summary[] = [
      { label: 'AVG DAILY CALORIES', value: avgCals > 0 ? `${avgCals} KCAL` : '—', sub: `${mealLogs.length} MEALS LOGGED` },
      { label: 'WORKOUTS', value: String(totalWorkouts), sub: `${totalWorkoutMin} MIN TOTAL` },
      { label: 'HABIT COMPLETION', value: `${habitPct}%`, sub: `${habitCompletions.length} / ${possibleCompletions} CHECKS` },
      { label: 'MEDITATION', value: medSessions > 0 ? `${medSessions} SESSIONS` : '—', sub: `${totalMedMin} MIN TOTAL` },
    ];

    setSummaries(computed);
    setDataPoints(mealLogs.length + workoutLogs.length + habitCompletions.length + medLogs.length);
    setLoading(false);
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', fontFamily: "'IBM Plex Mono', monospace", color: '#444', fontSize: '0.75rem' }}>
        LOADING...
      </div>
    );
  }

  const showInsights = dataPoints >= 5;

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: '2px solid #444' }}>
        <p className="label" style={{ marginBottom: '0.25rem' }}>INSIGHTS</p>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', fontFamily: "'IBM Plex Mono', monospace" }}>DATA</h1>
      </div>

      {/* Period switcher */}
      <div className="tab-bar">
        <button className={`tab ${period === 'week' ? 'active' : ''}`} onClick={() => setPeriod('week')}>
          THIS WEEK
        </button>
        <button className={`tab ${period === 'month' ? 'active' : ''}`} onClick={() => setPeriod('month')}>
          THIS MONTH
        </button>
      </div>

      {/* Summary table */}
      <div style={{ borderBottom: '2px solid #444' }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}>
          <span className="label">SUMMARY — {period === 'week' ? '7 DAYS' : '30 DAYS'}</span>
        </div>
        {summaries.map((s, i) => (
          <div
            key={s.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.875rem 1rem',
              borderBottom: i < summaries.length - 1 ? '1px solid #111' : 'none',
            }}
          >
            <div>
              <p className="label" style={{ marginBottom: '0.2rem' }}>{s.label}</p>
              {s.sub && <p style={{ fontSize: '0.65rem', color: '#444', fontFamily: "'IBM Plex Mono', monospace" }}>{s.sub}</p>}
            </div>
            <span
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 700,
                fontSize: '1.125rem',
                color: '#fff',
              }}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* Insight cards — only when ≥5 data points */}
      {showInsights && insights.length > 0 && (
        <div>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}>
            <span className="label">DISCOVERED PATTERNS</span>
          </div>
          {insights.map((insight) => (
            <div
              key={insight.id}
              style={{
                padding: '1rem',
                borderBottom: '1px solid #111',
                borderLeft: '3px solid #444',
                marginLeft: '0',
              }}
            >
              <p
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.875rem',
                  color: '#fff',
                  lineHeight: 1.6,
                  marginBottom: '0.5rem',
                }}
              >
                {insight.relationship}
              </p>
              <p className="label">
                {insight.metric_a} × {insight.metric_b} · {insight.data_points} DATA POINTS · {Math.round(insight.confidence * 100)}% CONFIDENCE
              </p>
            </div>
          ))}
        </div>
      )}

      {/* No data state */}
      {!showInsights && (
        <div style={{ padding: '2rem 1rem' }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem', color: '#444', lineHeight: 1.8 }}>
            LOG AT LEAST 5 DATA POINTS ACROSS NUTRITION, WORKOUTS, HABITS, OR MEDITATION TO UNLOCK PATTERN DISCOVERY.
          </p>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#111', marginTop: '1rem' }}>
            CURRENT: {dataPoints} DATA POINTS
          </p>
          <div style={{ marginTop: '1rem', height: '4px', background: '#111', border: '1px solid #444' }}>
            <div style={{ height: '100%', background: '#444', width: `${Math.min(dataPoints / 5 * 100, 100)}%` }} />
          </div>
        </div>
      )}

      {showInsights && insights.length === 0 && (
        <div style={{ padding: '2rem 1rem' }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem', color: '#444', lineHeight: 1.8 }}>
            PATTERNS WILL APPEAR HERE AS YOU BUILD MORE HISTORY. KEEP LOGGING.
          </p>
        </div>
      )}
    </div>
  );
}
