'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getProfile, getHabits, getHabitCompletions, getHabitStreaks,
  getMeditationSessions, getMeditationLogs, getTodayMacros,
  getWorkoutLogs, toggleHabitCompletion, seedUserData,
  todayISO, type Habit, type MeditationSession,
} from '@/lib/db';
import { haptic } from '@/lib/haptic';
import { toast } from '@/components/Toast';
import { DashboardSkeleton } from '@/components/Skeleton';
import QuickLogSheet from '@/components/QuickLogSheet';

// ── Score logic ────────────────────────────────────────────────────────────────
function calcScore(calPct: number, habitPct: number, hasWorkout: boolean, hasMed: boolean) {
  const cal = calPct >= 85 && calPct <= 110 ? 30 : calPct >= 70 ? 20 : calPct > 0 ? 10 : 0;
  const hab = Math.round(habitPct * 40) / 100;
  return Math.min(Math.round(cal + hab + (hasWorkout ? 20 : 0) + (hasMed ? 10 : 0)), 100);
}

function scoreLabel(s: number) {
  if (s >= 90) return 'Elite';
  if (s >= 75) return 'Strong';
  if (s >= 55) return 'Solid';
  if (s >= 35) return 'Building';
  return "Let's go";
}

// ── Contextual next-action nudge ───────────────────────────────────────────────
function getNextAction(
  calPct: number, habitPct: number, hasWorkout: boolean, hasMed: boolean,
  calorieTarget: number, calories: number,
): { label: string; sub: string; path: string; cta: string } | null {
  const h = new Date().getHours();

  if (calPct < 30 && h >= 7) {
    const meal = h < 11 ? 'breakfast' : h < 15 ? 'lunch' : 'dinner';
    return { label: `Log ${meal}`, sub: `${calorieTarget - calories} kcal remaining`, path: '/nutrition?action=add', cta: 'Log meal →' };
  }
  if (!hasWorkout && h >= 9 && h < 21) {
    return { label: 'Log a workout', sub: 'Move hasn\'t fired yet today', path: '/fitness', cta: 'Log workout →' };
  }
  if (habitPct < 50 && h >= 10) {
    return { label: 'Finish your habits', sub: `Still incomplete today`, path: '/habits', cta: 'View habits →' };
  }
  if (!hasMed && h >= 17) {
    return { label: 'Wind down', sub: 'Meditation not done yet', path: '/meditation', cta: 'Start session →' };
  }
  if (calPct > 0 && calPct < 85 && h >= 18) {
    return { label: 'Top up calories', sub: `${Math.round(calorieTarget - calories)} kcal left`, path: '/nutrition?action=add', cta: 'Log meal →' };
  }
  return null;
}

