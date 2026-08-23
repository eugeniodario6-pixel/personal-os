'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getLiftSetup, upsertLiftSetup, getTrainingWeek, getCurrentTrainingWeek,
  getTrainingSessions, createTrainingSession, addStrengthSets, getExercises,
  calcPrescribedWeight, addWorkoutLog, getExercisePRs, getRecentSetsForExercise,
  type LiftSetup, type TrainingWeek, type TrainingSession, type StrengthSet, type Exercise,
  type ExercisePR, type RecentSet,
} from '@/lib/db';
import { haptic } from '@/lib/haptic';
import { ScoreRing } from '@/components/ScoreRing';

// ─── Constants ────────────────────────────────────────────────────────────────
const LIFTS = [
  { key: 'Back Squat',     increment: 2.5, exerciseId: 'EX001' },
  { key: 'Bench Press',    increment: 2.5, exerciseId: 'EX002' },
  { key: 'Deadlift',       increment: 5.0, exerciseId: 'EX003' },
  { key: 'Overhead Press', increment: 2.5, exerciseId: 'EX009' },
  { key: 'Barbell Row',    increment: 2.5, exerciseId: 'EX010' },
];

const SESSION_TYPES = ['strength', 'cardio', 'boxing', 'agility'] as const;
type SessionType = typeof SESSION_TYPES[number];

const SESSION_META: Record<SessionType, { label: string; sub: (plan: TrainingWeek | null) => string }> = {
  strength: { label: 'STRENGTH',     sub: p => p?.strength_prescription ?? '' },
  cardio:   { label: 'CARDIO',       sub: p => p?.cardio_protocol ?? 'CARDIAC OUTPUT' },
  boxing:   { label: 'PAD & BOXING', sub: p => p?.boxing_focus ?? 'SINGLES: JAB, CROSS, HOOK' },
  agility:  { label: 'AGILITY / BW', sub: p => p?.agility_focus ?? 'LADDER + CONES, STANDARD' },
};

