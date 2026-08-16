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

// ─── Tokens ───────────────────────────────────────────────────────────────────
const MONO = "'IBM Plex Mono', monospace";
const lbl = { fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: '#555', margin: 0 };
const B2 = '2px solid #222';
const B1 = '1px solid #161616';
const BG = '#000';
const SURFACE = '#070707';

const PHASE_COLOR: Record<string, string> = {
  Base: '#4af', Build: '#e8ff00', Camp: '#f70', Taper: '#888',
};

const LIFTS = [
  { key: 'Back Squat',     increment: 2.5, exerciseId: 'EX001' },
  { key: 'Bench Press',    increment: 2.5, exerciseId: 'EX002' },
  { key: 'Deadlift',       increment: 5.0, exerciseId: 'EX003' },
  { key: 'Overhead Press', increment: 2.5, exerciseId: 'EX009' },
  { key: 'Barbell Row',    increment: 2.5, exerciseId: 'EX010' },
];

const SESSION_TYPES = ['strength', 'cardio', 'boxing', 'agility'] as const;
type SessionType = typeof SESSION_TYPES[number];

const SESSION_META: Record<SessionType, { label: string; color: string }> = {
  strength: { label: 'STRENGTH',     color: '#e8ff00' },
  cardio:   { label: 'CARDIO',       color: '#f44'    },
  boxing:   { label: 'PAD & BOXING', color: '#f70'    },
  agility:  { label: 'AGILITY / BW', color: '#4af'    },
};

const inputStyle = {
  width: '100%', fontFamily: MONO, fontSize: '0.875rem',
  background: '#0a0a0a', color: '#fff', border: B2,
  padding: '0.5rem 0.75rem', outline: 'none', boxSizing: 'border-box' as const,
};

