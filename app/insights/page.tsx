'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { getMealLogs, getWorkoutLogs, getHabits, getHabitCompletions, getMeditationLogs, getInsights, todayISO } from '@/lib/db';

export default function InsightsPage() {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [summaries, setSummaries] = useState<{ label: string; sub: string; value: string; icon: string }[]>([]);
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
      { label: 'Avg calories', sub: `Per day · ${days}d`, value: `${avgCal}`, icon: '◎' },
      { label: 'Workouts', sub: `Last ${days} days`, value: String(workoutLogs.length), icon: '△' },
      { label: 'Habit rate', sub: `${completed} of ${totalPossible}`, value: `${habitPct}%`, icon: '✦' },
      { label: 'Meditation', sub: `Sessions logged`, value: String(medLogs.filter(m => m.completed).length), icon: '◉' },
    ]);

    setInsights(insightRows.map(i => ({
      text: i.relationship,
      meta: `${i.data_points} data points · ${Math.round(i.confidence * 100)}% confidence`,
    })));
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const PAD = 16;
  const GAP = 10;

  return (
    <div style={{ minHeight: '100dvh', background: '#000', paddingTop: '4.5rem', paddingBottom: '130px' }}>

      {/* ── Header ── */}
      <div style={{ padding: `0 ${PAD}px 20px` }}>
        <p style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 10, marginTop: 4 }}>Analytics</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff', margin: 0 }}>Insights</h1>

          {/* Period toggle */}
          <div style={{ display: 'flex', background: '#111113', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 99, padding: 3, gap: 3 }}>
            {(['week', 'month'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '6px 14px', borderRadius: 99, border: 'none',
                  background: period === p ? '#fff' : 'transparent',
                  color: period === p ? '#000' : 'rgba(255,255,255,0.40)',
                  fontSize: 12, fontWeight: period === p ? 700 : 500,
                  cursor: 'pointer', transition: 'all 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {p === 'week' ? '7d' : '30d'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: `0 ${PAD}px`, display: 'flex', flexDirection: 'column', gap: GAP }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ height: 80, borderRadius: 20, background: '#111113', opacity: 0.6 - i * 0.1 }} />
          ))}
        </div>
      ) : (
        <div style={{ padding: `0 ${PAD}px`, display: 'flex', flexDirection: 'column', gap: GAP }}>

          {/* ── 2×2 stat bento ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP }}>
            {summaries.map((s, i) => (
              <div key={s.label} style={{ background: '#111113', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{s.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)' }}>{s.label}</span>
                </div>
                <p style={{ fontSize: 'clamp(28px,8vw,36px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff', margin: '0 0 5px' }}>{s.value}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0 }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Period label ── */}
          <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', margin: '6px 0 0' }}>
            {period === 'week' ? 'This week' : 'This month'} — Patterns
          </p>

          {/* ── Patterns card ── */}
          <div style={{ background: '#111113', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            {insights.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', margin: '0 0 8px' }}>Not enough data yet</p>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.40)', lineHeight: 1.6 }}>Keep logging to unlock pattern insights.</p>
              </div>
            ) : insights.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '18px 20px',
                  borderBottom: idx < insights.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  borderLeft: '2px solid rgba(255,255,255,0.25)',
                }}
              >
                <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 500, letterSpacing: '-0.011em', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>{item.text}</p>
                <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', margin: 0 }}>{item.meta}</p>
              </div>
            ))}
          </div>

          {/* ── Empty insights placeholder ── */}
          {insights.length === 0 && (
            <div style={{ background: '#111113', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', padding: '20px 20px 18px' }}>
              <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', margin: '0 0 14px' }}>What to expect</p>
              {[
                'Correlation between workout days and calorie intake',
                'Habit streaks vs meditation session quality',
                'Weight trend vs protein target adherence',
              ].map((hint, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: i < 2 ? 12 : 0, marginBottom: i < 2 ? 12 : 0, borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', flexShrink: 0, marginTop: 6 }} />
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)', lineHeight: 1.5, margin: 0 }}>{hint}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
