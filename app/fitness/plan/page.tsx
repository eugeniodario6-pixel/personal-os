'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getLiftSetup, upsertLiftSetup, getTrainingWeek, getCurrentTrainingWeek,
  getTrainingSessions, createTrainingSession, addStrengthSets, getExercises,
  calcPrescribedWeight,
  type LiftSetup, type TrainingWeek, type TrainingSession, type StrengthSet, type Exercise,
} from '@/lib/db';
import { haptic } from '@/lib/haptic';

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
function ExerciseCard({ ex, prescribed, children }: {
  ex: Exercise; prescribed?: number | null; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', padding: '16px 20px', gap: '0.75rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' as const }}>
            <p style={{ margin: 0, fontWeight: 510, color: 'var(--text)', fontSize: '0.875rem', letterSpacing: '-0.011em' }}>
              {ex.name.toUpperCase()}
            </p>
            {prescribed != null && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.04em',
                color: 'var(--text)', background: 'var(--surface-2)',
                padding: '0.15rem 0.4rem', borderRadius: 'var(--r-xs)',
              }}>
                {prescribed} KG
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.6rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
              {ex.primary_target}
            </span>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-5)' }}>·</span>
            <span style={{ fontSize: '0.6rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
              {ex.equipment}
            </span>
          </div>
        </div>
        <button onClick={() => setOpen(o => !o)}
          style={{
            background: 'var(--surface-2)', border: 'none', borderRadius: 'var(--r-sm)',
            padding: '0.35rem 0.6rem', fontSize: '0.55rem', letterSpacing: '0.08em',
            color: 'var(--text-3)', cursor: 'pointer', flexShrink: 0, fontFamily: 'var(--font)',
            fontWeight: 510,
          }}>
          {open ? 'LESS' : 'HOW TO'}
        </button>
      </div>
      {open && (
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {ex.cues && (
            <div style={{
              background: 'var(--surface)', borderRadius: 'var(--r-sm)',
              padding: '0.75rem 1rem', borderLeft: '2px solid var(--c-400)',
            }}>
              <p style={{ margin: '0 0 0.35rem', fontSize: '0.55rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>CUES</p>
              <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.6, color: 'var(--text-2)' }}>{ex.cues}</p>
            </div>
          )}
          {ex.how_to && (
            <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.7, color: 'var(--text-3)' }}>{ex.how_to}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
const label = (text: string) => (
  <p style={{ margin: '0 0 0.25rem', fontSize: '0.55rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
    {text}
  </p>
);

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: 'var(--surface-2)', border: 'none', borderRadius: 'var(--r-sm)',
      padding: '0.45rem 0.75rem', fontSize: '0.6rem', letterSpacing: '0.08em',
      color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 510,
    }}>
      ← BACK
    </button>
  );
}

function CompleteBtn({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <button onClick={onClick} disabled={saving} style={{
      width: '100%', background: 'var(--cta-bg)', color: 'var(--cta-fg)',
      border: 'none', borderRadius: 'var(--r)', padding: '1rem',
      fontSize: '0.75rem', letterSpacing: '0.08em', fontWeight: 600,
      cursor: saving ? 'default' : 'pointer', fontFamily: 'var(--font)',
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
        width: '100%', background: 'var(--surface)', border: '1px solid var(--border-2)',
        borderRadius: 'var(--r-sm)', padding: '0.55rem 0.75rem',
        color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'var(--font)',
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
    const [planData, liftData, sessionData, exData] = await Promise.all([
      getTrainingWeek(week), getLiftSetup(), getTrainingSessions(week), getExercises(),
    ]);
    setPlan(planData);
    setLifts(liftData);
    setSessions(sessionData);
    setExercises(exData);
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
      setSimpleFields({ duration: '', rpe: '', hr: '', notes: '', shadowRounds: '', bagRounds: '', ladder: false, cones: false, pushUps: '', bwSquats: '', lunges: '', plankSec: '', pullUps: '' });
      await load(); setActiveSession(null);
    } finally { setSaving(false); }
  };

  const { sets: prescribedSets, reps: prescribedReps } = plan
    ? parsePrescription(plan.strength_prescription) : { sets: 3, reps: '5' };

  // ── SETUP ──────────────────────────────────────────────────────────────────
  if (!hasSetup || showSetup) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4rem', paddingBottom: '6rem' }}>
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: '0.6rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
              PROGRAMME SETUP
            </p>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.6rem, 8vw, 2.4rem)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)' }}>
              STARTING WEIGHTS
            </h1>
          </div>
          {hasSetup && <BackBtn onClick={() => setShowSetup(false)} />}
        </div>
        <p style={{ margin: '0 0 24px', fontSize: '0.8rem', color: 'var(--text-3)', lineHeight: 1.5 }}>
          Weight you can lift for 5 clean reps today.<br />Programme auto-calculates from here.
        </p>
      </div>
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '0' }}>
        {LIFTS.map(l => {
          const ex = getExerciseByName(l.key);
          return (
            <div key={l.key} style={{ paddingBottom: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem' }}>
                <p style={{ margin: 0, fontWeight: 510, fontSize: '0.875rem', color: 'var(--text)', letterSpacing: '-0.011em' }}>
                  {l.key.toUpperCase()}
                </p>
                <span style={{ fontSize: '0.55rem', letterSpacing: '0.06em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
                  +{l.increment}kg/wk
                </span>
              </div>
              {ex && (
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.6rem', letterSpacing: '0.06em', color: 'var(--text-5)', fontFamily: 'var(--font-mono)' }}>
                  {ex.primary_target} · {ex.equipment}
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Input
                  type="number" value={setupWeights[l.key]}
                  onChange={v => setSetupWeights(w => ({ ...w, [l.key]: v }))}
                  placeholder="e.g. 60"
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-4)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>KG</span>
              </div>
            </div>
          );
        })}
        <button onClick={handleSetupSave} style={{
          width: '100%', background: 'var(--cta-bg)', color: 'var(--cta-fg)',
          border: 'none', borderRadius: 'var(--r)', padding: '1rem',
          fontSize: '0.75rem', letterSpacing: '0.08em', fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font)', marginTop: '0.5rem',
        }}>
          {hasSetup ? 'UPDATE WEIGHTS' : 'START PROGRAMME →'}
        </button>
      </div>
    </div>
  );

  // ── STRENGTH SESSION ───────────────────────────────────────────────────────
  if (activeSession === 'strength') return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4rem', paddingBottom: '6rem' }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: '0.6rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
            WEEK {week} · {plan?.phase?.toUpperCase()}
          </p>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.6rem, 8vw, 2.4rem)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)' }}>
            STRENGTH
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.65rem', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
            {plan?.strength_prescription} — {prescribedReps} REPS PER SET
          </p>
        </div>
        <BackBtn onClick={() => setActiveSession(null)} />
      </div>

      <div style={{ marginTop: '20px' }}>
        {LIFTS.map(l => {
          const ex = getExerciseByName(l.key);
          const pw = getPrescribedWeight(l.key);
          const liftSets = sets[l.key] ?? [];
          return (
            <div key={l.key}>
              {ex
                ? <ExerciseCard ex={ex} prescribed={pw}>
                    <div style={{ padding: '0 20px 20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.5rem 1fr 1fr 1fr', gap: '0.4rem', marginBottom: '0.35rem' }}>
                        <span />
                        {['WEIGHT (KG)', 'REPS', 'RPE'].map(h => (
                          <span key={h} style={{ fontSize: '0.5rem', letterSpacing: '0.06em', color: 'var(--text-5)', fontFamily: 'var(--font-mono)' }}>{h}</span>
                        ))}
                      </div>
                      {liftSets.map((s, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5rem 1fr 1fr 1fr', gap: '0.4rem', marginBottom: '0.35rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.55rem', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>S{idx + 1}</span>
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
                                background: 'var(--surface)', border: '1px solid var(--border-2)',
                                borderRadius: 'var(--r-xs)', padding: '0.4rem 0.5rem',
                                color: 'var(--text)', fontSize: '0.8rem', fontFamily: 'var(--font)',
                                outline: 'none', width: '100%', boxSizing: 'border-box',
                              }}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </ExerciseCard>
                : (
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                    <p style={{ margin: 0, fontWeight: 510, color: 'var(--text)', fontSize: '0.875rem' }}>{l.key.toUpperCase()}</p>
                  </div>
                )
              }
            </div>
          );
        })}
      </div>

      <div style={{ padding: '20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4rem', paddingBottom: '6rem' }}>
        <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: '0.6rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
              WEEK {week} · {plan?.phase?.toUpperCase()}
            </p>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.6rem, 8vw, 2.4rem)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)' }}>
              CARDIO
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.65rem', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
              {plan?.cardio_protocol?.toUpperCase()}
            </p>
          </div>
          <BackBtn onClick={() => setActiveSession(null)} />
        </div>

        <div style={{ margin: '20px', background: 'var(--surface)', borderRadius: 'var(--r)', padding: '16px 20px' }}>
          {label('PRESCRIBED')}
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 510, color: 'var(--text)', lineHeight: 1.5 }}>
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
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4rem', paddingBottom: '6rem' }}>
        <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: '0.6rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
              WEEK {week} · {plan?.phase?.toUpperCase()}
            </p>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.6rem, 8vw, 2.4rem)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)' }}>
              PAD & BOXING
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.65rem', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
              {plan?.boxing_focus}
            </p>
          </div>
          <BackBtn onClick={() => setActiveSession(null)} />
        </div>
        {shadowEx && <ExerciseCard ex={shadowEx} />}
        {bagEx && <ExerciseCard ex={bagEx} />}
        <div style={{ padding: '20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4rem', paddingBottom: '6rem' }}>
        <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: '0.6rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
              WEEK {week} · {plan?.phase?.toUpperCase()}
            </p>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.6rem, 8vw, 2.4rem)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)' }}>
              AGILITY / BW
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.65rem', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
              {plan?.agility_focus}
            </p>
          </div>
          <BackBtn onClick={() => setActiveSession(null)} />
        </div>
        {agilityExs.map(ex => <ExerciseCard key={ex.id} ex={ex} />)}
        <div style={{ padding: '20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {[['LADDER', 'ladder'], ['CONES', 'cones']].map(([lbl, key]) => (
              <button key={key} onClick={() => sf(key, !(simpleFields[key as keyof typeof simpleFields]))}
                style={{
                  background: simpleFields[key as keyof typeof simpleFields] ? 'var(--cta-bg)' : 'var(--surface)',
                  color: simpleFields[key as keyof typeof simpleFields] ? 'var(--cta-fg)' : 'var(--text-3)',
                  border: '1px solid var(--border-2)', borderRadius: 'var(--r-sm)',
                  padding: '0.6rem', fontSize: '0.65rem', letterSpacing: '0.06em',
                  fontWeight: 510, cursor: 'pointer', fontFamily: 'var(--font)',
                }}>
                {simpleFields[key as keyof typeof simpleFields] ? '✓ ' : ''}{lbl}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {[['PUSH-UPS', 'pushUps'], ['BW SQUATS', 'bwSquats'], ['LUNGES', 'lunges'],
              ['PLANK (SEC)', 'plankSec'], ['PULL-UPS', 'pullUps'], ['RPE', 'rpe']].map(([lbl, key]) => (
              <div key={key}>
                <p style={{ margin: '0 0 0.2rem', fontSize: '0.5rem', letterSpacing: '0.06em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>{lbl}</p>
                <input type="number" value={simpleFields[key as keyof typeof simpleFields] as string}
                  onChange={e => sf(key, e.target.value)}
                  style={{
                    width: '100%', background: 'var(--surface)', border: '1px solid var(--border-2)',
                    borderRadius: 'var(--r-xs)', padding: '0.4rem 0.5rem',
                    color: 'var(--text)', fontSize: '0.8rem', fontFamily: 'var(--font)',
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
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: '0.65rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>LOADING…</p>
    </div>
  );

  const nextSession = suggestedSession(sessions);
  const currentWeek = getCurrentTrainingWeek();

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4rem', paddingBottom: '6rem' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: '0.6rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
              {todayLabel()}
            </p>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 9vw, 2.8rem)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1 }}>
              TRAINING PLAN
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '4px' }}>
            <button onClick={() => router.push('/fitness/exercises')}
              style={{
                background: 'var(--surface-2)', border: 'none', borderRadius: 'var(--r-sm)',
                padding: '0.45rem 0.75rem', fontSize: '0.6rem', letterSpacing: '0.08em',
                color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 510,
              }}>
              LIBRARY
            </button>
            <button onClick={() => setShowSetup(true)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-sm)',
                padding: '0.45rem 0.75rem', fontSize: '0.6rem', letterSpacing: '0.08em',
                color: 'var(--text-4)', cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 510,
              }}>
              SETUP
            </button>
          </div>
        </div>

        {/* ── Week + Phase ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '20px' }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '0.55rem', letterSpacing: '0.08em', color: 'var(--text-5)', fontFamily: 'var(--font-mono)' }}>WEEK</p>
            <p style={{ margin: 0, fontSize: '3.5rem', fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1 }}>{week}</p>
            <p style={{ margin: '2px 0 0', fontSize: '0.55rem', letterSpacing: '0.06em', color: 'var(--text-5)', fontFamily: 'var(--font-mono)' }}>OF 26</p>
          </div>
          <div style={{ paddingBottom: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {plan?.phase && (
              <span style={{
                background: 'var(--surface-2)', borderRadius: 'var(--r-xs)',
                padding: '0.25rem 0.6rem', fontSize: '0.6rem', letterSpacing: '0.08em',
                color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontWeight: 510,
                alignSelf: 'flex-start',
              }}>
                {plan.phase.toUpperCase()}
              </span>
            )}
            {plan?.is_deload && (
              <span style={{
                background: 'var(--surface)', borderRadius: 'var(--r-xs)',
                padding: '0.25rem 0.6rem', fontSize: '0.6rem', letterSpacing: '0.08em',
                color: 'var(--text-5)', fontFamily: 'var(--font-mono)',
                alignSelf: 'flex-start',
              }}>
                DELOAD
              </span>
            )}
          </div>
        </div>

        {/* ── Lift weight strip ── */}
        {plan && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
            background: 'var(--surface)', borderRadius: 'var(--r)',
            overflow: 'hidden', marginBottom: '28px',
            boxShadow: 'var(--ring)',
          }}>
            {LIFTS.map((l, i) => {
              const pw = getPrescribedWeight(l.key);
              return (
                <div key={l.key} style={{
                  textAlign: 'center', padding: '14px 8px',
                  borderRight: i < LIFTS.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <p style={{ margin: '0 0 4px', fontSize: '0.5rem', letterSpacing: '0.06em', color: 'var(--text-5)', fontFamily: 'var(--font-mono)' }}>
                    {l.key.split(' ')[0].slice(0, 5).toUpperCase()}
                  </p>
                  <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: pw ? 'var(--text)' : 'var(--text-5)', fontFamily: 'var(--font-mono)' }}>
                    {pw ?? '—'}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.45rem', letterSpacing: '0.04em', color: 'var(--text-5)', fontFamily: 'var(--font-mono)' }}>KG</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Up Next banner ── */}
      {!sessionDone(nextSession) && (
        <div style={{ margin: '0 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.55rem', letterSpacing: '0.08em', color: 'var(--text-5)', fontFamily: 'var(--font-mono)' }}>UP NEXT</span>
          <span style={{ fontSize: '0.6rem', letterSpacing: '0.06em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontWeight: 510 }}>
            {SESSION_META[nextSession].label}
          </span>
        </div>
      )}

      {/* ── Section label ── */}
      <div style={{ padding: '0 20px 8px' }}>
        <span style={{ fontSize: '0.55rem', letterSpacing: '0.08em', color: 'var(--text-5)', fontFamily: 'var(--font-mono)' }}>THIS WEEK</span>
      </div>

      {/* ── Session list ── */}
      <div style={{ margin: '0 20px', background: 'var(--surface)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--ring)' }}>
        {SESSION_TYPES.map((type, idx) => {
          const done = sessionDone(type);
          const meta = SESSION_META[type];
          const isNext = type === nextSession && !done;
          return (
            <button key={type} onClick={() => !done && setActiveSession(type)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '18px 20px',
                background: isNext ? 'var(--surface-2)' : 'transparent',
                border: 'none',
                borderBottom: idx < SESSION_TYPES.length - 1 ? '1px solid var(--border)' : 'none',
                borderLeft: isNext ? '2px solid var(--c-700)' : '2px solid transparent',
                cursor: done ? 'default' : 'pointer',
                textAlign: 'left' as const,
              }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{
                    fontWeight: 510, fontSize: '0.875rem', letterSpacing: '-0.011em',
                    color: done ? 'var(--text-4)' : 'var(--text)',
                  }}>
                    {meta.label}
                  </span>
                  {done ? (
                    <span style={{
                      fontSize: '0.5rem', letterSpacing: '0.06em', color: 'var(--text-4)',
                      fontFamily: 'var(--font-mono)', background: 'var(--surface-3)',
                      padding: '0.15rem 0.4rem', borderRadius: 'var(--r-xs)',
                    }}>DONE</span>
                  ) : isNext ? (
                    <span style={{
                      fontSize: '0.5rem', letterSpacing: '0.06em', color: 'var(--text-3)',
                      fontFamily: 'var(--font-mono)', background: 'var(--surface-3)',
                      padding: '0.15rem 0.4rem', borderRadius: 'var(--r-xs)',
                    }}>TODAY</span>
                  ) : null}
                </div>
                <p style={{ margin: 0, fontSize: '0.65rem', letterSpacing: '0.04em', color: done ? 'var(--text-5)' : 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
                  {meta.sub(plan)}
                </p>
              </div>
              <span style={{ color: done ? 'var(--text-5)' : 'var(--text-3)', fontSize: done ? '0.75rem' : '1rem', paddingLeft: '12px' }}>
                {done ? '✓' : '→'}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Week nav ── */}
      <div style={{ margin: '16px 20px 0', display: 'grid', gridTemplateColumns: '1fr auto 1fr', background: 'var(--surface)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--ring)' }}>
        <button onClick={() => setWeek(w => Math.max(1, w - 1))}
          disabled={week <= 1}
          style={{
            background: 'none', border: 'none', padding: '0.875rem',
            fontSize: '0.6rem', letterSpacing: '0.06em', fontFamily: 'var(--font)',
            color: week > 1 ? 'var(--text-3)' : 'var(--text-5)', cursor: week > 1 ? 'pointer' : 'default',
          }}>
          ← PREV
        </button>
        <button onClick={() => setWeek(currentWeek)}
          style={{
            background: 'none', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)',
            padding: '0.875rem 1rem', fontSize: '0.6rem', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)',
            color: 'var(--text-4)', cursor: 'pointer',
          }}>
          W{currentWeek}
        </button>
        <button onClick={() => setWeek(w => Math.min(26, w + 1))}
          disabled={week >= 26}
          style={{
            background: 'none', border: 'none', padding: '0.875rem',
            fontSize: '0.6rem', letterSpacing: '0.06em', fontFamily: 'var(--font)',
            color: week < 26 ? 'var(--text-3)' : 'var(--text-5)', cursor: week < 26 ? 'pointer' : 'default',
          }}>
          NEXT →
        </button>
      </div>

    </div>
  );
}
