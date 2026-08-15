'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db, todayISO, type WorkoutTemplate, type WorkoutLog } from '@/lib/db';

type Intensity = 'low' | 'moderate' | 'high';
type Mode = 'grid' | 'add' | 'history';

function FitnessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initAction = searchParams.get('action');

  const [mode, setMode] = useState<Mode>(initAction === 'add' ? 'add' : 'grid');
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDuration, setFormDuration] = useState('30');
  const [formIntensity, setFormIntensity] = useState<Intensity>('moderate');
  const [formCalories, setFormCalories] = useState('');
  const [formError, setFormError] = useState('');
  const [loggedTemplate, setLoggedTemplate] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const [tmpl, wLogs] = await Promise.all([
      db.workout_template.toArray(),
      db.workout_log.reverse().limit(30).sortBy('logged_at'),
    ]);
    setTemplates(tmpl);
    setLogs(wLogs);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleQuickLog = async (template: WorkoutTemplate) => {
    await db.workout_log.add({
      id: undefined as unknown as number,
      date: todayISO(),
      template_id: template.id,
      name: template.name,
      duration_min: template.default_duration_min,
      intensity: template.default_intensity,
      calories_burned: null,
      source: 'manual',
      logged_at: new Date().toISOString(),
    });
    setLoggedTemplate(template.id);
    await loadData();
    setTimeout(() => setLoggedTemplate(null), 2000);
  };

  const handleAddWorkout = async () => {
    setFormError('');
    if (!formName.trim()) { setFormError('NAME REQUIRED'); return; }
    if (!formDuration) { setFormError('DURATION REQUIRED'); return; }

    await db.workout_log.add({
      id: undefined as unknown as number,
      date: todayISO(),
      template_id: null,
      name: formName.trim(),
      duration_min: parseInt(formDuration) || 30,
      intensity: formIntensity,
      calories_burned: formCalories ? parseInt(formCalories) : null,
      source: 'manual',
      logged_at: new Date().toISOString(),
    });

    setFormName(''); setFormDuration('30'); setFormIntensity('moderate'); setFormCalories('');
    await loadData();
    setMode('grid');
    router.replace('/fitness');
  };

  const handleDeleteLog = async (id: number) => {
    await db.workout_log.delete(id);
    await loadData();
  };

  const todayLogs = logs.filter((l) => l.date === todayISO());

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: '2px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <p className="label" style={{ marginBottom: '0.25rem' }}>FITNESS</p>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', fontFamily: "'IBM Plex Mono', monospace" }}>MOVE</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn" onClick={() => { setMode(mode === 'add' ? 'grid' : 'add'); if (mode !== 'add') router.replace('/fitness?action=add'); else router.replace('/fitness'); }} style={{ fontSize: '0.6rem', padding: '0.5rem 0.75rem' }}>
            {mode === 'add' ? '← BACK' : '+ LOG'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      {mode !== 'add' && (
        <div className="tab-bar">
          <button className={`tab ${mode === 'grid' ? 'active' : ''}`} onClick={() => setMode('grid')}>TEMPLATES</button>
          <button className={`tab ${mode === 'history' ? 'active' : ''}`} onClick={() => setMode('history')}>HISTORY</button>
        </div>
      )}

      {mode === 'grid' && (
        <>
          {/* Today's workouts */}
          {todayLogs.length > 0 && (
            <div style={{ borderBottom: '2px solid #444' }}>
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}>
                <span className="label">TODAY</span>
              </div>
              {todayLogs.map((log) => (
                <div key={log.id} style={{ display: 'flex', alignItems: 'center', padding: '0.875rem 1rem', borderBottom: '1px solid #111' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: '#fff', fontSize: '0.875rem' }}>{log.name}</p>
                    <p className="label">{log.duration_min} MIN · {log.intensity.toUpperCase()}{log.calories_burned ? ` · ${log.calories_burned} KCAL` : ''}</p>
                  </div>
                  <button onClick={() => handleDeleteLog(log.id)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '1rem', fontFamily: "'IBM Plex Mono', monospace" }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Template grid */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}>
            <span className="label">QUICK LOG — TAP TO LOG</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
            {templates.map((t, i) => (
              <button
                key={t.id}
                onClick={() => handleQuickLog(t)}
                style={{
                  padding: '1rem',
                  background: loggedTemplate === t.id ? '#fff' : '#000',
                  color: loggedTemplate === t.id ? '#000' : '#fff',
                  border: 'none',
                  borderBottom: '1px solid #111',
                  borderRight: i % 2 === 0 ? '1px solid #111' : 'none',
                  cursor: 'pointer',
                  fontFamily: "'IBM Plex Mono', monospace",
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                  {loggedTemplate === t.id ? '[X] ' : '[ ] '}{t.name}
                </span>
                <span className="label" style={{ color: loggedTemplate === t.id ? '#444' : undefined }}>
                  {t.default_duration_min}MIN · {t.default_intensity.toUpperCase()}
                </span>
                <span className="label" style={{ color: loggedTemplate === t.id ? '#444' : undefined }}>
                  {t.category.toUpperCase()}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {mode === 'history' && (
        <div>
          {logs.length === 0 ? (
            <div style={{ padding: '2rem 1rem', color: '#444', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' }}>NO WORKOUT HISTORY YET.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace" }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #444' }}>
                  {['DATE', 'WORKOUT', 'MIN', 'INTENSITY'].map((h) => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.6rem', letterSpacing: '0.1em', color: '#888', fontWeight: 700, borderRight: '1px solid #111' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #111', background: i % 2 === 0 ? '#000' : '#111' }}>
                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: '#888', borderRight: '1px solid #111' }}>{log.date}</td>
                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: '#fff', fontWeight: 700, borderRight: '1px solid #111' }}>{log.name}</td>
                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: '#fff', borderRight: '1px solid #111' }}>{log.duration_min}</td>
                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{log.intensity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {mode === 'add' && (
        <div style={{ padding: '1rem' }}>
          <p className="label" style={{ marginBottom: '1rem' }}>LOG MANUAL WORKOUT</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {formError && (
              <p style={{ color: '#fff', background: '#111', border: '1px solid #888', padding: '0.5rem', fontSize: '0.75rem', fontFamily: "'IBM Plex Mono', monospace" }}>
                ⚠ {formError}
              </p>
            )}
            <div>
              <p className="label" style={{ marginBottom: '0.25rem' }}>WORKOUT NAME *</p>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="E.G. MORNING RUN" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <p className="label" style={{ marginBottom: '0.25rem' }}>DURATION (MIN) *</p>
                <input type="number" value={formDuration} onChange={(e) => setFormDuration(e.target.value)} min="1" />
              </div>
              <div>
                <p className="label" style={{ marginBottom: '0.25rem' }}>CALORIES BURNED</p>
                <input type="number" value={formCalories} onChange={(e) => setFormCalories(e.target.value)} placeholder="OPTIONAL" min="0" />
              </div>
            </div>
            <div>
              <p className="label" style={{ marginBottom: '0.25rem' }}>INTENSITY</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['low', 'moderate', 'high'] as Intensity[]).map((level) => (
                  <button
                    key={level}
                    className={formIntensity === level ? 'btn-primary btn' : 'btn btn-ghost'}
                    onClick={() => setFormIntensity(level)}
                    style={{ flex: 1, fontSize: '0.6rem' }}
                  >
                    {level.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button className="btn-primary btn" onClick={handleAddWorkout} style={{ flex: 1 }}>SAVE WORKOUT</button>
              <button className="btn btn-ghost" onClick={() => { setMode('grid'); router.replace('/fitness'); }} style={{ flex: 1 }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FitnessPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: '#444', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' }}>LOADING...</div>}>
      <FitnessContent />
    </Suspense>
  );
}
