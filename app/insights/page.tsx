'use client';

import { useEffect, useState, useCallback } from 'react';
import { db, todayISO } from '@/lib/db';

const MONO = "'IBM Plex Mono', monospace";
const lbl = { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#888', margin: 0 };
const border2 = '2px solid #444';

export default function InsightsPage() {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [summaries, setSummaries] = useState<{ label: string; sub: string; value: string }[]>([]);
  const [insights, setInsights] = useState<{ text: string; meta: string }[]>([]);

  const load = useCallback(async () => {
    const today = new Date();
    const days = period === 'week' ? 7 : 30;
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const [mealLogs, workoutLogs, habitCompletions, activeHabits, medLogs, insightRows] = await Promise.all([
      db.meal_log.where('date').anyOf(dates).toArray(),
      db.workout_log.where('date').anyOf(dates).toArray(),
      db.habit_completion.where('date').anyOf(dates).toArray(),
      db.habit.where('active').equals(1).toArray(),
      db.meditation_log.where('date').anyOf(dates).toArray(),
      db.insight.where('shown').equals(1).toArray(),
    ]);

    // Avg calories
    let totalCal = 0;
    for (const log of mealLogs) {
      const food = await db.food_item.get(log.food_item_id);
      if (food) totalCal += food.calories * (log.quantity / food.serving_size);
    }
    const avgCal = dates.length > 0 ? Math.round(totalCal / days) : 0;

    // Habit completion %
    const totalPossible = activeHabits.length * days;
    const completed = habitCompletions.filter(c => c.completed_at).length;
    const habitPct = totalPossible > 0 ? Math.round((completed / totalPossible) * 100) : 0;

    setSummaries([
      { label: 'AVG CALORIES / DAY', sub: `OVER ${days} DAYS`, value: `${avgCal} KCAL` },
      { label: 'WORKOUTS', sub: `LAST ${days} DAYS`, value: String(workoutLogs.length) },
      { label: 'HABITS COMPLETION', sub: `${completed} OF ${totalPossible} POSSIBLE`, value: `${habitPct}%` },
      { label: 'MEDITATION SESSIONS', sub: `LAST ${days} DAYS`, value: String(medLogs.filter(m => m.completed).length) },
    ]);

    setInsights(insightRows.map(i => ({
      text: i.relationship,
      meta: `${i.data_points} DATA POINTS · ${Math.round(i.confidence * 100)}% CONFIDENCE`,
    })));
  }, [period]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ fontFamily: MONO }}>
      <div style={{ padding: '1rem', borderBottom: border2 }}>
        <p style={{ ...lbl, marginBottom: '0.25rem' }}>INSIGHTS</p>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>DATA</h1>
      </div>

      <div style={{ display: 'flex', borderBottom: border2 }}>
        {(['week', 'month'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{ flex: 1, padding: '0.6rem 1rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', textAlign: 'center', border: 'none', background: '#000', cursor: 'pointer', marginBottom: -2, color: period === p ? '#fff' : '#444', borderBottom: `2px solid ${period === p ? '#fff' : '#444'}`, fontFamily: MONO }}>
            {p === 'week' ? 'THIS WEEK' : 'THIS MONTH'}
          </button>
        ))}
      </div>

      <div style={{ borderBottom: border2 }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}>
          <span style={lbl}>SUMMARY — {period === 'week' ? 'THIS WEEK' : 'THIS MONTH'}</span>
        </div>
        {summaries.map(s => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1rem', borderBottom: '1px solid #111' }}>
            <div>
              <p style={lbl}>{s.label}</p>
              <p style={{ margin: 0, fontSize: '0.65rem', color: '#444' }}>{s.sub}</p>
            </div>
            <span style={{ fontWeight: 700, fontSize: '1.125rem', color: '#fff' }}>{s.value}</span>
          </div>
        ))}
      </div>

      <div>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}>
          <span style={lbl}>DISCOVERED PATTERNS</span>
        </div>
        {insights.length === 0 ? (
          <div style={{ padding: '1.5rem 1rem', color: '#444', fontSize: '0.75rem' }}>NOT ENOUGH DATA YET — KEEP LOGGING.</div>
        ) : insights.map((i, idx) => (
          <div key={idx} style={{ padding: '1rem', borderBottom: '1px solid #111', borderLeft: '3px solid #444' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#fff', lineHeight: 1.6 }}>{i.text}</p>
            <p style={lbl}>{i.meta}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
