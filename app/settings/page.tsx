'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile, upsertProfile } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptic';

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
    const cal = parseInt(calTarget) || 1800;
    const prot = parseInt(protein) || 176;
    const carbPct = 0.05;
    const carbG = Math.round(cal * carbPct / 4);
    const fatG = Math.round((cal - prot * 4 - carbG * 4) / 9);
    await upsertProfile({
      calorie_target: cal,
      macro_targets: {
        protein: prot,
        carbs: parseInt(carbs) || carbG,
        fat: parseInt(fat) || fatG,
      },
      starting_weight: startingWeight ? parseFloat(startingWeight) : null,
      weight_goal: weightGoal ? parseFloat(weightGoal) : null,
      units,
      non_numeric_mode: nonNumeric,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      height_cm: null,
      current_weight_kg: startingWeight ? parseFloat(startingWeight) : null,
      ideal_weight_lbs: null,
      protein_target_g: prot,
      carb_percent: carbPct,
      score_weights: { protein: 0.4, calories: 0.3, carbs: 0.2, fat: 0.1 },
      carb_target_g: null,
      fat_target_g: null,
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
      <div style={{ padding: '2rem', color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
        LOADING...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'var(--font-mono)', paddingTop: '4rem' }}>

      {/* Header */}
      <div style={{ padding: '1.25rem', borderBottom: '2px solid var(--border)' }}>
        <p className="label" style={{ marginBottom: '0.3rem' }}>SETTINGS</p>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>SET</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* ── Daily Goals ── */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--surface-2)' }}>
          <p className="label" style={{ marginBottom: '1rem' }}>DAILY GOALS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <p className="label" style={{ marginBottom: '0.35rem' }}>CALORIE TARGET (KCAL)</p>
              <input type="number" value={calTarget} onChange={e => setCalTarget(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              {[
                { label: 'PROTEIN (G)', val: protein, set: setProtein },
                { label: 'CARBS (G)',   val: carbs,   set: setCarbs },
                { label: 'FAT (G)',     val: fat,     set: setFat },
              ].map(m => (
                <div key={m.label}>
                  <p className="label" style={{ marginBottom: '0.35rem' }}>{m.label}</p>
                  <input type="number" value={m.val} onChange={e => m.set(e.target.value)} />
                </div>
              ))}
            </div>
            <div>
              <p className="label" style={{ marginBottom: '0.35rem' }}>STARTING WEIGHT (KG)</p>
              <input
                type="number"
                value={startingWeight}
                onChange={e => setStartingWeight(e.target.value)}
                placeholder="E.G. 85"
              />
              <p className="label" style={{ marginTop: '0.35rem', color: 'var(--text-ghost)' }}>YOUR BASELINE — SET ONCE, TRACK PROGRESS FROM HERE</p>
            </div>
            <div>
              <p className="label" style={{ marginBottom: '0.35rem' }}>WEIGHT GOAL (KG) — OPTIONAL</p>
              <input
                type="number"
                value={weightGoal}
                onChange={e => setWeightGoal(e.target.value)}
                placeholder="LEAVE BLANK TO SKIP"
              />
            </div>
            <div>
              <p className="label" style={{ marginBottom: '0.35rem' }}>UNITS</p>
              <select value={units} onChange={e => setUnits(e.target.value as 'metric' | 'imperial')}>
                <option value="metric">METRIC</option>
                <option value="imperial">IMPERIAL</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Display ── */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--surface-2)' }}>
          <p className="label" style={{ marginBottom: '1rem' }}>DISPLAY</p>

          {/* Non-numeric toggle */}
          <button
            onClick={() => { haptic('light'); setNonNumeric(!nonNumeric); }}
            style={{
              display: 'flex', width: '100%',
              justifyContent: 'space-between', alignItems: 'center',
              padding: '0.875rem 1rem',
              background: nonNumeric ? 'var(--text)' : 'var(--surface)',
              border: '2px solid var(--border)',
              cursor: 'pointer', fontFamily: 'var(--font-mono)',
              boxSizing: 'border-box' as const,
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', color: nonNumeric ? 'var(--bg)' : 'var(--text)' }}>
              NON-NUMERIC MODE
            </span>
            <span style={{
              fontSize: '0.8rem', fontWeight: 700,
              color: nonNumeric ? 'var(--bg)' : 'var(--text-ghost)',
              border: `2px solid ${nonNumeric ? 'var(--bg)' : 'var(--text-ghost)'}`,
              padding: '0.1rem 0.4rem',
              lineHeight: 1,
            }}>
              {nonNumeric ? 'ON' : 'OFF'}
            </span>
          </button>
          <p className="label" style={{ color: 'var(--text-ghost)' }}>HIDES CALORIE + WEIGHT NUMBERS APP-WIDE</p>
        </div>

        {/* ── Save ── */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--surface-2)' }}>
          <button
            onClick={save}
            className="btn btn-primary btn-block"
            style={{ background: saved ? 'var(--accent)' : undefined }}
          >
            {saved ? 'SAVED ✓' : 'SAVE SETTINGS'}
          </button>
        </div>

        {/* ── Account ── */}
        <div style={{ padding: '1.25rem' }}>
          <p className="label" style={{ marginBottom: '1rem' }}>ACCOUNT</p>
          <button
            onClick={signOut}
            className="btn btn-ghost btn-block"
          >
            SIGN OUT →
          </button>
        </div>

      </div>
    </div>
  );
}
