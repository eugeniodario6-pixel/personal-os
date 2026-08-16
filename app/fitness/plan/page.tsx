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
const MONO = 'var(--font-mono)';

const PHASE_CLASS: Record<string, string> = {
  Base: 'phase-base', Build: 'phase-build', Camp: 'phase-camp', Taper: 'phase-taper',
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

const SESSION_META: Record<SessionType, { label: string; colorClass: string }> = {
  strength: { label: 'STRENGTH',     colorClass: 'phase-build' },
  cardio:   { label: 'CARDIO',       colorClass: 'text-negative' },
  boxing:   { label: 'PAD & BOXING', colorClass: 'phase-camp' },
  agility:  { label: 'AGILITY / BW', colorClass: 'phase-base' },
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
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', padding: '1rem 1.25rem', gap: '0.75rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' as const }}>
            <p style={{ margin: 0, fontWeight: 700, color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>
              {ex.name.toUpperCase()}
            </p>
            {prescribed != null && (
              <span className="badge text-accent" style={{ fontSize: '0.5rem', flexShrink: 0 }}>
                {prescribed} KG
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span className="label">{ex.primary_target}</span>
            <span className="label">{ex.equipment}</span>
          </div>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="btn btn-sm btn-ghost"
          style={{ flexShrink: 0 }}
        >
          {open ? 'LESS' : 'HOW TO'}
        </button>
      </div>

      {open && (
        <div style={{ padding: '0 1.25rem 1.25rem' }}>
          {ex.cues && (
            <div className="card-dark" style={{ marginBottom: '0.75rem', borderLeft: '2px solid var(--accent)' }}>
              <p className="label" style={{ color: 'var(--accent)', marginBottom: '0.35rem' }}>CUES</p>
              <p className="body-sm" style={{ margin: 0, fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>{ex.cues}</p>
            </div>
          )}
          {ex.how_to && (
            <p className="body" style={{ margin: 0, fontFamily: 'var(--font-mono)', lineHeight: 1.7 }}>{ex.how_to}</p>
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

  // Determine phase color using CSS class approach
  function getPhaseColorVar(phase: string | undefined): string {
    switch (phase) {
      case 'Base':  return 'var(--positive)'; // blue mapped → positive (no blue token)
      case 'Build': return 'var(--accent-dim)';
      case 'Camp':  return 'var(--accent)';
      case 'Taper': return 'var(--text-muted)';
      default:      return 'var(--text)';
    }
  }

  const phaseColorVar = plan ? getPhaseColorVar(plan.phase) : 'var(--text)';

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
    <button onClick={onClick} className="btn btn-primary btn-sm">
      ← BACK
    </button>
  );

  const completeBtn = (onClick: () => void) => (
    <button onClick={onClick} disabled={saving} className="btn btn-primary btn-block">
      {saving ? 'SAVING...' : 'COMPLETE SESSION ✓'}
    </button>
  );

  // ── SETUP ──────────────────────────────────────────────────────────────────
  if (!hasSetup || showSetup) return (
    <div className="page" style={{ paddingTop: '4rem' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p className="label" style={{ marginBottom: '0.3rem' }}>PROGRAMME SETUP</p>
          <h1 className="page-title">STARTING WEIGHTS</h1>
          <p className="body-sm" style={{ marginTop: '0.4rem', fontFamily: 'var(--font-mono)' }}>
            Weight you can lift for 5 clean reps today.<br />Programme auto-calculates from here.
          </p>
        </div>
        {hasSetup && backBtn(() => setShowSetup(false))}
      </div>
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {LIFTS.map(l => {
          const ex = getExerciseByName(l.key);
          return (
            <div key={l.key} style={{ paddingBottom: '0.875rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <p className="label" style={{ color: 'var(--text)' }}>{l.key.toUpperCase()}</p>
                <span className="label">+{l.increment}kg/week</span>
              </div>
              {ex && <p className="label-xs" style={{ marginBottom: '0.5rem' }}>{ex.primary_target} · {ex.equipment}</p>}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number"
                  value={setupWeights[l.key]}
                  onChange={e => setSetupWeights(w => ({ ...w, [l.key]: e.target.value }))}
                  placeholder="e.g. 60"
                  style={{ flex: 1 }}
                />
                <span className="label">kg</span>
              </div>
            </div>
          );
        })}
        <button onClick={handleSetupSave} className="btn btn-primary btn-block">
          {hasSetup ? 'UPDATE WEIGHTS' : 'START PROGRAMME →'}
        </button>
      </div>
    </div>
  );

  // ── STRENGTH SESSION ───────────────────────────────────────────────────────
  if (activeSession === 'strength') return (
    <div className="page" style={{ paddingTop: '4rem' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p className="label" style={{ marginBottom: '0.3rem' }}>WEEK {week} · {plan?.phase?.toUpperCase()} · {todayLabel()}</p>
          <h1 className="page-title">STRENGTH</h1>
          <p style={{ margin: '0.2rem 0 0', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: phaseColorVar }}>
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
                  <div style={{ padding: '0 1.25rem 1.25rem' }}>
                    {/* Column headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5rem 1fr 1fr 1fr', gap: '0.4rem', marginBottom: '0.35rem' }}>
                      <span />
                      {['WEIGHT (KG)', 'REPS', 'RPE'].map(h => (
                        <span key={h} className="label-xs">{h}</span>
                      ))}
                    </div>
                    {liftSets.map((s, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5rem 1fr 1fr 1fr', gap: '0.4rem', marginBottom: '0.35rem', alignItems: 'center' }}>
                        <span className="label" style={{ fontSize: '0.55rem' }}>S{idx + 1}</span>
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
                            style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </ExerciseCard>
              : <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                  <p style={{ margin: 0, fontWeight: 700, color: 'var(--text)' }}>{l.key.toUpperCase()}</p>
                </div>
            }
          </div>
        );
      })}

      <div style={{ padding: '1.25rem', borderTop: '2px solid var(--border-strong)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <p className="label" style={{ marginBottom: '0.3rem' }}>SESSION RPE</p>
            <input type="number" value={sessionRPE} onChange={e => setSessionRPE(e.target.value)} placeholder="7" min="1" max="10" step="0.5" />
          </div>
          <div>
            <p className="label" style={{ marginBottom: '0.3rem' }}>NOTES</p>
            <input value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} placeholder="Optional" />
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
      <div className="page" style={{ paddingTop: '4rem' }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p className="label" style={{ marginBottom: '0.3rem' }}>WEEK {week} · {plan?.phase?.toUpperCase()}</p>
            <h1 className="page-title">CARDIO</h1>
            <p style={{ margin: '0.2rem 0 0', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--negative)' }}>{plan?.cardio_protocol?.toUpperCase()}</p>
          </div>
          {backBtn(() => setActiveSession(null))}
        </div>

        {/* Prescribed detail */}
        <div className="section" style={{ background: 'var(--surface)' }}>
          <p className="label" style={{ marginBottom: '0.3rem', color: 'var(--negative)' }}>PRESCRIBED</p>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{plan?.cardio_detail}</p>
        </div>

        {/* Protocol how-to */}
        {protocolEx && <ExerciseCard ex={protocolEx} />}

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <p className="label" style={{ marginBottom: '0.3rem' }}>DURATION (MIN)</p>
              <input type="number" value={simpleFields.duration} onChange={e => sf('duration', e.target.value)} placeholder="30" />
            </div>
            <div>
              <p className="label" style={{ marginBottom: '0.3rem' }}>AVG HEART RATE</p>
              <input type="number" value={simpleFields.hr} onChange={e => sf('hr', e.target.value)} placeholder="135" />
            </div>
          </div>
          <div>
            <p className="label" style={{ marginBottom: '0.3rem' }}>RPE</p>
            <input type="number" value={simpleFields.rpe} onChange={e => sf('rpe', e.target.value)} placeholder="6" min="1" max="10" step="0.5" />
          </div>
          <div>
            <p className="label" style={{ marginBottom: '0.3rem' }}>NOTES</p>
            <input value={simpleFields.notes} onChange={e => sf('notes', e.target.value)} placeholder="Optional" />
          </div>
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
      <div className="page" style={{ paddingTop: '4rem' }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p className="label" style={{ marginBottom: '0.3rem' }}>WEEK {week} · {plan?.phase?.toUpperCase()}</p>
            <h1 className="page-title">PAD & BOXING</h1>
            <p style={{ margin: '0.2rem 0 0', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent)' }}>{plan?.boxing_focus}</p>
          </div>
          {backBtn(() => setActiveSession(null))}
        </div>
        {shadowEx && <ExerciseCard ex={shadowEx} />}
        {bagEx && <ExerciseCard ex={bagEx} />}
        <div style={{ padding: '1.25rem', borderTop: '2px solid var(--border-strong)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <p className="label" style={{ marginBottom: '0.3rem' }}>SHADOW (ROUNDS)</p>
              <input type="number" value={simpleFields.shadowRounds} onChange={e => sf('shadowRounds', e.target.value)} placeholder="3" />
            </div>
            <div>
              <p className="label" style={{ marginBottom: '0.3rem' }}>BAG (ROUNDS)</p>
              <input type="number" value={simpleFields.bagRounds} onChange={e => sf('bagRounds', e.target.value)} placeholder="3" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <p className="label" style={{ marginBottom: '0.3rem' }}>RPE</p>
              <input type="number" value={simpleFields.rpe} onChange={e => sf('rpe', e.target.value)} placeholder="7" min="1" max="10" step="0.5" />
            </div>
            <div>
              <p className="label" style={{ marginBottom: '0.3rem' }}>NOTES</p>
              <input value={simpleFields.notes} onChange={e => sf('notes', e.target.value)} placeholder="Optional" />
            </div>
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
      <div className="page" style={{ paddingTop: '4rem' }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p className="label" style={{ marginBottom: '0.3rem' }}>WEEK {week} · {plan?.phase?.toUpperCase()}</p>
            <h1 className="page-title">AGILITY / BW</h1>
            <p style={{ margin: '0.2rem 0 0', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }} className="phase-base">{plan?.agility_focus}</p>
          </div>
          {backBtn(() => setActiveSession(null))}
        </div>
        {agilityExs.map(ex => <ExerciseCard key={ex.id} ex={ex} />)}
        <div style={{ padding: '1.25rem', borderTop: '2px solid var(--border-strong)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {[['LADDER', 'ladder'], ['CONES', 'cones']].map(([label, key]) => (
              <button key={key} onClick={() => sf(key, !simpleFields[key as keyof typeof simpleFields])}
                className={`btn btn-block ${simpleFields[key as keyof typeof simpleFields] ? 'btn-primary' : 'btn-ghost'}`}>
                {simpleFields[key as keyof typeof simpleFields] ? '✓ ' : ''}{label}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {[['PUSH-UPS', 'pushUps'], ['BW SQUATS', 'bwSquats'], ['LUNGES', 'lunges'],
              ['PLANK (SEC)', 'plankSec'], ['PULL-UPS', 'pullUps'], ['RPE', 'rpe']].map(([label, key]) => (
              <div key={key}>
                <p className="label" style={{ marginBottom: '0.2rem', fontSize: '0.5rem' }}>{label}</p>
                <input type="number" value={simpleFields[key as keyof typeof simpleFields] as string}
                  onChange={e => sf(key, e.target.value)}
                  style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem' }} />
              </div>
            ))}
          </div>
          <div>
            <p className="label" style={{ marginBottom: '0.3rem' }}>NOTES</p>
            <input value={simpleFields.notes} onChange={e => sf('notes', e.target.value)} placeholder="Optional" />
          </div>
          {completeBtn(() => handleSimpleLog('agility'))}
        </div>
      </div>
    );
  }

  // ── PLAN OVERVIEW ──────────────────────────────────────────────────────────
  if (loading) return (
    <div className="page" style={{ padding: '5rem 1.25rem' }}>
      <p className="label">LOADING...</p>
    </div>
  );

  const nextSession = suggestedSession(sessions);

  return (
    <div className="page" style={{ paddingTop: '4rem' }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <p className="label" style={{ marginBottom: '0.3rem' }}>
              {todayLabel()} · {new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }).toUpperCase()}
            </p>
            <h1 className="page-title">TRAINING PLAN</h1>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => router.push('/fitness/exercises')} className="btn btn-sm">
              LIBRARY
            </button>
            <button onClick={() => setShowSetup(true)} className="btn btn-sm btn-ghost">
              SETUP
            </button>
          </div>
        </div>

        {/* Week + Phase */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div>
            <p className="label" style={{ marginBottom: '0.15rem' }}>WEEK</p>
            <p className="num-xl" style={{ margin: 0 }}>{week}</p>
            <p className="label-xs" style={{ marginTop: '0.1rem' }}>OF 26</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <span className={`badge badge-fill ${PHASE_CLASS[plan?.phase ?? ''] ?? ''}`} style={{ alignSelf: 'flex-start' }}>
              <span>{plan?.phase?.toUpperCase()}</span>
            </span>
            {plan?.is_deload && (
              <span className="badge text-muted" style={{ alignSelf: 'flex-start' }}>DELOAD</span>
            )}
          </div>
        </div>

        {/* Prescribed weight strip */}
        {plan && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
            {LIFTS.map((l) => {
              const pw = getPrescribedWeight(l.key);
              return (
                <div key={l.key} className="stat-cell" style={{ textAlign: 'center' }}>
                  <p className="label-xs" style={{ marginBottom: '0.2rem' }}>{l.key.split(' ')[0].toUpperCase()}</p>
                  <p className="num-md" style={{ margin: 0, color: pw ? phaseColorVar : 'var(--text-ghost)' }}>
                    {pw ? `${pw}` : '—'}
                  </p>
                  <p className="label-xs" style={{ marginTop: '0.1rem' }}>kg</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* UP NEXT */}
      {!sessionDone(nextSession) && (
        <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="label">UP NEXT</span>
          <span className={`label ${SESSION_META[nextSession].colorClass}`} style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
            {SESSION_META[nextSession].label}
          </span>
        </div>
      )}

      {/* Session cards header */}
      <div className="section-label">
        <span className="label">THIS WEEK</span>
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
              width: '100%', padding: '1.25rem var(--page-pad)',
              background: isNext ? 'var(--surface)' : 'var(--bg)',
              border: 'none', borderBottom: '1px solid var(--border)',
              cursor: done ? 'default' : 'pointer',
              textAlign: 'left' as const, fontFamily: 'var(--font-mono)',
              borderLeft: isNext ? '3px solid var(--accent)' : '3px solid transparent',
            }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                <span style={{ fontWeight: 700, color: done ? 'var(--text-ghost)' : 'var(--text)', fontSize: '0.875rem' }}>
                  {meta.label}
                </span>
                {done
                  ? <span className="badge text-positive">DONE</span>
                  : isNext && <span className="badge text-accent">TODAY</span>
                }
              </div>
              <p className="label" style={{ margin: 0, color: done ? 'var(--text-ghost)' : 'var(--text-muted)' }}>{sub[type]}</p>
            </div>
            <span style={{ color: done ? 'var(--text-ghost)' : 'var(--text-muted)', fontSize: done ? '0.875rem' : '1.1rem' }}>
              {done ? '✓' : '→'}
            </span>
          </button>
        );
      })}

      {/* Week nav */}
      <div style={{ display: 'flex', borderTop: '2px solid var(--border-strong)', marginTop: '0.5rem' }}>
        {[
          { label: '← PREV', fn: () => setWeek(w => Math.max(1, w - 1)), active: week > 1 },
          { label: `W${getCurrentTrainingWeek()}`, fn: () => setWeek(getCurrentTrainingWeek()), active: true },
          { label: 'NEXT →', fn: () => setWeek(w => Math.min(26, w + 1)), active: week < 26 },
        ].map((b, i) => (
          <button key={i} onClick={b.fn}
            className="btn btn-ghost"
            style={{ flex: 1, padding: '0.75rem', borderRight: i < 2 ? '1px solid var(--border)' : 'none', color: b.active ? 'var(--text-muted)' : 'var(--text-ghost)' }}>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
