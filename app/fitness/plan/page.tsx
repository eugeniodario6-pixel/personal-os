'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getLiftSetup, upsertLiftSetup, getTrainingWeek, getCurrentTrainingWeek,
  getTrainingSessions, createTrainingSession, addStrengthSets, updateTrainingSession,
  calcPrescribedWeight,
  type LiftSetup, type TrainingWeek, type TrainingSession, type StrengthSet,
} from '@/lib/db';
import { haptic } from '@/lib/haptic';

// ─── Design tokens ────────────────────────────────────────────────────────────
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
  { key: 'Back Squat',      increment: 2.5 },
  { key: 'Bench Press',     increment: 2.5 },
  { key: 'Deadlift',        increment: 5.0 },
  { key: 'Overhead Press',  increment: 2.5 },
  { key: 'Barbell Row',     increment: 2.5 },
];

const inputStyle = {
  width: '100%', fontFamily: MONO, fontSize: '0.875rem',
  background: '#0a0a0a', color: '#fff', border: B2,
  padding: '0.65rem 0.875rem', outline: 'none', boxSizing: 'border-box' as const,
};

type View = 'plan' | 'setup' | 'log-strength' | 'log-cardio' | 'log-boxing' | 'log-agility';

interface SetEntry {
  actual_weight: string;
  reps: string;
  rpe: string;
}

