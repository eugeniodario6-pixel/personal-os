'use client';

import { useEffect, useState, useCallback } from 'react';
import { getMealLogs, getWorkoutLogs, getHabits, getHabitCompletions, getMeditationLogs, getInsights, todayISO } from '@/lib/db';

export default function InsightsPage() {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [summaries, setSummaries] = useState<{ label: string; sub: string; value: string }[]>([]);
  const [insights, setInsights] = useState<{ text: string; meta: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date();
    const days = period === 'week' ? 7 : 30;
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const [activeHabits, insightRows] = await Promise.all([getHabits(), getInsights()]);

    const mealLogArrays     = await Promise.all(dates.map(d => getMealLogs(d)));
    const workoutLogArrays  = await Promise.all(dates.map(d => getWorkoutLogs(d)));
    const habitCompArrays   = await Promise.all(dates.map(d => getHabitCompletions(d)));
    const medLogArrays      = await Promise.all(dates.map(d => getMeditationLogs(d)));

    const mealLogs      = mealLogArrays.flat();
    const workoutLogs   = workoutLogArrays.flat();
    const habitComps    = habitCompArrays.flat();
    const medLogs       = medLogArrays.flat();

    let totalCal = 0;
    for (const log of mealLogs) {
      if (log.food) totalCal += log.food.calories * (log.quantity / log.food.serving_size);
    }
    const avgCal = days > 0 ? Math.round(totalCal / days) : 0;

    const totalPossible = activeHabits.length * days;
    const completed     = habitComps.filter(c => c.completed_at).length;
    const habitPct      = totalPossible > 0 ? Math.round((completed / totalPossible) * 100) : 0;

    setSummaries([
      { label: 'Avg calories / day', sub: `Over ${days} days`,              value: `${avgCal} kcal` },
      { label: 'Workouts',           sub: `Last ${days} days`,              value: String(workoutLogs.length) },
      { label: 'Habit completion',   sub: `${completed} of ${totalPossible} possible`, value: `${habitPct}%` },
      { label: 'Meditation sessions',sub: `Last ${days} days`,              value: String(medLogs.filter(m => m.completed).length) },
    ]);

    setInsights(insightRows.map(i => ({
      text: i.relationship,
      meta: `${i.data_points} data points · ${Math.round(i.confidence * 100)}% confidence`,
    })));
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ minHeight: '100dvh', background: '#000000', paddingTop: '4rem', paddingBottom: '8rem' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 20px 16px' }}>
        <p style={{ fontSize: 12, letterSpacing: '0.01em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 6 }}>Analytics</p>
        <h1 style={{ fontSize: 40, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1.1, color: '#ffffff', margin: 0 }}>Insights</h1>
      </div>

      {/* ── Period toggle — tab-bar ── */}
      <div className="tab-bar">
        {(['week', 'month'] as const).map(p => (
          <button
            key={p}
            className={`tab ${period === p ? 'active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {p === 'week' ? 'This week' : 'This month'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: '-0.011em' }}>Loading…</p>
        </div>
      ) : (
        <>
          {/* ── Summary card ── */}
          <div style={{ margin: '12px 20px', background: '#141414', boxShadow: 'rgba(255,255,255,0.06) 0px 0px 0px 1px inset', borderRadius: 24, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="label">Summary — {period === 'week' ? 'this week' : 'this month'}</p>
            </div>
            {summaries.map((s, i) => (
              <div
                key={s.label}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px',
                  borderBottom: i < summaries.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}
              >
                <div>
                  <p style={{ fontSize: 13, fontWeight: 400, letterSpacing: '-0.011em', color: 'rgba(255,255,255,0.72)', margin: '0 0 3px' }}>{s.label}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', letterSpacing: '-0.01em', margin: 0 }}>{s.sub}</p>
                </div>
                <span style={{ fontSize: 20, fontWeight: 510, letterSpacing: '-0.012em', color: '#ffffff' }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* ── Patterns card ── */}
          <div style={{ margin: '0 20px', background: '#141414', boxShadow: 'rgba(255,255,255,0.06) 0px 0px 0px 1px inset', borderRadius: 24, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="label">Discovered patterns</p>
            </div>
            {insights.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: '-0.011em' }}>Not enough data yet — keep logging.</p>
              </div>
            ) : insights.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '14px 16px',
                  borderBottom: idx < insights.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  borderLeft: '3px solid rgba(255,255,255,0.20)',
                }}
              >
                <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 400, letterSpacing: '-0.011em', color: 'var(--text)', lineHeight: 1.6 }}>{item.text}</p>
                <p className="label">{item.meta}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