interface SetEntry { actual_weight: string; reps: string; rpe: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parsePrescription(p: string) {
  const m = p.match(/^(\d+)x(.+)/);
  return m ? { sets: parseInt(m[1]), reps: m[2] } : { sets: 3, reps: '5' };
}

function todayLabel() {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const d = new Date();
  return `${days[d.getDay()].toUpperCase()} · ${d.getDate()} ${d.toLocaleString('en', { month: 'short' }).toUpperCase()}`;
}

function suggestedSession(sessions: TrainingSession[]): SessionType {
  const done = new Set(sessions.map(s => s.session_type));
  return SESSION_TYPES.find(t => !done.has(t)) ?? 'strength';
}

// ─── Exercise Card ────────────────────────────────────────────────────────────
function ExerciseCard({ ex, prescribed, pr, lastSet, currentWeight, children }: {
  ex: Exercise; prescribed?: number | null;
  pr?: ExercisePR | null;
  lastSet?: RecentSet | null;
  currentWeight?: number | null;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', padding: '16px 20px', gap: '0.75rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' as const }}>
            <p style={{ margin: 0, fontWeight: 600, color: '#fff', fontSize: '0.875rem', letterSpacing: '-0.011em' }}>
              {ex.name.toUpperCase()}
            </p>
            {prescribed != null && (
              <span style={{
                fontFamily: 'inherit', fontSize: '0.6rem', letterSpacing: '0.04em',
                color: '#fff', background: 'rgba(255,255,255,0.06)',
                padding: '0.15rem 0.4rem', borderRadius: 8,
              }}>
                {prescribed} KG
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
              {ex.primary_target}
            </span>
            <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)' }}>·</span>
            <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
              {ex.equipment}
            </span>
          </div>
          {/* PR + LAST badges */}
          {(pr || lastSet) && (
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' as const }}>
              {pr && (
                <span style={{
                  fontFamily: 'inherit', fontSize: '0.6rem', letterSpacing: '0.04em',
                  color: 'rgba(255,255,255,0.50)', background: 'var(--color-carbon)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  padding: '0.2rem 0.5rem', borderRadius: 8,
                }}>
                  BEST: {pr.actual_weight}kg × {pr.reps}
                </span>
              )}
              {lastSet && lastSet.actual_weight != null && lastSet.reps != null && (
                <span style={{
                  fontFamily: 'inherit', fontSize: '0.6rem', letterSpacing: '0.04em',
                  color: 'rgba(255,255,255,0.35)', background: 'var(--color-carbon)',
                  border: 'none',
                  padding: '0.2rem 0.5rem', borderRadius: 8,
                }}>
                  LAST: {lastSet.actual_weight}kg × {lastSet.reps}
                </span>
              )}
              {pr && currentWeight != null && currentWeight > pr.actual_weight && (
                <span style={{
                  fontFamily: 'inherit', fontSize: '0.6rem', letterSpacing: '0.04em',
                  color: '#a3e635', fontWeight: 600,
                  padding: '0.2rem 0.5rem', borderRadius: 8,
                  background: 'rgba(31,88,242,0.15)', border: 'none',
                }}>
                  🏆 NEW PR
                </span>
              )}
            </div>
          )}
        </div>
        <button onClick={() => setOpen(o => !o)}
          style={{
            background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10,
            padding: '0.35rem 0.6rem', fontSize: '0.55rem', letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.50)', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
            fontWeight: 600,
          }}>
          {open ? 'LESS' : 'HOW TO'}
        </button>
      </div>
      {open && (
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {ex.cues && (
            <div style={{
              background: 'var(--color-carbon)', borderRadius: 10,
              padding: '0.75rem 1rem', borderLeft: '2px solid var(--c-400)',
            }}>
              <p style={{ margin: '0 0 0.35rem', fontSize: '0.55rem', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', fontFamily: 'inherit' }}>CUES</p>
              <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)' }}>{ex.cues}</p>
            </div>
          )}
          {ex.how_to && (
            <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.50)' }}>{ex.how_to}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
const label = (text: string) => (
  <p style={{ margin: '0 0 0.25rem', fontSize: '0.55rem', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', fontFamily: 'inherit' }}>
    {text}
  </p>
);

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10,
      padding: '0.45rem 0.75rem', fontSize: '0.6rem', letterSpacing: '0.08em',
      color: 'rgba(255,255,255,0.50)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
    }}>
      ← BACK
    </button>
  );
}

function CompleteBtn({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <button onClick={onClick} disabled={saving} style={{
      width: '100%', background: 'transparent', color: '#fff',
      border: 'none', borderRadius: 16, padding: '1rem',
      fontSize: 15, fontWeight: 700,
      cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
      opacity: saving ? 0.5 : 1,
    }}>
      {saving ? 'SAVING…' : 'COMPLETE SESSION ✓'}
    </button>
  );
}

function Input({ value, onChange, placeholder, type = 'text', min, max, step }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; min?: number; max?: number; step?: number;
}) {
  return (
    <input
      type={type} value={value} placeholder={placeholder}
      min={min} max={max} step={step}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', background: 'var(--color-carbon)', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.80), 0 4px 12px rgba(0,0,0,0.40)',
        borderRadius: 10, padding: '0.55rem 0.75rem',
        color: '#fff', fontSize: '0.875rem', fontFamily: 'inherit',
        outline: 'none', boxSizing: 'border-box',
      }}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState(getCurrentTrainingWeek());
  const [plan, setPlan] = useState<TrainingWeek | null>(null);
  const [lifts, setLifts] = useState<LiftSetup[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [activeSession, setActiveSession] = useState<SessionType | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exercisePRs, setExercisePRs] = useState<Map<string, ExercisePR>>(new Map());
  const [recentSets, setRecentSets] = useState<Map<string, RecentSet | null>>(new Map());

  const [setupWeights, setSetupWeights] = useState<Record<string, string>>(
    Object.fromEntries(LIFTS.map(l => [l.key, '']))
  );
  const [sets, setSets] = useState<Record<string, SetEntry[]>>({});
  const [sessionRPE, setSessionRPE] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [simpleFields, setSimpleFields] = useState({
    duration: '', rpe: '', hr: '', notes: '',
    shadowRounds: '', bagRounds: '',
    ladder: false, cones: false,
    pushUps: '', bwSquats: '', lunges: '', plankSec: '', pullUps: '',
  });
  const sf = (k: string, v: string | boolean) => setSimpleFields(p => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    const exerciseNames = LIFTS.map(l => l.key);
    const [planData, liftData, sessionData, exData, prData] = await Promise.all([
      getTrainingWeek(week), getLiftSetup(), getTrainingSessions(week), getExercises(),
      getExercisePRs(exerciseNames),
    ]);
    setPlan(planData);
    setLifts(liftData);
    setSessions(sessionData);
    setExercises(exData);
    setExercisePRs(prData);
    setLoading(false);
  }, [week]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (activeSession !== 'strength' || !plan) return;
    const { sets: cnt } = parsePrescription(plan.strength_prescription);
    const newSets: Record<string, SetEntry[]> = {};
    LIFTS.forEach(l => {
      const pw = getPrescribedWeight(l.key);
      newSets[l.key] = Array.from({ length: cnt }, () => ({
        actual_weight: pw?.toString() ?? '', reps: '', rpe: '',
      }));
    });
    setSets(newSets);
    setSessionRPE('');
    setSessionNotes('');
    // Load most recent set for each lift
    Promise.all(
      LIFTS.map(l => getRecentSetsForExercise(l.key, 1).then(rows => [l.key, rows[0] ?? null] as [string, RecentSet | null]))
    ).then(entries => setRecentSets(new Map(entries)));
  }, [activeSession]);

  const hasSetup = lifts.length > 0;

  function getPrescribedWeight(liftName: string): number | null {
    if (!plan) return null;
    const lift = lifts.find(l => l.lift === liftName);
    if (!lift) return null;
    return calcPrescribedWeight(lift, plan);
  }

  function getExerciseByName(name: string): Exercise | undefined {
    return exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
  }

  function sessionDone(type: string) {
    return sessions.some(s => s.session_type === type);
  }

  const handleSetupSave = async () => {
    haptic('medium');
    await upsertLiftSetup(LIFTS.map(l => ({
      lift: l.key,
      start_weight: parseFloat(setupWeights[l.key]) || 20,
      weekly_increment: l.increment,
      working_max: null,
    })));
    await load();
    setShowSetup(false);
  };

  const handleStrengthLog = async () => {
    setSaving(true); haptic('medium');
    try {
      const sessionId = await createTrainingSession({
        week, session_type: 'strength',
        date: new Date().toISOString().split('T')[0],
        rpe: parseFloat(sessionRPE) || null,
        notes: sessionNotes || null,
      });
      const allSets: Omit<StrengthSet, 'id'>[] = [];
      LIFTS.forEach(l => {
        (sets[l.key] ?? []).forEach((s, idx) => {
          if (!s.actual_weight && !s.reps) return;
          allSets.push({
            session_id: sessionId, exercise_id: l.exerciseId,
            exercise_name: l.key, set_number: idx + 1,
            prescribed_weight: getPrescribedWeight(l.key),
            actual_weight: parseFloat(s.actual_weight) || null,
            reps: parseInt(s.reps) || null,
            rpe: parseFloat(s.rpe) || null, notes: null,
          });
        });
      });
      if (allSets.length > 0) await addStrengthSets(allSets);
      // Write to workout_log so dashboard + progress page reflect it
      await addWorkoutLog({
        date: new Date().toISOString().split('T')[0],
        template_id: null, name: 'Strength',
        duration_min: 60, intensity: 'high',
        calories_burned: null, source: 'manual',
        logged_at: new Date().toISOString(),
      });
      await load(); setActiveSession(null);
    } finally { setSaving(false); }
  };

  const handleSimpleLog = async (type: SessionType) => {
    setSaving(true); haptic('medium');
    const f = simpleFields;
    let notes = '';
    if (type === 'cardio') {
      notes = [f.duration && `${f.duration} min`, f.hr && `HR ${f.hr} bpm`, f.notes].filter(Boolean).join(' · ');
    } else if (type === 'boxing') {
      notes = [f.shadowRounds && `Shadow: ${f.shadowRounds} rounds`, f.bagRounds && `Bag: ${f.bagRounds} rounds`, f.notes].filter(Boolean).join(' · ');
    } else {
      notes = [
        f.ladder && 'Ladder ✓', f.cones && 'Cones ✓',
        f.pushUps && `Push-ups: ${f.pushUps}`, f.bwSquats && `Squats: ${f.bwSquats}`,
        f.lunges && `Lunges: ${f.lunges}`, f.plankSec && `Plank: ${f.plankSec}s`,
        f.pullUps && `Pull-ups: ${f.pullUps}`, f.notes,
      ].filter(Boolean).join(' · ');
    }
    try {
      await createTrainingSession({
        week, session_type: type,
        date: new Date().toISOString().split('T')[0],
        rpe: parseFloat(f.rpe) || null,
        notes: notes || null,
      });
      // Write to workout_log so dashboard + progress page reflect it
      const sessionLabel: Record<SessionType, string> = {
        strength: 'Strength', cardio: 'Cardio',
        boxing: 'Boxing', agility: 'Agility',
      };
      await addWorkoutLog({
        date: new Date().toISOString().split('T')[0],
        template_id: null, name: sessionLabel[type],
        duration_min: parseInt(f.duration) || 60,
        intensity: 'high', calories_burned: null,
        source: 'manual', logged_at: new Date().toISOString(),
      });
      setSimpleFields({ duration: '', rpe: '', hr: '', notes: '', shadowRounds: '', bagRounds: '', ladder: false, cones: false, pushUps: '', bwSquats: '', lunges: '', plankSec: '', pullUps: '' });
      await load(); setActiveSession(null);
    } finally { setSaving(false); }
  };

  const { sets: prescribedSets, reps: prescribedReps } = plan
    ? parsePrescription(plan.strength_prescription) : { sets: 3, reps: '5' };

  // ── SETUP ──────────────────────────────────────────────────────────────────
  if (!hasSetup || showSetup) return (
    <div style={{ minHeight: '100dvh', background: '#000', paddingTop: '4.5rem', paddingBottom: '6rem' }}>
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
              Programme setup
            </p>
            <h1 style={{ margin: 0, fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1 }}>
              Starting Weights
            </h1>
          </div>
          {hasSetup && <BackBtn onClick={() => setShowSetup(false)} />}
        </div>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
          Weight you can lift for 5 clean reps today. Programme auto-calculates from here.
        </p>
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ background: 'var(--color-carbon)', borderRadius: 20, border: 'none', overflow: 'hidden', marginBottom: 12 }}>
          {LIFTS.map((l, idx) => {
            const ex = getExerciseByName(l.key);
            return (
              <div key={l.key} style={{ padding: '16px 20px', borderBottom: idx < LIFTS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 15, letterSpacing: '-0.015em', color: '#fff' }}>
                      {l.key}
                    </p>
                    {ex && (
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                        {ex.primary_target} · {ex.equipment}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', letterSpacing: '0.06em' }}>+{l.increment}kg/wk</span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Input
                    type="number" value={setupWeights[l.key]}
                    onChange={v => setSetupWeights(w => ({ ...w, [l.key]: v }))}
                    placeholder="e.g. 60"
                  />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)', flexShrink: 0, fontWeight: 600 }}>kg</span>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={handleSetupSave} style={{
          width: '100%', background: '#fff', color: '#000',
          border: 'none', borderRadius: 99, padding: 16,
          fontSize: 15, fontWeight: 700, cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}>
          {hasSetup ? 'Update weights' : 'Start programme →'}
        </button>
      </div>
    </div>
  );

  // ── STRENGTH SESSION ───────────────────────────────────────────────────────
  if (activeSession === 'strength') return (
    <div style={{ minHeight: '100dvh', background: '#000', paddingTop: '4.5rem', paddingBottom: '6rem' }}>
      <div style={{ padding: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
            Week {week} · {plan?.phase}
          </p>
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1 }}>
            Strength
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            {plan?.strength_prescription} — {prescribedReps} reps/set
          </p>
        </div>
        <BackBtn onClick={() => setActiveSession(null)} />
      </div>

      <div style={{ marginTop: '20px' }}>
        {LIFTS.map(l => {
          const ex = getExerciseByName(l.key);
          const pw = getPrescribedWeight(l.key);
          const liftSets = sets[l.key] ?? [];
          const liftPR = exercisePRs.get(l.key) ?? null;
          const liftLastSet = recentSets.get(l.key) ?? null;
          // highest weight entered in today's sets for this lift
          const todayMaxWeight = liftSets.reduce<number | null>((max, s) => {
            const w = parseFloat(s.actual_weight);
            if (isNaN(w)) return max;
            return max == null ? w : Math.max(max, w);
          }, null);
          return (
            <div key={l.key}>
              {ex
                ? <ExerciseCard ex={ex} prescribed={pw} pr={liftPR} lastSet={liftLastSet} currentWeight={todayMaxWeight}>
                    <div style={{ padding: '0 20px 20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.5rem 1fr 1fr 1fr', gap: '0.4rem', marginBottom: '0.35rem' }}>
                        <span />
                        {['WEIGHT (KG)', 'REPS', 'RPE'].map(h => (
                          <span key={h} style={{ fontSize: '0.5rem', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.25)', fontFamily: 'inherit' }}>{h}</span>
                        ))}
                      </div>
                      {liftSets.map((s, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5rem 1fr 1fr 1fr', gap: '0.4rem', marginBottom: '0.35rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'inherit' }}>S{idx + 1}</span>
                          {(['actual_weight', 'reps', 'rpe'] as const).map(field => (
                            <input key={field} type="number"
                              value={s[field]}
                              placeholder={field === 'rpe' ? '1-10' : field === 'reps' ? prescribedReps : (pw?.toString() ?? '')}
                              min={field === 'rpe' ? 1 : 0}
                              max={field === 'rpe' ? 10 : undefined}
                              step={field === 'rpe' ? 0.5 : 1}
                              onChange={e => setSets(prev => {
                                const u = [...(prev[l.key] ?? [])];
                                u[idx] = { ...u[idx], [field]: e.target.value };
                                return { ...prev, [l.key]: u };
                              })}
                              style={{
                                background: 'var(--color-carbon)', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.80), 0 4px 12px rgba(0,0,0,0.40)',
                                borderRadius: 8, padding: '0.4rem 0.5rem',
                                color: '#fff', fontSize: '0.8rem', fontFamily: 'inherit',
                                outline: 'none', width: '100%', boxSizing: 'border-box',
                              }}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </ExerciseCard>
                : (
                  <div style={{ padding: '14px 20px', borderBottom: 'none' }}>
                    <p style={{ margin: 0, fontWeight: 600, color: '#fff', fontSize: '0.875rem' }}>{l.key.toUpperCase()}</p>
                  </div>
                )
              }
            </div>
          );
        })}
      </div>

      <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            {label('SESSION RPE')}
            <Input type="number" value={sessionRPE} onChange={setSessionRPE} placeholder="7" min={1} max={10} step={0.5} />
          </div>
          <div>
            {label('NOTES')}
            <Input value={sessionNotes} onChange={setSessionNotes} placeholder="Optional" />
          </div>
        </div>
        <CompleteBtn onClick={handleStrengthLog} saving={saving} />
      </div>
    </div>
  );

  // ── CARDIO SESSION ─────────────────────────────────────────────────────────
  if (activeSession === 'cardio') {
    const protocolEx = exercises.find(e =>
      e.name.toLowerCase().includes((plan?.cardio_protocol ?? '').toLowerCase().split(' ')[0])
    );
    return (
      <div style={{ minHeight: '100dvh', background: '#000', paddingTop: '4.5rem', paddingBottom: '6rem' }}>
        <div style={{ padding: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
              WEEK {week} · {plan?.phase?.toUpperCase()}
            </p>
            <h1 style={{ margin: 0, fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1 }}>
              CARDIO
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
              {plan?.cardio_protocol?.toUpperCase()}
            </p>
          </div>
          <BackBtn onClick={() => setActiveSession(null)} />
        </div>

        <div style={{ margin: '20px', background: 'var(--color-carbon)', borderRadius: 16, padding: '16px 20px' }}>
          {label('PRESCRIBED')}
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#fff', lineHeight: 1.5 }}>
            {plan?.cardio_detail}
          </p>
        </div>

        {protocolEx && <ExerciseCard ex={protocolEx} />}

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>{label('DURATION (MIN)')}<Input type="number" value={simpleFields.duration} onChange={v => sf('duration', v)} placeholder="30" /></div>
            <div>{label('AVG HEART RATE')}<Input type="number" value={simpleFields.hr} onChange={v => sf('hr', v)} placeholder="135" /></div>
          </div>
          <div>{label('RPE')}<Input type="number" value={simpleFields.rpe} onChange={v => sf('rpe', v)} placeholder="6" min={1} max={10} step={0.5} /></div>
          <div>{label('NOTES')}<Input value={simpleFields.notes} onChange={v => sf('notes', v)} placeholder="Optional" /></div>
          <CompleteBtn onClick={() => handleSimpleLog('cardio')} saving={saving} />
        </div>
      </div>
    );
  }

  // ── BOXING SESSION ─────────────────────────────────────────────────────────
  if (activeSession === 'boxing') {
    const shadowEx = getExerciseByName('Shadowboxing');
    const bagEx = getExerciseByName('Heavy Bag Work');
    return (
      <div style={{ minHeight: '100dvh', background: '#000', paddingTop: '4.5rem', paddingBottom: '6rem' }}>
        <div style={{ padding: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
              WEEK {week} · {plan?.phase?.toUpperCase()}
            </p>
            <h1 style={{ margin: 0, fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1 }}>
              PAD & BOXING
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
              {plan?.boxing_focus}
            </p>
          </div>
          <BackBtn onClick={() => setActiveSession(null)} />
        </div>
        {shadowEx && <ExerciseCard ex={shadowEx} />}
        {bagEx && <ExerciseCard ex={bagEx} />}
        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>{label('SHADOW (ROUNDS)')}<Input type="number" value={simpleFields.shadowRounds} onChange={v => sf('shadowRounds', v)} placeholder="3" /></div>
            <div>{label('BAG (ROUNDS)')}<Input type="number" value={simpleFields.bagRounds} onChange={v => sf('bagRounds', v)} placeholder="3" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>{label('RPE')}<Input type="number" value={simpleFields.rpe} onChange={v => sf('rpe', v)} placeholder="7" min={1} max={10} step={0.5} /></div>
            <div>{label('NOTES')}<Input value={simpleFields.notes} onChange={v => sf('notes', v)} placeholder="Optional" /></div>
          </div>
          <CompleteBtn onClick={() => handleSimpleLog('boxing')} saving={saving} />
        </div>
      </div>
    );
  }

  // ── AGILITY SESSION ────────────────────────────────────────────────────────
  if (activeSession === 'agility') {
    const agilityExs = exercises.filter(e => ['Agility', 'Bodyweight', 'Flexibility'].includes(e.type)).slice(0, 5);
    return (
      <div style={{ minHeight: '100dvh', background: '#000', paddingTop: '4.5rem', paddingBottom: '6rem' }}>
        <div style={{ padding: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
              WEEK {week} · {plan?.phase?.toUpperCase()}
            </p>
            <h1 style={{ margin: 0, fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1 }}>
              AGILITY / BW
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
              {plan?.agility_focus}
            </p>
          </div>
          <BackBtn onClick={() => setActiveSession(null)} />
        </div>
        {agilityExs.map(ex => <ExerciseCard key={ex.id} ex={ex} />)}
        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {[['LADDER', 'ladder'], ['CONES', 'cones']].map(([lbl, key]) => (
              <button key={key} onClick={() => sf(key, !(simpleFields[key as keyof typeof simpleFields]))}
                style={{
                  background: simpleFields[key as keyof typeof simpleFields] ? 'rgba(31,88,242,0.15)' : 'rgba(255,255,255,0.06)',
                  color: simpleFields[key as keyof typeof simpleFields] ? '#1f58f2' : 'rgba(255,255,255,0.50)',
                  border: 'none', borderRadius: 10,
                  padding: '0.6rem', fontSize: '0.65rem', letterSpacing: '0.06em',
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {simpleFields[key as keyof typeof simpleFields] ? '✓ ' : ''}{lbl}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {[['PUSH-UPS', 'pushUps'], ['BW SQUATS', 'bwSquats'], ['LUNGES', 'lunges'],
              ['PLANK (SEC)', 'plankSec'], ['PULL-UPS', 'pullUps'], ['RPE', 'rpe']].map(([lbl, key]) => (
              <div key={key}>
                <p style={{ margin: '0 0 0.2rem', fontSize: '0.5rem', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.35)', fontFamily: 'inherit' }}>{lbl}</p>
                <input type="number" value={simpleFields[key as keyof typeof simpleFields] as string}
                  onChange={e => sf(key, e.target.value)}
                  style={{
                    width: '100%', background: 'var(--color-carbon)', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.80), 0 4px 12px rgba(0,0,0,0.40)',
                    borderRadius: 8, padding: '0.4rem 0.5rem',
                    color: '#fff', fontSize: '0.8rem', fontFamily: 'inherit',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>
          <div>{label('NOTES')}<Input value={simpleFields.notes} onChange={v => sf('notes', v)} placeholder="Optional" /></div>
          <CompleteBtn onClick={() => handleSimpleLog('agility')} saving={saving} />
        </div>
      </div>
    );
  }

  // ── PLAN OVERVIEW ──────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: '0.65rem', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', fontFamily: 'inherit' }}>LOADING…</p>
    </div>
  );

  const nextSession = suggestedSession(sessions);
  const currentWeek = getCurrentTrainingWeek();
  const score = Math.min(100, Math.round((sessions.length / 4) * 100));

  return (
    <div style={{ minHeight: '100dvh', background: '#000', paddingTop: '4.5rem', paddingBottom: '6rem' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 11, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase' }}>
              {todayLabel()}
            </p>
            <h1 style={{ margin: 0, fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1 }}>
              Training
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => router.push('/fitness/exercises')}
              style={{
                background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 99,
                padding: '8px 14px', fontSize: 12, fontWeight: 600,
                color: 'rgba(255,255,255,0.70)', cursor: 'pointer',
              }}>
              Library
            </button>
            <button onClick={() => setShowSetup(true)}
              style={{
                background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 99,
                padding: '8px 14px', fontSize: 12, fontWeight: 600,
                color: 'rgba(255,255,255,0.70)', cursor: 'pointer',
              }}>
              Setup
            </button>
          </div>
        </div>

        {/* ── Week + Phase hero row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: 'var(--color-carbon)', borderRadius: 20, border: 'none', padding: '16px 18px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', fontWeight: 500 }}>Week</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 52, fontWeight: 700, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1 }}>{week}</span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.30)' }}>/ 26</span>
            </div>
            {plan?.phase && (
              <span style={{
                display: 'inline-block', marginTop: 8,
                background: 'rgba(255,255,255,0.08)', borderRadius: 99,
                padding: '4px 10px', fontSize: 10, letterSpacing: '0.08em',
                color: 'rgba(255,255,255,0.60)', textTransform: 'uppercase', fontWeight: 600,
              }}>
                {plan.phase}{plan?.is_deload ? ' · DELOAD' : ''}
              </span>
            )}
          </div>
          <div style={{ background: 'var(--color-carbon)', borderRadius: 20, border: 'none', padding: '16px 18px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', fontWeight: 500 }}>Sessions</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 52, fontWeight: 700, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1 }}>{sessions.length}</span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.30)' }}>/ 4</span>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden', marginTop: 12 }}>
              <div style={{ height: '100%', width: `${score}%`, background: '#fff', borderRadius: 99, transition: 'width 0.8s' }} />
            </div>
          </div>
        </div>

        {/* ── Lift weight strip ── */}
        {plan && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
            background: 'var(--color-carbon)', borderRadius: 20,
            border: 'none',
            overflow: 'hidden', marginBottom: '16px',
          }}>
            {LIFTS.map((l, i) => {
              const pw = getPrescribedWeight(l.key);
              return (
                <div key={l.key} style={{
                  textAlign: 'center', padding: '14px 6px',
                  borderRight: i < LIFTS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  <p style={{ margin: '0 0 6px', fontSize: 9, letterSpacing: '0.10em', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', fontWeight: 500 }}>
                    {l.key.split(' ')[0].slice(0, 4).toUpperCase()}
                  </p>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: pw ? '#fff' : 'rgba(255,255,255,0.25)' }}>
                    {pw ?? '—'}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 9, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.28)' }}>kg</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Up Next banner ── */}
      {!sessionDone(nextSession) && (
        <div style={{ margin: '0 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', fontWeight: 500 }}>Up Next</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.50)', fontWeight: 600 }}>
            {SESSION_META[nextSession].label}
          </span>
        </div>
      )}

      {/* ── Section label ── */}
      <div style={{ padding: '0 16px 8px' }}>
        <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', fontWeight: 500 }}>This week</span>
      </div>

      {/* ── Session list ── */}
      <div style={{ margin: '0 16px', background: 'var(--color-carbon)', borderRadius: 20, border: 'none', overflow: 'hidden' }}>
        {SESSION_TYPES.map((type, idx) => {
          const done = sessionDone(type);
          const meta = SESSION_META[type];
          const isNext = type === nextSession && !done;
          return (
            <button key={type} onClick={() => !done && setActiveSession(type)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '18px 20px',
                background: isNext ? 'rgba(255,255,255,0.04)' : 'transparent',
                border: 'none',
                borderBottom: idx < SESSION_TYPES.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                borderLeft: isNext ? '2px solid rgba(255,255,255,0.60)' : '2px solid transparent',
                cursor: done ? 'default' : 'pointer',
                textAlign: 'left' as const,
              }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.015em', color: done ? 'rgba(255,255,255,0.30)' : '#fff' }}>
                    {meta.label}
                  </span>
                  {done ? (
                    <span style={{ fontSize: 10, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>DONE</span>
                  ) : isNext ? (
                    <span style={{ fontSize: 10, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.60)', background: 'rgba(255,255,255,0.10)', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>TODAY</span>
                  ) : null}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: done ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.40)' }}>
                  {meta.sub(plan)}
                </p>
              </div>
              <span style={{ color: done ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.60)', fontSize: done ? 14 : 18, paddingLeft: '12px' }}>
                {done ? '✓' : '›'}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Week nav ── */}
      <div style={{ margin: '12px 16px 0', display: 'grid', gridTemplateColumns: '1fr auto 1fr', background: 'var(--color-carbon)', borderRadius: 20, border: 'none', overflow: 'hidden' }}>
        <button onClick={() => setWeek(w => Math.max(1, w - 1))}
          disabled={week <= 1}
          style={{
            background: 'none', border: 'none', padding: '14px',
            fontSize: 12, fontWeight: 600,
            color: week > 1 ? 'rgba(255,255,255,0.60)' : 'rgba(255,255,255,0.20)', cursor: week > 1 ? 'pointer' : 'default',
          }}>
          ← Prev
        </button>
        <button onClick={() => setWeek(currentWeek)}
          style={{
            background: 'none', borderLeft: 'none', borderRight: '1px solid rgba(255,255,255,0.06)',
            padding: '14px 16px', fontSize: 12, fontWeight: 700,
            color: 'rgba(255,255,255,0.60)', cursor: 'pointer',
          }}>
          W{currentWeek}
        </button>
        <button onClick={() => setWeek(w => Math.min(26, w + 1))}
          disabled={week >= 26}
          style={{
            background: 'none', border: 'none', padding: '14px',
            fontSize: 12, fontWeight: 600,
            color: week < 26 ? 'rgba(255,255,255,0.60)' : 'rgba(255,255,255,0.20)', cursor: week < 26 ? 'pointer' : 'default',
          }}>
          Next →
        </button>
      </div>

    </div>
  );
}