export default function PlanPage() {
  const router = useRouter();
  const [view, setView] = useState<View>('plan');
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState(getCurrentTrainingWeek());
  const [plan, setPlan] = useState<TrainingWeek | null>(null);
  const [lifts, setLifts] = useState<LiftSetup[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);

  // Setup form
  const [setupWeights, setSetupWeights] = useState<Record<string, string>>(
    Object.fromEntries(LIFTS.map(l => [l.key, '']))
  );

  // Strength log
  const [sets, setSets] = useState<Record<string, SetEntry[]>>({});
  const [sessionRPE, setSessionRPE] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Cardio/boxing/agility log
  const [simpleDuration, setSimpleDuration] = useState('');
  const [simpleRPE, setSimpleRPE] = useState('');
  const [simpleHR, setSimpleHR] = useState('');
  const [simpleNotes, setSimpleNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [planData, liftData, sessionData] = await Promise.all([
      getTrainingWeek(week),
      getLiftSetup(),
      getTrainingSessions(week),
    ]);
    setPlan(planData);
    setLifts(liftData);
    setSessions(sessionData);
    setLoading(false);
  }, [week]);

  useEffect(() => { load(); }, [load]);

  // Init set entries when entering strength log
  useEffect(() => {
    if (view !== 'log-strength' || !plan) return;
    const newSets: Record<string, SetEntry[]> = {};
    const [setsCount] = parsePrescription(plan.strength_prescription);
    LIFTS.forEach(l => {
      newSets[l.key] = Array.from({ length: setsCount }, () => ({
        actual_weight: getPrescribedWeight(l.key)?.toString() ?? '',
        reps: '', rpe: '',
      }));
    });
    setSets(newSets);
  }, [view, plan, lifts]);

  const hasSetup = lifts.length > 0;
  const isBasePhaseDone = week > 8;

  function getPrescribedWeight(liftName: string): number | null {
    if (!plan) return null;
    const lift = lifts.find(l => l.lift === liftName);
    if (!lift) return null;
    return calcPrescribedWeight(lift, plan);
  }

  function parsePrescription(prescription: string): [number, string] {
    // e.g. "3x5" → [3, "5"] or "4x8-10" → [4, "8-10"]
    const match = prescription.match(/^(\d+)x(.+)/);
    if (match) return [parseInt(match[1]), match[2]];
    return [3, '5'];
  }

  const sessionDone = (type: string) =>
    sessions.some(s => s.session_type === type);

  const handleSetupSave = async () => {
    haptic('medium');
    const liftData = LIFTS.map(l => ({
      lift: l.key,
      start_weight: parseFloat(setupWeights[l.key]) || 20,
      weekly_increment: l.increment,
      working_max: null,
    }));
    await upsertLiftSetup(liftData);
    await load();
    setView('plan');
  };

  const handleStrengthLog = async () => {
    setSaving(true);
    haptic('medium');
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
            session_id: sessionId,
            exercise_id: l.key.toLowerCase().replace(/ /g, '_'),
            exercise_name: l.key,
            set_number: idx + 1,
            prescribed_weight: getPrescribedWeight(l.key),
            actual_weight: parseFloat(s.actual_weight) || null,
            reps: parseInt(s.reps) || null,
            rpe: parseFloat(s.rpe) || null,
            notes: null,
          });
        });
      });

      if (allSets.length > 0) await addStrengthSets(allSets);
      await load();
      setView('plan');
    } finally { setSaving(false); }
  };

  const handleSimpleLog = async (type: 'cardio' | 'boxing' | 'agility') => {
    setSaving(true);
    haptic('medium');
    try {
      await createTrainingSession({
        week, session_type: type,
        date: new Date().toISOString().split('T')[0],
        rpe: parseFloat(simpleRPE) || null,
        notes: [
          simpleDuration ? `Duration: ${simpleDuration} min` : '',
          simpleHR ? `Avg HR: ${simpleHR} bpm` : '',
          simpleNotes,
        ].filter(Boolean).join(' | ') || null,
      });
      setSimpleDuration(''); setSimpleRPE(''); setSimpleHR(''); setSimpleNotes('');
      await load();
      setView('plan');
    } finally { setSaving(false); }
  };

  const phaseColor = plan ? (PHASE_COLOR[plan.phase] ?? '#fff') : '#fff';
  const [setsCount, repsTarget] = plan ? parsePrescription(plan.strength_prescription) : [3, '5'];

  if (loading) return (
    <div style={{ padding: '2rem', color: '#333', fontFamily: MONO, fontSize: '0.75rem', paddingTop: '5rem' }}>
      LOADING...
    </div>
  );

  // ── SETUP SCREEN ─────────────────────────────────────────────────────────────
  if (!hasSetup || view === 'setup') return (
    <div style={{ fontFamily: MONO, paddingTop: '4rem', background: BG, minHeight: '100vh' }}>
      <div style={{ padding: '1.25rem', borderBottom: B2, background: SURFACE }}>
        <p style={{ ...lbl, marginBottom: '0.3rem', color: '#333' }}>WEEK 1 — BASE PHASE</p>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>SETUP LIFTS</h1>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.7rem', color: '#444', fontFamily: MONO }}>
          Enter your starting weights. The plan calculates everything from here.
        </p>
      </div>

      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {LIFTS.map(l => (
          <div key={l.key}>
            <p style={{ ...lbl, marginBottom: '0.35rem' }}>
              {l.key.toUpperCase()}
              <span style={{ color: '#333', fontWeight: 400 }}> +{l.increment}kg/week</span>
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                value={setupWeights[l.key]}
                onChange={e => setSetupWeights(w => ({ ...w, [l.key]: e.target.value }))}
                placeholder="e.g. 60"
                style={{ ...inputStyle, flex: 1 }}
              />
              <span style={{ ...lbl, color: '#333', whiteSpace: 'nowrap' as const }}>kg</span>
            </div>
          </div>
        ))}

        <button onClick={handleSetupSave} style={{ marginTop: '0.5rem', width: '100%', padding: '0.875rem', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', background: '#fff', color: '#000', border: B2, cursor: 'pointer', fontFamily: MONO }}>
          START PROGRAMME →
        </button>
      </div>
    </div>
  );

  // ── STRENGTH LOG ─────────────────────────────────────────────────────────────
  if (view === 'log-strength') return (
    <div style={{ fontFamily: MONO, paddingTop: '4rem', background: BG, minHeight: '100vh' }}>
      <div style={{ padding: '1.25rem', borderBottom: B2, background: SURFACE, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ ...lbl, marginBottom: '0.3rem', color: '#333' }}>WEEK {week} — {plan?.phase?.toUpperCase()}</p>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>STRENGTH</h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: '#555', fontFamily: MONO }}>
            {plan?.strength_prescription} — {repsTarget} reps
          </p>
        </div>
        <button onClick={() => setView('plan')} style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', padding: '0.5rem 0.875rem', border: B2, background: '#fff', color: '#000', cursor: 'pointer', fontFamily: MONO }}>
          ← BACK
        </button>
      </div>

      <div>
        {LIFTS.map(l => {
          const prescribed = getPrescribedWeight(l.key);
          const liftSets = sets[l.key] ?? [];
          return (
            <div key={l.key} style={{ borderBottom: B2 }}>
              <div style={{ padding: '0.75rem 1.25rem', background: SURFACE, borderBottom: B1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.875rem' }}>{l.key.toUpperCase()}</span>
                {prescribed && (
                  <span style={{ ...lbl, color: phaseColor }}>{prescribed}kg prescribed</span>
                )}
              </div>
              {liftSets.map((s, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2rem 1fr 1fr 1fr', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 1.25rem', borderBottom: B1 }}>
                  <span style={{ ...lbl, color: '#333' }}>S{idx + 1}</span>
                  <div>
                    <p style={{ ...lbl, marginBottom: '0.2rem', fontSize: '0.5rem' }}>WEIGHT (KG)</p>
                    <input type="number" value={s.actual_weight}
                      onChange={e => setSets(prev => {
                        const updated = [...(prev[l.key] ?? [])];
                        updated[idx] = { ...updated[idx], actual_weight: e.target.value };
                        return { ...prev, [l.key]: updated };
                      })}
                      style={{ ...inputStyle, padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div>
                    <p style={{ ...lbl, marginBottom: '0.2rem', fontSize: '0.5rem' }}>REPS</p>
                    <input type="number" value={s.reps}
                      onChange={e => setSets(prev => {
                        const updated = [...(prev[l.key] ?? [])];
                        updated[idx] = { ...updated[idx], reps: e.target.value };
                        return { ...prev, [l.key]: updated };
                      })}
                      style={{ ...inputStyle, padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div>
                    <p style={{ ...lbl, marginBottom: '0.2rem', fontSize: '0.5rem' }}>RPE</p>
                    <input type="number" value={s.rpe} min="1" max="10" step="0.5"
                      onChange={e => setSets(prev => {
                        const updated = [...(prev[l.key] ?? [])];
                        updated[idx] = { ...updated[idx], rpe: e.target.value };
                        return { ...prev, [l.key]: updated };
                      })}
                      style={{ ...inputStyle, padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <p style={{ ...lbl, marginBottom: '0.35rem' }}>SESSION RPE</p>
              <input type="number" value={sessionRPE} onChange={e => setSessionRPE(e.target.value)} placeholder="7" min="1" max="10" step="0.5" style={inputStyle} />
            </div>
            <div>
              <p style={{ ...lbl, marginBottom: '0.35rem' }}>NOTES</p>
              <input value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} placeholder="Optional" style={inputStyle} />
            </div>
          </div>
          <button onClick={handleStrengthLog} disabled={saving}
            style={{ width: '100%', padding: '0.875rem', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', background: '#fff', color: '#000', border: B2, cursor: 'pointer', fontFamily: MONO }}>
            {saving ? 'SAVING...' : 'COMPLETE SESSION ✓'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── SIMPLE LOG (cardio / boxing / agility) ───────────────────────────────────
  if (view === 'log-cardio' || view === 'log-boxing' || view === 'log-agility') {
    const type = view.replace('log-', '') as 'cardio' | 'boxing' | 'agility';
    const titles: Record<string, string> = { cardio: 'CARDIO', boxing: 'PAD & BOXING', agility: 'AGILITY / FLEX / BW' };
    const details: Record<string, string> = {
      cardio: plan?.cardio_detail ?? '',
      boxing: plan?.boxing_focus ?? '',
      agility: plan?.agility_focus ?? '',
    };
    return (
      <div style={{ fontFamily: MONO, paddingTop: '4rem', background: BG, minHeight: '100vh' }}>
        <div style={{ padding: '1.25rem', borderBottom: B2, background: SURFACE, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p style={{ ...lbl, marginBottom: '0.3rem', color: '#333' }}>WEEK {week} — {plan?.phase?.toUpperCase()}</p>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{titles[type]}</h1>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.7rem', color: '#555', fontFamily: MONO }}>{details[type]}</p>
          </div>
          <button onClick={() => setView('plan')} style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', padding: '0.5rem 0.875rem', border: B2, background: '#fff', color: '#000', cursor: 'pointer', fontFamily: MONO }}>
            ← BACK
          </button>
        </div>

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <p style={{ ...lbl, marginBottom: '0.35rem' }}>DURATION (MIN)</p>
              <input type="number" value={simpleDuration} onChange={e => setSimpleDuration(e.target.value)} placeholder="30" style={inputStyle} />
            </div>
            <div>
              <p style={{ ...lbl, marginBottom: '0.35rem' }}>RPE</p>
              <input type="number" value={simpleRPE} onChange={e => setSimpleRPE(e.target.value)} placeholder="6" min="1" max="10" step="0.5" style={inputStyle} />
            </div>
          </div>
          {type === 'cardio' && (
            <div>
              <p style={{ ...lbl, marginBottom: '0.35rem' }}>AVG HEART RATE</p>
              <input type="number" value={simpleHR} onChange={e => setSimpleHR(e.target.value)} placeholder="135" style={inputStyle} />
            </div>
          )}
          <div>
            <p style={{ ...lbl, marginBottom: '0.35rem' }}>NOTES</p>
            <input value={simpleNotes} onChange={e => setSimpleNotes(e.target.value)} placeholder="Optional" style={inputStyle} />
          </div>
          <button onClick={() => handleSimpleLog(type)} disabled={saving}
            style={{ width: '100%', padding: '0.875rem', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', background: '#fff', color: '#000', border: B2, cursor: 'pointer', fontFamily: MONO }}>
            {saving ? 'SAVING...' : 'COMPLETE SESSION ✓'}
          </button>
        </div>
      </div>
    );
  }

  // ── MAIN PLAN VIEW ────────────────────────────────────────────────────────────
  const sessionTypes = [
    { type: 'strength', label: 'STRENGTH', sub: plan?.strength_prescription ?? '', action: () => setView('log-strength') },
    { type: 'cardio',   label: 'CARDIO',   sub: plan?.cardio_protocol ?? '',       action: () => setView('log-cardio') },
    { type: 'boxing',   label: 'BOXING',   sub: plan?.boxing_focus ?? '',           action: () => setView('log-boxing') },
    { type: 'agility',  label: 'AGILITY',  sub: plan?.agility_focus ?? '',          action: () => setView('log-agility') },
  ];

  return (
    <div style={{ fontFamily: MONO, paddingTop: '4rem', background: BG, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ padding: '1.25rem', borderBottom: B2, background: SURFACE }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <p style={{ ...lbl, marginBottom: '0.3rem', color: '#333' }}>FITNESS</p>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>TRAINING PLAN</h1>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => router.push('/fitness/exercises')}
              style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', padding: '0.5rem 0.75rem', border: B2, background: BG, color: '#fff', cursor: 'pointer', fontFamily: MONO }}>
              LIBRARY
            </button>
            <button onClick={() => setView('setup')}
              style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', padding: '0.5rem 0.75rem', border: '2px solid #161616', background: BG, color: '#444', cursor: 'pointer', fontFamily: MONO }}>
              SETUP
            </button>
          </div>
        </div>

        {/* Week / Phase badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <p style={{ ...lbl, marginBottom: '0.2rem', color: '#333' }}>WEEK</p>
            <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>{week}</p>
          </div>
          <div style={{ flex: 1 }}>
            <span style={{
              display: 'inline-block', padding: '0.3rem 0.75rem',
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em',
              color: '#000', background: phaseColor,
              fontFamily: MONO,
            }}>
              {plan?.phase?.toUpperCase() ?? ''}
            </span>
            {plan?.is_deload && (
              <span style={{ marginLeft: '0.5rem', display: 'inline-block', padding: '0.3rem 0.75rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', color: '#888', border: '1px solid #333', fontFamily: MONO }}>
                DELOAD
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lift weights this week */}
      {lifts.length > 0 && plan && (
        <div style={{ borderBottom: B2 }}>
          <div style={{ padding: '0.6rem 1.25rem', background: SURFACE, borderBottom: B1 }}>
            <span style={{ ...lbl, color: '#333' }}>THIS WEEK — {plan.strength_prescription}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {LIFTS.map((l, i) => {
              const pw = getPrescribedWeight(l.key);
              return (
                <div key={l.key} style={{ padding: '0.75rem 0.5rem', textAlign: 'center' as const, borderRight: i < 4 ? B1 : 'none' }}>
                  <p style={{ ...lbl, fontSize: '0.5rem', marginBottom: '0.3rem', color: '#333' }}>
                    {l.key.split(' ')[0].toUpperCase()}
                  </p>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: pw ? phaseColor : '#333' }}>
                    {pw ? `${pw}` : '—'}
                  </p>
                  <p style={{ ...lbl, fontSize: '0.5rem', marginTop: '0.1rem', color: '#2a2a2a' }}>kg</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Session cards */}
      <div style={{ padding: '0.6rem 1.25rem', background: SURFACE, borderBottom: B1 }}>
        <span style={{ ...lbl, color: '#333' }}>THIS WEEK'S SESSIONS</span>
      </div>

      {sessionTypes.map(s => {
        const done = sessionDone(s.type);
        return (
          <button key={s.type} onClick={s.action}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              width: '100%', padding: '1rem 1.25rem', background: done ? '#050505' : BG,
              border: 'none', borderBottom: B1, cursor: 'pointer', textAlign: 'left' as const, fontFamily: MONO,
            }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                <span style={{ fontWeight: 700, color: done ? '#333' : '#fff', fontSize: '0.875rem' }}>{s.label}</span>
                {done && <span style={{ fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.1em', color: '#4f8', border: '1px solid #4f8', padding: '0.1rem 0.35rem' }}>DONE</span>}
              </div>
              <p style={{ ...lbl, color: done ? '#222' : '#444', marginTop: '0.1rem' }}>{s.sub}</p>
            </div>
            <span style={{ color: done ? '#222' : '#444', fontSize: '1.2rem' }}>{done ? '✓' : '→'}</span>
          </button>
        );
      })}

      {/* Week navigation */}
      <div style={{ display: 'flex', borderTop: B2, marginTop: '1rem' }}>
        <button onClick={() => setWeek(w => Math.max(1, w - 1))}
          style={{ flex: 1, padding: '0.75rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', background: BG, color: week > 1 ? '#555' : '#222', border: 'none', borderRight: B1, cursor: 'pointer', fontFamily: MONO }}>
          ← PREV WEEK
        </button>
        <button onClick={() => setWeek(getCurrentTrainingWeek())}
          style={{ flex: 1, padding: '0.75rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', background: BG, color: '#444', border: 'none', borderRight: B1, cursor: 'pointer', fontFamily: MONO }}>
          TODAY
        </button>
        <button onClick={() => setWeek(w => Math.min(26, w + 1))}
          style={{ flex: 1, padding: '0.75rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', background: BG, color: week < 26 ? '#555' : '#222', border: 'none', cursor: 'pointer', fontFamily: MONO }}>
          NEXT WEEK →
        </button>
      </div>
    </div>
  );
}
