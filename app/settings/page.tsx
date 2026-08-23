'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile, upsertProfile } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptic';

export default function SettingsPage() {
  const router = useRouter();
  const [calTarget,       setCalTarget]       = useState('1800');
  const [protein,         setProtein]         = useState('176');
  const [fat,             setFat]             = useState('');
  const [carbs,           setCarbs]           = useState('');
  const [startingWeight,  setStartingWeight]  = useState('');
  const [weightGoal,      setWeightGoal]      = useState('');
  const [units,           setUnits]           = useState<'metric' | 'imperial'>('metric');
  const [nonNumeric,      setNonNumeric]       = useState(false);
  const [saved,           setSaved]           = useState(false);
  const [loading,         setLoading]         = useState(true);

  const load = useCallback(async () => {
    const p = await getProfile();
    if (p) {
      setCalTarget(String(p.calorie_target));
      setProtein(String(p.protein_target_g ?? p.macro_targets.protein));
      setFat(String(p.macro_targets.fat));
      setCarbs(String(p.macro_targets.carbs));
      setStartingWeight(p.starting_weight != null ? String(p.starting_weight) : '');
      setWeightGoal(p.weight_goal != null ? String(p.weight_goal) : '');
      setUnits(p.units);
      setNonNumeric(p.non_numeric_mode);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    haptic('medium');
    const cal    = parseInt(calTarget) || 1800;
    const prot   = parseFloat(protein) || 176;
    const carbPct = 0.05;
    const carbG  = carbs ? parseFloat(carbs) : Math.round(cal * carbPct / 4);
    const fatG   = fat ? parseFloat(fat) : Math.round((cal - prot * 4 - carbG * 4) / 9);
    await upsertProfile({
      calorie_target: cal,
      macro_targets: { protein: prot, carbs: carbG, fat: fatG },
      starting_weight: startingWeight ? parseFloat(startingWeight) : null,
      weight_goal: weightGoal ? parseFloat(weightGoal) : null,
      units, non_numeric_mode: nonNumeric,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      height_cm: null, current_weight_kg: startingWeight ? parseFloat(startingWeight) : null,
      ideal_weight_lbs: null, protein_target_g: prot, carb_percent: carbPct,
      score_weights: { protein: 0.4, calories: 0.3, carbs: 0.2, fat: 0.1 },
      carb_target_g: null, fat_target_g: null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const signOut = async () => { haptic('light'); await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <div className="page">

      <div className="page-head">
        <div className="page-head-left">
          <span className="label" style={{ color: 'var(--text-ghost)' }}>SETTINGS</span>
          <span className="page-title">Preferences</span>
        </div>
      </div>

      {/* Nutrition targets */}
      <div className="section-label"><span className="label">Nutrition targets</span></div>
      <div className="section">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div>
            <p className="label" style={{ marginBottom: '0.4rem' }}>Daily calorie target</p>
            <input type="number" value={calTarget} onChange={e => setCalTarget(e.target.value)} placeholder="1800" />
          </div>
          <div>
            <p className="label" style={{ marginBottom: '0.4rem' }}>Protein target (g)</p>
            <input type="number" value={protein} onChange={e => setProtein(e.target.value)} placeholder="176" />
          </div>
          <div>
            <p className="label" style={{ marginBottom: '0.4rem' }}>Fat target (g)</p>
            <input type="number" value={fat} onChange={e => setFat(e.target.value)} placeholder="auto" />
            <p className="label-xs" style={{ marginTop: '0.35rem' }}>Leave blank to auto-compute from calories</p>
          </div>
          <div>
            <p className="label" style={{ marginBottom: '0.4rem' }}>Carbs target (g)</p>
            <input type="number" value={carbs} onChange={e => setCarbs(e.target.value)} placeholder="auto" />
            <p className="label-xs" style={{ marginTop: '0.35rem' }}>Leave blank to use 5% of calories</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="section-label"><span className="label">Body</span></div>
      <div className="section">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div>
            <p className="label" style={{ marginBottom: '0.4rem' }}>Starting weight (kg)</p>
            <input type="number" value={startingWeight} onChange={e => setStartingWeight(e.target.value)} placeholder="e.g. 92" />
            <p className="label-xs" style={{ marginTop: '0.35rem' }}>Your baseline — set once, track from here</p>
          </div>
          <div>
            <p className="label" style={{ marginBottom: '0.4rem' }}>Weight goal (kg) — optional</p>
            <input type="number" value={weightGoal} onChange={e => setWeightGoal(e.target.value)} placeholder="Leave blank to skip" />
          </div>
          <div>
            <p className="label" style={{ marginBottom: '0.4rem' }}>Units</p>
            <select value={units} onChange={e => setUnits(e.target.value as 'metric' | 'imperial')}>
              <option value="metric">Metric</option>
              <option value="imperial">Imperial</option>
            </select>
          </div>
        </div>
      </div>

      {/* Display */}
      <div className="section-label"><span className="label">Display</span></div>
      <button
        className="toggle-row t-fast"
        onClick={() => { haptic('light'); setNonNumeric(n => !n); }}
        style={{ width: '100%', border: 'none', background: 'var(--bg)' }}
      >
        <div style={{ textAlign: 'left' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Non-numeric mode</p>
          <p className="label-xs" style={{ marginTop: '0.2rem' }}>Hides calorie and weight numbers app-wide</p>
        </div>
        <span className={`toggle-pill${nonNumeric ? ' on' : ''}`}>{nonNumeric ? 'ON' : 'OFF'}</span>
      </button>

      {/* Actions */}
      <div className="section" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <button
          className="btn btn-primary btn-block"
          onClick={save}
          style={{ background: saved ? 'var(--positive)' : undefined }}
        >
          {saved ? 'Saved ✓' : 'Save settings'}
        </button>
        <button className="btn btn-ghost btn-block" onClick={signOut}>Sign out</button>
      </div>

    </div>
  );
}
