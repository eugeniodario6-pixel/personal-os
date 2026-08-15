'use client';

import { useEffect, useState, useCallback } from 'react';
import { getProfile, upsertProfile } from '@/lib/db';

const MONO = "'IBM Plex Mono', monospace";
const lbl = { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#888', margin: 0 };
const border2 = '2px solid #444';
const inputStyle = { width: '100%', fontFamily: MONO, fontSize: '0.875rem', background: '#000', color: '#fff', border: '2px solid #444', padding: '0.5rem 0.75rem', outline: 'none', boxSizing: 'border-box' as const };

export default function SettingsPage() {
  const [calTarget, setCalTarget] = useState('2000');
  const [protein, setProtein] = useState('150');
  const [carbs, setCarbs] = useState('200');
  const [fat, setFat] = useState('65');
  const [weightGoal, setWeightGoal] = useState('');
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [nonNumeric, setNonNumeric] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const prof = await getProfile();
    if (prof) {
      setCalTarget(String(prof.calorie_target));
      setProtein(String(prof.macro_targets.protein));
      setCarbs(String(prof.macro_targets.carbs));
      setFat(String(prof.macro_targets.fat));
      setWeightGoal(prof.weight_goal != null ? String(prof.weight_goal) : '');
      setUnits(prof.units);
      setNonNumeric(prof.non_numeric_mode);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    await upsertProfile({
      calorie_target: parseInt(calTarget) || 2000,
      macro_targets: { protein: parseInt(protein) || 150, carbs: parseInt(carbs) || 200, fat: parseInt(fat) || 65 },
      weight_goal: weightGoal ? parseFloat(weightGoal) : null,
      units,
      non_numeric_mode: nonNumeric,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return <div style={{ padding: '2rem', color: '#444', fontFamily: MONO, fontSize: '0.75rem' }}>LOADING...</div>;
  }

  return (
    <div style={{ fontFamily: MONO }}>
      <div style={{ padding: '1rem', borderBottom: border2 }}>
        <p style={{ ...lbl, marginBottom: '0.25rem' }}>SETTINGS</p>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>SET</h1>
      </div>

      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <section>
          <p style={{ ...lbl, marginBottom: '0.75rem' }}>DAILY GOALS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <p style={{ ...lbl, marginBottom: '0.25rem' }}>CALORIE TARGET (KCAL)</p>
              <input type="number" value={calTarget} onChange={e => setCalTarget(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              {[
                { label: 'PROTEIN (G)', val: protein, set: setProtein },
                { label: 'CARBS (G)', val: carbs, set: setCarbs },
                { label: 'FAT (G)', val: fat, set: setFat },
              ].map(m => (
                <div key={m.label}>
                  <p style={{ ...lbl, marginBottom: '0.25rem' }}>{m.label}</p>
                  <input type="number" value={m.val} onChange={e => m.set(e.target.value)} style={inputStyle} />
                </div>
              ))}
            </div>
            <div>
              <p style={{ ...lbl, marginBottom: '0.25rem' }}>WEIGHT GOAL (KG) — OPTIONAL</p>
              <input type="number" value={weightGoal} onChange={e => setWeightGoal(e.target.value)} placeholder="LEAVE BLANK TO SKIP" style={inputStyle} />
            </div>
            <div>
              <p style={{ ...lbl, marginBottom: '0.25rem' }}>UNITS</p>
              <select value={units} onChange={e => setUnits(e.target.value as 'metric' | 'imperial')} style={inputStyle}>
                <option value="metric">METRIC</option>
                <option value="imperial">IMPERIAL</option>
              </select>
            </div>
          </div>
        </section>

        <section>
          <p style={{ ...lbl, marginBottom: '0.75rem' }}>DISPLAY</p>
          <button onClick={() => setNonNumeric(!nonNumeric)}
            style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: nonNumeric ? '#fff' : '#000', border: border2, cursor: 'pointer', fontFamily: MONO, boxSizing: 'border-box' as const }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: nonNumeric ? '#000' : '#fff' }}>NON-NUMERIC MODE</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: nonNumeric ? '#000' : '#fff' }}>{nonNumeric ? '[X]' : '[ ]'}</span>
          </button>
          <p style={{ ...lbl, marginTop: '0.5rem', color: '#444' }}>HIDES CALORIE + WEIGHT NUMBERS APP-WIDE</p>
        </section>

        <button onClick={save}
          style={{ width: '100%', padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: saved ? '#888' : '#fff', color: '#000', border: border2, cursor: 'pointer', fontFamily: MONO }}>
          {saved ? 'SAVED ✓' : 'SAVE SETTINGS'}
        </button>
      </div>
    </div>
  );
}
