'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { getWorkoutTemplates, addWorkoutTemplate, addWorkoutLog, getWorkoutLogs, getWorkoutHistory, deleteWorkoutLog, todayISO, type WorkoutTemplate, type WorkoutLog } from '@/lib/db';

const MONO = "'IBM Plex Mono', monospace";
const lbl = { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#888', margin: 0 };
const border2 = '2px solid #444';

function FitnessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'templates' | 'history'>('templates');
  const [mode, setMode] = useState<'view' | 'add'>(searchParams.get('action') === 'add' ? 'add' : 'view');
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [todayLogs, setTodayLogs] = useState<WorkoutLog[]>([]);
  const [history, setHistory] = useState<WorkoutLog[]>([]);
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState('');
  const [addDuration, setAddDuration] = useState('30');
  const [addIntensity, setAddIntensity] = useState<'low' | 'moderate' | 'high'>('moderate');

  const load = useCallback(async () => {
    const today = todayISO();
    const [tmpl, tLogs, hist] = await Promise.all([
      getWorkoutTemplates(),
      getWorkoutLogs(today),
      getWorkoutHistory(30),
    ]);
    setTemplates(tmpl);
    setTodayLogs(tLogs);
    setHistory(hist);
  }, []);

  useEffect(() => { load(); }, [load]);

  const logTemplate = async (t: WorkoutTemplate) => {
    await addWorkoutLog({
      date: todayISO(), template_id: t.id, name: t.name,
      duration_min: t.default_duration_min, intensity: t.default_intensity,
      calories_burned: null, source: 'manual', logged_at: new Date().toISOString(),
    });
    await load();
  };

  const removeLog = async (id: number) => {
    await deleteWorkoutLog(id);
    await load();
  };

  const saveLog = async () => {
    if (!addName.trim()) return;
    const existing = templates.find(t => t.name.toLowerCase() === addName.trim().toLowerCase());
    if (!existing) {
      await addWorkoutTemplate({
        name: addName.trim(), category: addCategory.trim() || 'General',
        default_duration_min: parseInt(addDuration) || 30, default_intensity: addIntensity,
      });
    }
    await addWorkoutLog({
      date: todayISO(), template_id: existing?.id ?? null, name: addName.trim(),
      duration_min: parseInt(addDuration) || 30, intensity: addIntensity,
      calories_burned: null, source: 'manual', logged_at: new Date().toISOString(),
    });
    setAddName(''); setAddCategory(''); setAddDuration('30'); setAddIntensity('moderate');
    await load();
    setMode('view');
    router.replace('/fitness');
  };

  const inputStyle = { width: '100%', fontFamily: MONO, fontSize: '0.875rem', background: '#000', color: '#fff', border: '2px solid #444', padding: '0.5rem 0.75rem', outline: 'none', boxSizing: 'border-box' as const };

  return (
    <div style={{ fontFamily: MONO }}>
      <div style={{ padding: '1rem', borderBottom: border2, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <p style={{ ...lbl, marginBottom: '0.25rem' }}>FITNESS</p>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>MOVE</h1>
        </div>
        <Link href="/fitness/calculators" style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.5rem 0.75rem', border: border2, background: '#000', color: '#fff', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>CALC</Link>
        <button onClick={() => { setMode(mode === 'add' ? 'view' : 'add'); if (mode === 'add') router.replace('/fitness'); }}
          style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.5rem 0.75rem', border: border2, background: mode === 'add' ? '#fff' : '#000', color: mode === 'add' ? '#000' : '#fff', cursor: 'pointer' }}>
          {mode === 'add' ? '← BACK' : '+ LOG'}
        </button>
      </div>

      {mode === 'add' && (
        <div style={{ padding: '1rem', borderBottom: border2 }}>
          <p style={{ ...lbl, marginBottom: '1rem' }}>LOG WORKOUT</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div><p style={{ ...lbl, marginBottom: '0.25rem' }}>NAME *</p>
              <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="E.G. MORNING RUN" style={inputStyle} /></div>
            <div><p style={{ ...lbl, marginBottom: '0.25rem' }}>CATEGORY</p>
              <input value={addCategory} onChange={e => setAddCategory(e.target.value)} placeholder="E.G. CARDIO" style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div><p style={{ ...lbl, marginBottom: '0.25rem' }}>DURATION (MIN)</p>
                <input type="number" value={addDuration} onChange={e => setAddDuration(e.target.value)} min="1" style={inputStyle} /></div>
              <div><p style={{ ...lbl, marginBottom: '0.25rem' }}>INTENSITY</p>
                <select value={addIntensity} onChange={e => setAddIntensity(e.target.value as 'low' | 'moderate' | 'high')} style={inputStyle}>
                  <option value="low">LOW</option>
                  <option value="moderate">MODERATE</option>
                  <option value="high">HIGH</option>
                </select></div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={saveLog} style={{ flex: 1, padding: '0.6rem 1rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: '#fff', color: '#000', border: border2, cursor: 'pointer', fontFamily: MONO }}>SAVE & LOG</button>
              <button onClick={() => { setMode('view'); router.replace('/fitness'); }} style={{ flex: 1, padding: '0.6rem 1rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: '#000', color: '#888', border: '2px solid #444', cursor: 'pointer', fontFamily: MONO }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {mode === 'view' && (
        <>
          <div style={{ display: 'flex', borderBottom: border2 }}>
            {(['templates', 'history'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '0.6rem 1rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', textAlign: 'center', border: 'none', background: '#000', cursor: 'pointer', marginBottom: -2, color: tab === t ? '#fff' : '#444', borderBottom: `2px solid ${tab === t ? '#fff' : '#444'}`, fontFamily: MONO }}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {tab === 'templates' && (
            <>
              <div style={{ borderBottom: border2 }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}><span style={lbl}>TODAY</span></div>
                {todayLogs.length === 0 ? (
                  <div style={{ padding: '1rem', color: '#444', fontSize: '0.75rem' }}>NOTHING LOGGED TODAY.</div>
                ) : todayLogs.map(w => (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', padding: '0.875rem 1rem', borderBottom: '1px solid #111' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '0.875rem' }}>{w.name}</p>
                      <p style={{ ...lbl, marginTop: '0.2rem' }}>{w.duration_min} MIN · {w.intensity.toUpperCase()}</p>
                    </div>
                    <button onClick={() => removeLog(w.id)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '1rem', fontFamily: MONO, padding: '0.25rem' }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}><span style={lbl}>QUICK LOG — TAP TO LOG</span></div>
              {templates.length === 0 ? (
                <div style={{ padding: '1.5rem 1rem', color: '#444', fontSize: '0.75rem' }}>NO TEMPLATES YET. USE + LOG TO ADD ONE.</div>
              ) : templates.map(t => (
                <button key={t.id} onClick={() => logTemplate(t)} style={{ display: 'flex', width: '100%', padding: '0.875rem 1rem', background: '#000', border: 'none', borderBottom: '1px solid #111', cursor: 'pointer', textAlign: 'left', justifyContent: 'space-between', alignItems: 'center', fontFamily: MONO }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '0.875rem' }}>{t.name}</p>
                    <p style={{ ...lbl, marginTop: '0.2rem' }}>{t.category} · {t.default_duration_min} MIN</p>
                  </div>
                  <span style={{ color: '#444' }}>+</span>
                </button>
              ))}
            </>
          )}

          {tab === 'history' && (
            <>
              {history.length === 0 ? (
                <div style={{ padding: '2rem 1rem', color: '#444', fontSize: '0.75rem' }}>NO WORKOUTS LOGGED YET.</div>
              ) : history.map(w => (
                <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1rem', borderBottom: '1px solid #111' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '0.875rem' }}>{w.name}</p>
                    <p style={{ ...lbl, marginTop: '0.2rem' }}>{w.date} · {w.duration_min} MIN · {w.intensity.toUpperCase()}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function FitnessPage() {
  return <Suspense fallback={<div style={{ padding: '2rem', color: '#444', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' }}>LOADING...</div>}><FitnessContent /></Suspense>;
}