// ── Segment bar (tappable) ─────────────────────────────────────────────────────
function Segment({ label, val, path }: { label: string; val: number; path: string }) {
  const router = useRouter();
  const active = val > 0;
  return (
    <button
      onClick={() => { haptic('light'); router.push(path); }}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        textAlign: 'left', WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div className="progress" style={{ marginBottom: 6, height: 3 }}>
        <div
          className="progress-fill"
          style={{
            width: `${val}%`,
            background: val >= 100 ? 'var(--accent)' : 'var(--text)',
            transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>
      <p style={{
        fontSize: 10, fontWeight: active ? 510 : 400,
        letterSpacing: '0.01em', textTransform: 'uppercase',
        color: active ? 'var(--text-2)' : 'var(--text-4)',
        margin: 0, transition: 'color 0.2s',
      }}>
        {label}
      </p>
    </button>
  );
}

// ── Metric cell ────────────────────────────────────────────────────────────────
function MetricCell({
  label, value, sub, pct, active, onClick,
}: {
  label: string; value: string; sub?: string; pct?: number;
  active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left', padding: '16px', width: '100%',
        WebkitTapHighlightColor: 'transparent',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'border-color 0.2s',
      }}
    >
      <p className="label" style={{ marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1, color: 'var(--text)', margin: '0 0 4px' }}>
        {value}
      </p>
      {sub && <p className="label" style={{ margin: '0 0 10px' }}>{sub}</p>}
      {pct !== undefined && (
        <div className="progress">
          <div className="progress-fill" style={{
            width: `${Math.min(pct, 100)}%`,
            background: pct >= 100 ? 'var(--accent)' : 'var(--text)',
            transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>
      )}
    </button>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function TodayPage() {
  const router = useRouter();

  const [calories, setCalories]       = useState(0);
  const [calorieTarget, setCalTarget] = useState(2000);
  const [habits, setHabits]           = useState<(Habit & { done: boolean; streak: number })[]>([]);
  const [workoutsToday, setWorkouts]  = useState(0);
  const [medDone, setMedDone]         = useState(false);
  const [suggested, setSuggested]     = useState<MeditationSession | null>(null);
  const [dateStr, setDateStr]         = useState('');
  const [loading, setLoading]         = useState(true);
  const [quickLog, setQuickLog]       = useState(false);

  const load = useCallback(async () => {
    try {
      await seedUserData();
      const today = todayISO();
      setDateStr(new Date().toLocaleDateString('en-ZA', { weekday: 'long', month: 'long', day: 'numeric' }));
      const [macros, profile, activeHabits, completions, workouts, medLogs, sessions] = await Promise.all([
        getTodayMacros(), getProfile(), getHabits(), getHabitCompletions(today),
        getWorkoutLogs(today), getMeditationLogs(today), getMeditationSessions(),
      ]);
      setCalories(Math.round(macros.calories));
      setCalTarget(profile?.calorie_target ?? 2000);
      const doneIds = new Set(completions.filter(c => c.completed_at).map(c => c.habit_id));
      const streaks = await getHabitStreaks(activeHabits.map(h => h.id));
      setHabits(activeHabits.map(h => ({ ...h, done: doneIds.has(h.id), streak: streaks.get(h.id) ?? 0 })));
      setWorkouts(workouts.length);
      setMedDone(medLogs.some(m => m.completed));
      const loggedIds = new Set(medLogs.map(m => m.session_id));
      setSuggested(sessions.find(s => !loggedIds.has(s.id)) ?? sessions[0] ?? null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id: number) => {
    haptic('medium');
    await toggleHabitCompletion(id);
    const h = habits.find(h => h.id === id);
    if (h) toast(h.done ? `${h.name} unchecked` : `${h.name} done ✓`);
    await load();
  };

  const calPct    = calorieTarget > 0 ? (calories / calorieTarget) * 100 : 0;
  const habitDone = habits.filter(h => h.done).length;
  const habitPct  = habits.length > 0 ? (habitDone / habits.length) * 100 : 0;
  const score     = calcScore(calPct, habitPct, workoutsToday > 0, medDone);
  const nextAction = getNextAction(calPct, habitPct, workoutsToday > 0, medDone, calorieTarget, calories);
  const allDone   = calPct >= 85 && habitPct >= 100 && workoutsToday > 0 && medDone;

  if (loading) return <DashboardSkeleton />;

  return (
    <>
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4.5rem', paddingBottom: '6rem' }}>

        {/* ════════════════════════════════════════════════════════════════════
            ZONE 1 — COMMAND BAR
            Score + 4 tappable segment bars
        ════════════════════════════════════════════════════════════════════ */}
        <div style={{ padding: '0 16px 24px', borderBottom: '1px solid var(--border)' }}>

          {/* Date */}
          <p className="label" style={{ marginBottom: 20 }}>{dateStr}</p>

          {/* Score hero */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 'clamp(5rem, 26vw, 9rem)',
              fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 0.9,
              color: 'var(--text)',
              fontFeatureSettings: '"cv01" on, "ss03" on, "zero" on',
            }}>
              {score}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 510, letterSpacing: '-0.011em', color: allDone ? 'var(--accent)' : 'var(--text)' }}>
                {allDone ? '🎯 Perfect day' : scoreLabel(score)}
              </span>
              <span className="label">/ 100</span>
            </div>
          </div>

          {/* 4 tappable segment bars */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <Segment label="Eat"    val={Math.min(calPct, 100)}   path="/nutrition" />
            <Segment label="Habits" val={Math.min(habitPct, 100)} path="/habits" />
            <Segment label="Move"   val={workoutsToday > 0 ? 100 : 0} path="/fitness" />
            <Segment label="Mind"   val={medDone ? 100 : 0}       path="/meditation" />
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            ZONE 2 — ACTION SURFACE
            Contextual nudge card + 2×2 metrics
        ════════════════════════════════════════════════════════════════════ */}

        {/* Next action nudge */}
        {nextAction && !allDone && (
          <button
            onClick={() => { haptic('light'); router.push(nextAction.path); }}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              width: '100%', padding: '14px 16px',
              background: 'rgba(228,242,34,0.06)',
              borderBottom: '1px solid rgba(228,242,34,0.15)',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div>
              <p style={{ fontSize: 14, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--accent)', margin: '0 0 2px' }}>
                {nextAction.label}
              </p>
              <p style={{ fontSize: 12, color: 'var(--color-fog)', margin: 0, letterSpacing: '-0.01em' }}>
                {nextAction.sub}
              </p>
            </div>
            <span style={{
              fontSize: 12, fontWeight: 510, letterSpacing: '-0.01em',
              color: 'var(--accent)', flexShrink: 0, marginLeft: 12,
            }}>
              {nextAction.cta}
            </span>
          </button>
        )}

        {/* All done celebration */}
        {allDone && (
          <div style={{
            padding: '14px 16px',
            background: 'rgba(228,242,34,0.06)',
            borderBottom: '1px solid rgba(228,242,34,0.15)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--accent)', margin: '0 0 2px' }}>
              Perfect day 🎯
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-fog)', margin: 0 }}>
              All four pillars complete
            </p>
          </div>
        )}

        {/* 2×2 metric grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--border)' }}>
          <div style={{ borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            <MetricCell
              label="Calories"
              value={calories.toLocaleString()}
              sub={`/ ${calorieTarget.toLocaleString()} target`}
              pct={calPct}
              active={calPct >= 85}
              onClick={() => router.push('/nutrition')}
            />
          </div>
          <div style={{ borderBottom: '1px solid var(--border)' }}>
            <MetricCell
              label="Habits"
              value={`${habitDone}/${habits.length}`}
              sub={habits.length > 0 ? `${Math.round(habitPct)}% done` : 'none set'}
              pct={habitPct}
              active={habitPct >= 100}
              onClick={() => router.push('/habits')}
            />
          </div>
          <div style={{ borderRight: '1px solid var(--border)' }}>
            <MetricCell
              label="Workouts"
              value={workoutsToday > 0 ? String(workoutsToday) : '—'}
              sub="today"
              active={workoutsToday > 0}
              onClick={() => router.push('/fitness')}
            />
          </div>
          <div>
            <MetricCell
              label="Meditation"
              value={medDone ? '✓' : '—'}
              sub={medDone ? 'done' : 'not yet'}
              active={medDone}
              onClick={() => router.push('/meditation')}
            />
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            ZONE 3 — STATUS LIST
            Habits checklist + meditation suggestion
        ════════════════════════════════════════════════════════════════════ */}

        {/* Habits */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
          }}>
            <p style={{ fontSize: 13, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text-2)', margin: 0 }}>
              Habits
            </p>
            <button
              onClick={() => { haptic('light'); router.push('/habits'); }}
              style={{ fontSize: 12, color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '-0.01em' }}
            >
              Manage →
            </button>
          </div>

          {habits.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-4)', marginBottom: 12, letterSpacing: '-0.011em' }}>No habits yet</p>
              <button
                onClick={() => router.push('/habits')}
                className="btn btn-primary btn-sm"
              >
                Add your first →
              </button>
            </div>
          ) : habits.map(h => (
            <button
              key={h.id}
              onClick={() => toggle(h.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                width: '100%', padding: '16px',  // bigger tap target
                background: h.done ? 'rgba(255,255,255,0.02)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                borderLeft: h.done ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer', textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              {/* Checkbox — larger: 22px */}
              <div style={{
                width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                border: `1px solid ${h.done ? 'var(--accent)' : 'var(--border-2)'}`,
                background: h.done ? 'var(--accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {h.done && <span style={{ fontSize: 11, color: 'var(--accent-fg)', fontWeight: 510, lineHeight: 1 }}>✓</span>}
              </div>

              <span style={{
                flex: 1, fontSize: 15, fontWeight: 400, letterSpacing: '-0.011em',
                color: h.done ? 'var(--text-4)' : 'var(--text-2)',
                textDecoration: h.done ? 'line-through' : 'none',
                transition: 'color 0.15s',
              }}>
                {h.name}
              </span>

              {h.streak > 1 && (
                <span className="badge">{h.streak}d 🔥</span>
              )}
            </button>
          ))}
        </div>

        {/* Suggested meditation */}
        {suggested && !medDone && (
          <div style={{ borderBottom: '1px solid var(--border)' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', borderBottom: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: 13, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text-2)', margin: 0 }}>Suggested</p>
              <span className="label">{suggested.duration_min} min</span>
            </div>
            <button
              onClick={() => { haptic('light'); router.push(`/meditation/${suggested.id}`); }}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '16px',
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div>
                <p style={{ margin: '0 0 4px', fontWeight: 510, fontSize: 17, letterSpacing: '-0.011em', color: 'var(--text)' }}>
                  {suggested.name}
                </p>
                <p className="label">{suggested.category}</p>
              </div>
              <span className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>Start →</span>
            </button>
          </div>
        )}

      </div>

      {/* ── Floating acid-lime log button ── */}
      <button
        onClick={() => { haptic('medium'); setQuickLog(true); }}
        style={{
          position: 'fixed', bottom: 72, right: 16,
          zIndex: 200,
          width: 52, height: 52,
          borderRadius: '50%',
          background: 'var(--accent)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(228,242,34,0.35), var(--shadow-xl)',
          fontSize: 22, color: 'var(--accent-fg)',
          fontWeight: 300, lineHeight: 1,
          transition: 'transform 0.15s, box-shadow 0.15s',
          WebkitTapHighlightColor: 'transparent',
        }}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.93)')}
        onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        +
      </button>

      {/* Quick log sheet */}
      <QuickLogSheet
        open={quickLog}
        onClose={() => setQuickLog(false)}
        onLogged={() => load()}
      />
    </>
  );
}