interface SetEntry { actual_weight: string; reps: string; rpe: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parsePrescription(p: string) {
  const m = p.match(/^(\d+)x(.+)/);
  return m ? { sets: parseInt(m[1]), reps: m[2] } : { sets: 3, reps: '5' };
}

function todayLabel() {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  return days[new Date().getDay()].toUpperCase();
}

function suggestedSession(sessions: TrainingSession[]): SessionType {
  const done = new Set(sessions.map(s => s.session_type));
  return SESSION_TYPES.find(t => !done.has(t)) ?? 'strength';
}

// ─── Exercise Card — shows name, target, equipment, cues + how-to ─────────────
function ExerciseCard({ ex, prescribed, children }: {
  ex: Exercise; prescribed?: number | null; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: B1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', padding: '0.875rem 1.25rem', gap: '0.75rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' as const }}>
            <p style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '0.875rem', fontFamily: MONO }}>
              {ex.name.toUpperCase()}
            </p>
            {prescribed != null && (
              <span style={{ fontSize: '0.55rem', fontWeight: 700, padding: '0.15rem 0.4rem', background: '#e8ff00', color: '#000', letterSpacing: '0.1em', flexShrink: 0 }}>
                {prescribed} KG
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ ...lbl, color: '#2a2a2a', fontSize: '0.5rem' }}>{ex.primary_target}</span>
            <span style={{ ...lbl, color: '#1e1e1e', fontSize: '0.5rem' }}>{ex.equipment}</span>
          </div>
        </div>
        <button onClick={() => setOpen(o => !o)}
          style={{ background: 'none', border: '1px solid #1e1e1e', color: '#333', fontFamily: MONO, fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.1em', padding: '0.25rem 0.5rem', cursor: 'pointer', flexShrink: 0 }}>
          {open ? 'LESS' : 'HOW TO'}
        </button>
      </div>

      {open && (
        <div style={{ padding: '0 1.25rem 1rem' }}>
          {ex.cues && (
            <div style={{ padding: '0.75rem', background: '#050505', border: '1px solid #0d0d0d', marginBottom: '0.75rem' }}>
              <p style={{ ...lbl, marginBottom: '0.35rem', color: '#e8ff00', fontSize: '0.5rem' }}>CUES</p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#777', fontFamily: MONO, lineHeight: 1.6 }}>{ex.cues}</p>
            </div>
          )}
          {ex.how_to && (
            <p style={{ margin: 0, fontSize: '0.73rem', color: '#444', fontFamily: MONO, lineHeight: 1.7 }}>{ex.how_to}</p>
          )}
        </div>
      )}

      {children}
    </div>
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

  // Setup form
  const [setupWeights, setSetupWeights] = useState<Record<string, string>>(
    Object.fromEntries(LIFTS.map(l => [l.key, '']))
  );

  // Strength log
  const [sets, setSets] = useState<Record<string, SetEntry[]>>({});
  const [sessionRPE, setSessionRPE] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');

  // Simple session log (cardio/boxing/agility)
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
      getTrainingWeek(week),
      getLiftSetup(),
      getTrainingSessions(week),
      getExercises(),
    ]);
    setPlan(planData);
    setLifts(liftData);
    setSessions(sessionData);
    setExercises(exData);
    setLoading(false);
  }, [week]);

  useEffect(() => { load(); }, [load]);

  // Pre-fill set entries when opening strength session
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
    setSessionRPE(''); setSessionNotes('');
  }, [activeSession]);

  const hasSetup = lifts.length > 0;
  const phaseColor = plan ? (PHASE_COLOR[plan.phase] ?? '#fff') : '#fff';

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

  const backBtn = (onClick: () => void) => (
    <button onClick={onClick} style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', padding: '0.5rem 0.875rem', border: B2, background: '#fff', color: '#000', cursor: 'pointer', fontFamily: MONO }}>
      ← BACK
    </button>
  );

  const completeBtn = (onClick: () => void) => (
    <button onClick={onClick} disabled={saving}
      style={{ width: '100%', padding: '0.875rem', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', background: '#fff', color: '#000', border: B2, cursor: 'pointer', fontFamily: MONO }}>
      {saving ? 'SAVING...' : 'COMPLETE SESSION ✓'}
    </button>
  );

  // ── SETUP ──────────────────────────────────────────────────────────────────
  if (!hasSetup || showSetup) return (
    <div style={{ fontFamily: MONO, paddingTop: '4rem', background: BG, minHeight: '100vh' }}>
      <div style={{ padding: '1.25rem', borderBottom: B2, background: SURFACE, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ ...lbl, marginBottom: '0.3rem', color: '#333' }}>PROGRAMME SETUP</p>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>STARTING WEIGHTS</h1>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.7rem', color: '#444', fontFamily: MONO, lineHeight: 1.5 }}>
            Weight you can lift for 5 clean reps today.<br />Programme auto-calculates from here.
          </p>
        </div>
        {hasSetup && backBtn(() => setShowSetup(false))}
      </div>
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {LIFTS.map(l => {
          const ex = getExerciseByName(l.key);
          return (
            <div key={l.key} style={{ paddingBottom: '0.875rem', borderBottom: B1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <p style={{ ...lbl, color: '#fff' }}>{l.key.toUpperCase()}</p>
                <span style={{ ...lbl, color: '#333' }}>+{l.increment}kg/week</span>
              </div>
              {ex && <p style={{ ...lbl, fontSize: '0.5rem', color: '#2a2a2a', marginBottom: '0.5rem' }}>{ex.primary_target} · {ex.equipment}</p>}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="number" value={setupWeights[l.key]}
                  onChange={e => setSetupWeights(w => ({ ...w, [l.key]: e.target.value }))}
                  placeholder="e.g. 60" style={{ ...inputStyle, flex: 1 }} />
                <span style={{ ...lbl, color: '#333' }}>kg</span>
              </div>
            </div>
          );
        })}
        <button onClick={handleSetupSave}
          style={{ width: '100%', padding: '0.875rem', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', background: '#fff', color: '#000', border: B2, cursor: 'pointer', fontFamily: MONO }}>
          {hasSetup ? 'UPDATE WEIGHTS' : 'START PROGRAMME →'}
        </button>
      </div>
    </div>
  );

  // ── STRENGTH SESSION ───────────────────────────────────────────────────────
  if (activeSession === 'strength') return (
    <div style={{ fontFamily: MONO, paddingTop: '4rem', background: BG, minHeight: '100vh' }}>
      <div style={{ padding: '1.25rem', borderBottom: B2, background: SURFACE, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ ...lbl, marginBottom: '0.3rem', color: '#333' }}>WEEK {week} · {plan?.phase?.toUpperCase()} · {todayLabel()}</p>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>STRENGTH</h1>
          <p style={{ margin: '0.2rem 0 0', fontFamily: MONO, fontSize: '0.7rem', color: phaseColor }}>
            {plan?.strength_prescription} — {prescribedReps} REPS PER SET
          </p>
        </div>
        {backBtn(() => setActiveSession(null))}
      </div>

      {LIFTS.map(l => {
        const ex = getExerciseByName(l.key);
        const pw = getPrescribedWeight(l.key);
        const liftSets = sets[l.key] ?? [];
        return (
          <div key={l.key}>
            {ex
              ? <ExerciseCard ex={ex} prescribed={pw}>
                  <div style={{ padding: '0 1.25rem 1rem' }}>
                    {/* Column headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5rem 1fr 1fr 1fr', gap: '0.4rem', marginBottom: '0.35rem' }}>
                      <span />
                      {['WEIGHT (KG)', 'REPS', 'RPE'].map(h => (
                        <span key={h} style={{ ...lbl, fontSize: '0.5rem', color: '#2a2a2a' }}>{h}</span>
                      ))}
                    </div>
                    {liftSets.map((s, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5rem 1fr 1fr 1fr', gap: '0.4rem', marginBottom: '0.35rem', alignItems: 'center' }}>
                        <span style={{ ...lbl, color: '#2a2a2a', fontSize: '0.55rem' }}>S{idx + 1}</span>
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
                            style={{ ...inputStyle, padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </ExerciseCard>
              : <div style={{ padding: '0.875rem 1.25rem', borderBottom: B1 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#fff' }}>{l.key.toUpperCase()}</p>
                </div>
            }
          </div>
        );
      })}

      <div style={{ padding: '1.25rem', borderTop: B2, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <p style={{ ...lbl, marginBottom: '0.3rem' }}>SESSION RPE</p>
            <input type="number" value={sessionRPE} onChange={e => setSessionRPE(e.target.value)} placeholder="7" min="1" max="10" step="0.5" style={inputStyle} />
          </div>
          <div>
            <p style={{ ...lbl, marginBottom: '0.3rem' }}>NOTES</p>
            <input value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} placeholder="Optional" style={inputStyle} />
          </div>
        </div>
        {completeBtn(handleStrengthLog)}
      </div>
    </div>
  );

  // ── CARDIO SESSION ─────────────────────────────────────────────────────────
  if (activeSession === 'cardio') {
    const protocolEx = exercises.find(e =>
      e.name.toLowerCase().includes((plan?.cardio_protocol ?? '').toLowerCase().split(' ')[0])
    );
    return (
      <div style={{ fontFamily: MONO, paddingTop: '4rem', background: BG, minHeight: '100vh' }}>
        <div style={{ padding: '1.25rem', borderBottom: B2, background: SURFACE, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p style={{ ...lbl, marginBottom: '0.3rem', color: '#333' }}>WEEK {week} · {plan?.phase?.toUpperCase()}</p>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>CARDIO</h1>
            <p style={{ margin: '0.2rem 0 0', fontFamily: MONO, fontSize: '0.7rem', color: '#f44' }}>{plan?.cardio_protocol?.toUpperCase()}</p>
          </div>
          {backBtn(() => setActiveSession(null))}
        </div>

        {/* Prescribed detail */}
        <div style={{ padding: '1rem 1.25rem', background: SURFACE, borderBottom: B2 }}>
          <p style={{ ...lbl, marginBottom: '0.3rem', color: '#f44' }}>PRESCRIBED</p>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#fff', fontFamily: MONO }}>{plan?.cardio_detail}</p>
        </div>

        {/* Protocol how-to */}
        {protocolEx && <ExerciseCard ex={protocolEx} />}

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div><p style={{ ...lbl, marginBottom: '0.3rem' }}>DURATION (MIN)</p>
              <input type="number" value={simpleFields.duration} onChange={e => sf('duration', e.target.value)} placeholder="30" style={inputStyle} /></div>
            <div><p style={{ ...lbl, marginBottom: '0.3rem' }}>AVG HEART RATE</p>
              <input type="number" value={simpleFields.hr} onChange={e => sf('hr', e.target.value)} placeholder="135" style={inputStyle} /></div>
          </div>
          <div><p style={{ ...lbl, marginBottom: '0.3rem' }}>RPE</p>
            <input type="number" value={simpleFields.rpe} onChange={e => sf('rpe', e.target.value)} placeholder="6" min="1" max="10" step="0.5" style={inputStyle} /></div>
          <div><p style={{ ...lbl, marginBottom: '0.3rem' }}>NOTES</p>
            <input value={simpleFields.notes} onChange={e => sf('notes', e.target.value)} placeholder="Optional" style={inputStyle} /></div>
          {completeBtn(() => handleSimpleLog('cardio'))}
        </div>
      </div>
    );
  }

  // ── BOXING SESSION ─────────────────────────────────────────────────────────
  if (activeSession === 'boxing') {
    const shadowEx = getExerciseByName('Shadowboxing');
    const bagEx = getExerciseByName('Heavy Bag Work');
    return (
      <div style={{ fontFamily: MONO, paddingTop: '4rem', background: BG, minHeight: '100vh' }}>
        <div style={{ padding: '1.25rem', borderBottom: B2, background: SURFACE, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p style={{ ...lbl, marginBottom: '0.3rem', color: '#333' }}>WEEK {week} · {plan?.phase?.toUpperCase()}</p>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>PAD & BOXING</h1>
            <p style={{ margin: '0.2rem 0 0', fontFamily: MONO, fontSize: '0.7rem', color: '#f70' }}>{plan?.boxing_focus}</p>
          </div>
          {backBtn(() => setActiveSession(null))}
        </div>
        {shadowEx && <ExerciseCard ex={shadowEx} />}
        {bagEx && <ExerciseCard ex={bagEx} />}
        <div style={{ padding: '1.25rem', borderTop: B2, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div><p style={{ ...lbl, marginBottom: '0.3rem' }}>SHADOW (ROUNDS)</p>
              <input type="number" value={simpleFields.shadowRounds} onChange={e => sf('shadowRounds', e.target.value)} placeholder="3" style={inputStyle} /></div>
            <div><p style={{ ...lbl, marginBottom: '0.3rem' }}>BAG (ROUNDS)</p>
              <input type="number" value={simpleFields.bagRounds} onChange={e => sf('bagRounds', e.target.value)} placeholder="3" style={inputStyle} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div><p style={{ ...lbl, marginBottom: '0.3rem' }}>RPE</p>
              <input type="number" value={simpleFields.rpe} onChange={e => sf('rpe', e.target.value)} placeholder="7" min="1" max="10" step="0.5" style={inputStyle} /></div>
            <div><p style={{ ...lbl, marginBottom: '0.3rem' }}>NOTES</p>
              <input value={simpleFields.notes} onChange={e => sf('notes', e.target.value)} placeholder="Optional" style={inputStyle} /></div>
          </div>
          {completeBtn(() => handleSimpleLog('boxing'))}
        </div>
      </div>
    );
  }

  // ── AGILITY SESSION ────────────────────────────────────────────────────────
  if (activeSession === 'agility') {
    const agilityExs = exercises.filter(e => ['Agility', 'Bodyweight', 'Flexibility'].includes(e.type)).slice(0, 5);
    return (
      <div style={{ fontFamily: MONO, paddingTop: '4rem', background: BG, minHeight: '100vh' }}>
        <div style={{ padding: '1.25rem', borderBottom: B2, background: SURFACE, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p style={{ ...lbl, marginBottom: '0.3rem', color: '#333' }}>WEEK {week} · {plan?.phase?.toUpperCase()}</p>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>AGILITY / BW</h1>
            <p style={{ margin: '0.2rem 0 0', fontFamily: MONO, fontSize: '0.7rem', color: '#4af' }}>{plan?.agility_focus}</p>
          </div>
          {backBtn(() => setActiveSession(null))}
        </div>
        {agilityExs.map(ex => <ExerciseCard key={ex.id} ex={ex} />)}
        <div style={{ padding: '1.25rem', borderTop: B2, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {[['LADDER', 'ladder'], ['CONES', 'cones']].map(([label, key]) => (
              <button key={key} onClick={() => sf(key, !simpleFields[key as keyof typeof simpleFields])}
                style={{ padding: '0.6rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', border: B2, background: simpleFields[key as keyof typeof simpleFields] ? '#fff' : BG, color: simpleFields[key as keyof typeof simpleFields] ? '#000' : '#444', cursor: 'pointer', fontFamily: MONO }}>
                {simpleFields[key as keyof typeof simpleFields] ? '✓ ' : ''}{label}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {[['PUSH-UPS', 'pushUps'], ['BW SQUATS', 'bwSquats'], ['LUNGES', 'lunges'],
              ['PLANK (SEC)', 'plankSec'], ['PULL-UPS', 'pullUps'], ['RPE', 'rpe']].map(([label, key]) => (
              <div key={key}>
                <p style={{ ...lbl, marginBottom: '0.2rem', fontSize: '0.5rem' }}>{label}</p>
                <input type="number" value={simpleFields[key as keyof typeof simpleFields] as string}
                  onChange={e => sf(key, e.target.value)}
                  style={{ ...inputStyle, padding: '0.4rem 0.5rem', fontSize: '0.8rem' }} />
              </div>
            ))}
          </div>
          <div><p style={{ ...lbl, marginBottom: '0.3rem' }}>NOTES</p>
            <input value={simpleFields.notes} onChange={e => sf('notes', e.target.value)} placeholder="Optional" style={inputStyle} /></div>
          {completeBtn(() => handleSimpleLog('agility'))}
        </div>
      </div>
    );
  }

  // ── PLAN OVERVIEW ──────────────────────────────────────────────────────────
  if (loading) return <div style={{ padding: '5rem 1.25rem', color: '#333', fontFamily: MONO, fontSize: '0.75rem' }}>LOADING...</div>;

  const nextSession = suggestedSession(sessions);

  return (
    <div style={{ fontFamily: MONO, paddingTop: '4rem', background: BG, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '1.25rem', borderBottom: B2, background: SURFACE }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <p style={{ ...lbl, marginBottom: '0.3rem', color: '#333' }}>
              {todayLabel()} · {new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }).toUpperCase()}
            </p>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>TRAINING PLAN</h1>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => router.push('/fitness/exercises')}
              style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', padding: '0.5rem 0.75rem', border: B2, background: BG, color: '#fff', cursor: 'pointer', fontFamily: MONO }}>
              LIBRARY
            </button>
            <button onClick={() => setShowSetup(true)}
              style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', padding: '0.5rem 0.75rem', border: '2px solid #161616', background: BG, color: '#444', cursor: 'pointer', fontFamily: MONO }}>
              SETUP
            </button>
          </div>
        </div>

        {/* Week + Phase */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <p style={{ ...lbl, marginBottom: '0.15rem', color: '#333' }}>WEEK</p>
            <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>{week}</p>
            <p style={{ ...lbl, color: '#1e1e1e', fontSize: '0.5rem' }}>OF 26</p>
          </div>
          <div>
            <span style={{ display: 'inline-block', padding: '0.35rem 0.875rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', color: '#000', background: phaseColor, fontFamily: MONO }}>
              {plan?.phase?.toUpperCase()}
            </span>
            {plan?.is_deload && (
              <span style={{ marginLeft: '0.5rem', display: 'inline-block', padding: '0.35rem 0.75rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', color: '#888', border: '1px solid #333', fontFamily: MONO }}>
                DELOAD
              </span>
            )}
          </div>
        </div>

        {/* Prescribed weight strip */}
        {plan && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', border: B2, background: '#050505' }}>
            {LIFTS.map((l, i) => {
              const pw = getPrescribedWeight(l.key);
              return (
                <div key={l.key} style={{ padding: '0.5rem 0.25rem', textAlign: 'center' as const, borderRight: i < 4 ? B1 : 'none' }}>
                  <p style={{ ...lbl, fontSize: '0.45rem', marginBottom: '0.2rem', color: '#222' }}>{l.key.split(' ')[0].toUpperCase()}</p>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: pw ? phaseColor : '#222', fontFamily: MONO }}>
                    {pw ? `${pw}` : '—'}
                  </p>
                  <p style={{ ...lbl, fontSize: '0.45rem', marginTop: '0.1rem', color: '#161616' }}>kg</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* UP NEXT */}
      {!sessionDone(nextSession) && (
        <div style={{ padding: '0.5rem 1.25rem', background: '#050505', borderBottom: B1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ ...lbl, color: '#2a2a2a' }}>UP NEXT</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: SESSION_META[nextSession].color, fontFamily: MONO, letterSpacing: '0.1em' }}>
            {SESSION_META[nextSession].label}
          </span>
        </div>
      )}

      {/* Session cards */}
      <div style={{ padding: '0.5rem 1.25rem', background: SURFACE, borderBottom: B1 }}>
        <span style={{ ...lbl, color: '#2a2a2a' }}>THIS WEEK</span>
      </div>

      {SESSION_TYPES.map(type => {
        const done = sessionDone(type);
        const meta = SESSION_META[type];
        const isNext = type === nextSession && !done;
        const sub: Record<SessionType, string> = {
          strength: plan?.strength_prescription ?? '',
          cardio:   plan?.cardio_protocol ?? '',
          boxing:   plan?.boxing_focus ?? '',
          agility:  plan?.agility_focus ?? '',
        };
        return (
          <button key={type} onClick={() => !done && setActiveSession(type)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              width: '100%', padding: '1rem 1.25rem',
              background: isNext ? '#080808' : BG,
              border: 'none', borderBottom: B1,
              cursor: done ? 'default' : 'pointer',
              textAlign: 'left' as const, fontFamily: MONO,
              borderLeft: isNext ? `3px solid ${meta.color}` : '3px solid transparent',
            }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 700, color: done ? '#2a2a2a' : '#fff', fontSize: '0.875rem' }}>
                  {meta.label}
                </span>
                {done
                  ? <span style={{ fontSize: '0.5rem', fontWeight: 700, color: '#4f8', border: '1px solid #4f8', padding: '0.1rem 0.35rem', letterSpacing: '0.1em' }}>DONE</span>
                  : isNext && <span style={{ fontSize: '0.5rem', fontWeight: 700, color: meta.color, border: `1px solid ${meta.color}`, padding: '0.1rem 0.35rem', letterSpacing: '0.1em' }}>TODAY</span>
                }
              </div>
              <p style={{ ...lbl, color: done ? '#1a1a1a' : '#2a2a2a', margin: 0, fontSize: '0.5rem' }}>{sub[type]}</p>
            </div>
            <span style={{ color: done ? '#1a1a1a' : '#444', fontSize: done ? '0.875rem' : '1.1rem' }}>
              {done ? '✓' : '→'}
            </span>
          </button>
        );
      })}

      {/* Week nav */}
      <div style={{ display: 'flex', borderTop: B2, marginTop: '0.5rem' }}>
        {[
          { label: '← PREV', fn: () => setWeek(w => Math.max(1, w - 1)), active: week > 1 },
          { label: `W${getCurrentTrainingWeek()}`, fn: () => setWeek(getCurrentTrainingWeek()), active: true },
          { label: 'NEXT →', fn: () => setWeek(w => Math.min(26, w + 1)), active: week < 26 },
        ].map((b, i) => (
          <button key={i} onClick={b.fn}
            style={{ flex: 1, padding: '0.75rem', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', background: BG, color: b.active ? '#444' : '#1e1e1e', border: 'none', borderRight: i < 2 ? B1 : 'none', cursor: 'pointer', fontFamily: MONO }}>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
