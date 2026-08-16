'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile, upsertProfile } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptic';

const MONO = "'IBM Plex Mono', monospace";
const border2 = '2px solid #2a2a2a';
const lbl = {
  fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em',
  textTransform: 'uppercase' as const, color: '#666', margin: 0,
};
const inputStyle = {
  width: '100%', fontFamily: MONO, fontSize: '0.875rem',
  background: '#080808', color: '#fff', border: '2px solid #2a2a2a',
  padding: '0.65rem 0.875rem', outline: 'none', boxSizing: 'border-box' as const,
};

export default function SettingsPage() {
  const router = useRouter();
  const [calTarget, setCalTarget] = useState('2000');
  const [protein, setProtein] = useState('150');
  const [carbs, setCarbs] = useState('200');
  const [fat, setFat] = useState('65');
  const [startingWeight, setStartingWeight] = useState('');
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
      setStartingWeight(prof.starting_weight != null ? String(prof.starting_weight) : '');
      setWeightGoal(prof.weight_goal != null ? String(prof.weight_goal) : '');
      setUnits(prof.units);
      setNonNumeric(prof.non_numeric_mode);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    haptic('medium');
    await upsertProfile({
      calorie_target: parseInt(calTarget) || 2000,
      macro_targets: {
        protein: parseInt(protein) || 150,
        carbs: parseInt(carbs) || 200,
        fat: parseInt(fat) || 65,
      },
      starting_weight: startingWeight ? parseFloat(startingWeight) : null,
      weight_goal: weightGoal ? parseFloat(weightGoal) : null,
      units,
      non_numeric_mode: nonNumeric,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const signOut = async () => {
    haptic('light');
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#444', fontFamily: MONO, fontSize: '0.75rem' }}>
        LOADING...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: MONO, paddingTop: '4rem' }}>

      {/* Header */}
      <div style={{ padding: '1.25rem', borderBottom: border2 }}>
        <p style={{ ...lbl, marginBottom: '0.3rem' }}>SETTINGS</p>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>SET</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* ── Daily Goals ── */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #1a1a1a' }}>
          <p style={{ ...lbl, marginBottom: '1rem' }}>DAILY GOALS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <p style={{ ...lbl, marginBottom: '0.35rem' }}>CALORIE TARGET (KCAL)</p>
              <input type="number" value={calTarget} onChange={e => setCalTarget(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              {[
                { label: 'PROTEIN (G)', val: protein, set: setProtein },
                { label: 'CARBS (G)',   val: carbs,   set: setCarbs },
                { label: 'FAT (G)',     val: fat,     set: setFat },
              ].map(m => (
                <div key={m.label}>
                  <p style={{ ...lbl, marginBottom: '0.35rem' }}>{m.label}</p>
                  <input type="number" value={m.val} onChange={e => m.set(e.target.value)} style={inputStyle} />
                </div>
              ))}
            </div>
            <div>
              <p style={{ ...lbl, marginBottom: '0.35rem' }}>STARTING WEIGHT (KG)</p>
              <input
                type="number"
                value={startingWeight}
                onChange={e => setStartingWeight(e.target.value)}
                placeholder="E.G. 85"
                style={inputStyle}
              />
              <p style={{ ...lbl, marginTop: '0.35rem', color: '#333' }}>YOUR BASELINE — SET ONCE, TRACK PROGRESS FROM HERE</p>
            </div>
            <div>
              <p style={{ ...lbl, marginBottom: '0.35rem' }}>WEIGHT GOAL (KG) — OPTIONAL</p>
              <input
                type="number"
                value={weightGoal}
                onChange={e => setWeightGoal(e.target.value)}
                placeholder="LEAVE BLANK TO SKIP"
                style={inputStyle}
              />
            </div>
            <div>
              <p style={{ ...lbl, marginBottom: '0.35rem' }}>UNITS</p>
              <select value={units} onChange={e => setUnits(e.target.value as 'metric' | 'imperial')} style={inputStyle}>
                <option value="metric">METRIC</option>
                <option value="imperial">IMPERIAL</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Display ── */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #1a1a1a' }}>
          <p style={{ ...lbl, marginBottom: '1rem' }}>DISPLAY</p>

          {/* Non-numeric toggle */}
          <button
            onClick={() => { haptic('light'); setNonNumeric(!nonNumeric); }}
            style={{
              display: 'flex', width: '100%',
              justifyContent: 'space-between', alignItems: 'center',
              padding: '0.875rem 1rem',
              background: nonNumeric ? '#fff' : '#080808',
              border: '2px solid #2a2a2a',
              cursor: 'pointer', fontFamily: MONO,
              boxSizing: 'border-box' as const,
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', color: nonNumeric ? '#000' : '#fff' }}>
              NON-NUMERIC MODE
            </span>
            <span style={{
              fontSize: '0.8rem', fontWeight: 700,
              color: nonNumeric ? '#000' : '#333',
              border: `2px solid ${nonNumeric ? '#000' : '#333'}`,
              padding: '0.1rem 0.4rem',
              lineHeight: 1,
            }}>
              {nonNumeric ? 'ON' : 'OFF'}
            </span>
          </button>
          <p style={{ ...lbl, color: '#333' }}>HIDES CALORIE + WEIGHT NUMBERS APP-WIDE</p>
        </div>

        {/* ── Save ── */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #1a1a1a' }}>
          <button
            onClick={save}
            style={{
              width: '100%', padding: '0.875rem 1rem',
              fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase',
              background: saved ? '#F5A623' : '#fff',
              color: '#000', border: border2,
              cursor: 'pointer', fontFamily: MONO,
            }}
          >
            {saved ? 'SAVED ✓' : 'SAVE SETTINGS'}
          </button>
        </div>

        {/* ── Account ── */}
        <div style={{ padding: '1.25rem' }}>
          <p style={{ ...lbl, marginBottom: '1rem' }}>ACCOUNT</p>
          <button
            onClick={signOut}
            style={{
              width: '100%', padding: '0.875rem 1rem',
              fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase',
              background: '#000', color: '#666',
              border: '2px solid #1a1a1a',
              cursor: 'pointer', fontFamily: MONO,
            }}
          >
            SIGN OUT →
          </button>
        </div>

      </div>
    </div>
  );
}
