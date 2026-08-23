'use client';

import { useEffect, useState, useCallback } from 'react';
import { getMealLogs, getWorkoutLogs, getHabits, getHabitCompletions, getMeditationLogs, getInsights } from '@/lib/db';

export default function InsightsPage() {
  const [period, setPeriod]       = useState<'week' | 'month'>('week');
  const [summaries, setSummaries] = useState<{ label: string; sub: string; value: string }[]>([]);
  const [insights, setInsights]   = useState<{ text: string; meta: string }[]>([]);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date();
    const days = period === 'week' ? 7 : 30;
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    const [activeHabits, insightRows] = await Promise.all([getHabits(), getInsights()]);
    const [mealArrays, workoutArrays, habitArrays, medArrays] = await Promise.all([
      Promise.all(dates.map(d => getMealLogs(d))),
      Promise.all(dates.map(d => getWorkoutLogs(d))),
      Promise.all(dates.map(d => getHabitCompletions(d))),
      Promise.all(dates.map(d => getMeditationLogs(d))),
    ]);
    const mealLogs    = mealArrays.flat();
    const workoutLogs = workoutArrays.flat();
    const habitComps  = habitArrays.flat();
    const medLogs     = medArrays.flat();

    let totalCal = 0;
    for (const log of mealLogs) {
      if (log.food) totalCal += log.food.calories * (log.quantity / log.food.serving_size);
    }
    const avgCal = Math.round(totalCal / days);
    const totalPossible = activeHabits.length * days;
    const completed = habitComps.filter(c => c.completed_at).length;
    const habitPct = totalPossible > 0 ? Math.round((completed / totalPossible) * 100) : 0;

    setSummaries([
      { label: 'Avg calories / day', sub: `Over ${days} days`,           value: `${avgCal} kcal` },
      { label: 'Workouts',           sub: `Last ${days} days`,           value: String(workoutLogs.length) },
      { label: 'Habit completion',   sub: `${completed} of ${totalPossible} possible`, value: `${habitPct}%` },
      { label: 'Meditation',         sub: `Sessions completed`,          value: String(medLogs.filter(m => m.completed).length) },
    ]);
    setInsights(insightRows.map(i => ({
      text: i.relationship,
      meta: `${i.data_points} data points · ${Math.round(i.confidence * 100)}% confidence`,
    })));
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page">

      <div className="page-head">
        <div className="page-head-left">
          <span className="label" style={{ color: 'var(--text-ghost)' }}>DATA</span>
          <span className="page-title">Insights</span>
        </div>
      </div>

      <div className="tab-bar">
        {(['week', 'month'] as const).map(p => (
          <button key={p} className={`tab t-fast${period === p ? ' active' : ''}`} onClick={() => setPeriod(p)}>
            {p === 'week' ? 'This week' : 'This month'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state">Loading…</div>
      ) : (
        <>
          <div className="section-label">
            <span className="label">Summary — {period === 'week' ? 'this week' : 'this month'}</span>
          </div>

          <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr', margin: 'var(--page-pad)' }}>
            {summaries.map(s => (
              <div key={s.label} className="stat-cell" style={{ padding: '1rem' }}>
                <p className="label" style={{ marginBottom: '0.5rem' }}>{s.label}</p>
                <p className="num-lg" style={{ marginBottom: '0.2rem' }}>{s.value}</p>
                <p className="label-xs">{s.sub}</p>
              </div>
            ))}
          </div>

          <div className="section-label" style={{ marginTop: '0.5rem' }}>
            <span className="label">Patterns</span>
          </div>

          {insights.length === 0 ? (
            <div className="empty-state">Not enough data yet — keep logging.</div>
          ) : insights.map((item, idx) => (
            <div key={idx} className="row" style={{ display: 'block', cursor: 'default', borderLeft: '2px solid var(--accent)', paddingLeft: 'calc(var(--page-pad) - 2px)' }}>
              <p style={{ margin: '0 0 0.4rem', fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>{item.text}</p>
              <p className="label">{item.meta}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
