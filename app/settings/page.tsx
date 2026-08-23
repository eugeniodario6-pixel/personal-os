'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile, upsertProfile } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptic';
import { useTheme } from '@/components/ThemeProvider';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label" style={{ marginBottom: 6 }}>{label}</p>
      {children}
      {hint && <p style={{ fontSize: 12, color: 'var(--text-3)', letterSpacing: '-0.01em', marginTop: 6 }}>{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '0 20px 12px', background: '#141414', boxShadow: 'rgba(255,255,255,0.06) 0px 0px 0px 1px inset', borderRadius: 'var(--r)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <p className="label">{title}</p>
      </div>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [calTarget, setCalTarget]         = useState('2000');
  const [protein, setProtein]             = useState('150');
  const [carbs, setCarbs]                 = useState('200');
  const [fat, setFat]                     = useState('65');
  const [startingWeight, setStartingWeight] = useState('');
  const [weightGoal, setWeightGoal]       = useState('');
  const [units, setUnits]                 = useState<'metric' | 'imperial'>('metric');
  const [nonNumeric, setNonNumeric]       = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [loading, setLoading]             = useState(true);
  const { theme, toggle: toggleTheme }    = useTheme();

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
    const cal  = parseInt(calTarget) || 1800;
    const prot = parseInt(protein) || 176;
    const carbPct = 0.05;
    const carbG = Math.round(cal * carbPct / 4);
    const fatG  = Math.round((cal - prot * 4 - carbG * 4) / 9);
    await upsertProfile({
      calorie_target: cal,
      macro_targets: { protein: prot, carbs: parseInt(carbs) || carbG, fat: parseInt(fat) || fatG },
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

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: '-0.011em' }}>Loading…</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: '#000000', paddingTop: '4rem', paddingBottom: '8rem' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 20px 16px', marginBottom: 16 }}>
        <p style={{ fontSize: 12, letterSpacing: '0.01em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 6 }}>Preferences</p>
        <h1 style={{ fontSize: 40, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1.1, color: '#ffffff', margin: 0 }}>Settings</h1>
      </div>

      {/* ── Daily Goals ── */}
      <Section title="Daily goals">
        <Field label="Calorie target (kcal)">
          <input
            type="number" value={calTarget} onChange={e => setCalTarget(e.target.value)}
            style={{ background: 'var(--surface-2)', border: '1px solid rgba(216,234,255,0.08)', borderRadius: 14 }}
          />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'Protein (g)', val: protein, set: setProtein },
            { label: 'Carbs (g)',   val: carbs,   set: setCarbs },
            { label: 'Fat (g)',     val: fat,     set: setFat },
          ].map(m => (
            <Field key={m.label} label={m.label}>
              <input
                type="number" value={m.val} onChange={e => m.set(e.target.value)}
                style={{ background: 'var(--surface-2)', border: '1px solid rgba(216,234,255,0.08)', borderRadius: 14 }}
              />
            </Field>
          ))}
        </div>
        <Field label="Starting weight (kg)" hint="Your baseline — set once, track progress from here">
          <input
            type="number" value={startingWeight} onChange={e => setStartingWeight(e.target.value)} placeholder="e.g. 85"
            style={{ background: 'var(--surface-2)', border: '1px solid rgba(216,234,255,0.08)', borderRadius: 14 }}
          />
        </Field>
        <Field label="Weight goal (kg)">
          <input
            type="number" value={weightGoal} onChange={e => setWeightGoal(e.target.value)} placeholder="Optional"
            style={{ background: 'var(--surface-2)', border: '1px solid rgba(216,234,255,0.08)', borderRadius: 14 }}
          />
        </Field>
        <Field label="Units">
          <select
            value={units} onChange={e => setUnits(e.target.value as 'metric' | 'imperial')}
            style={{ background: 'var(--surface-2)', border: '1px solid rgba(216,234,255,0.08)', borderRadius: 14 }}
          >
            <option value="metric">Metric</option>
            <option value="imperial">Imperial</option>
          </select>
        </Field>
      </Section>

      {/* ── Display ── */}
      <Section title="Display">
        {/* Dark / Light mode toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 400, letterSpacing: '-0.011em', color: 'var(--text)', margin: '0 0 2px' }}>
              {theme === 'dark' ? '🌙 Dark mode' : '☀️ Light mode'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', letterSpacing: '-0.01em', margin: 0 }}>Follows system by default</p>
          </div>
          <button
            onClick={() => { haptic('light'); toggleTheme(); }}
            style={{
              width: 44, height: 24, borderRadius: 9999, flexShrink: 0,
              background: theme === 'dark' ? 'var(--text)' : 'var(--surface-3)',
              border: 'none', cursor: 'pointer', position: 'relative',
              transition: 'background 0.2s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: theme === 'dark' ? 23 : 3,
              width: 18, height: 18, borderRadius: '50%',
              background: theme === 'dark' ? 'var(--invert)' : 'var(--text-3)',
              transition: 'left 0.2s, background 0.2s',
            }} />
          </button>
        </div>

        {/* Non-numeric mode toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 400, letterSpacing: '-0.011em', color: 'var(--text)', margin: '0 0 2px' }}>Non-numeric mode</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', letterSpacing: '-0.01em', margin: 0 }}>Hides calorie and weight numbers app-wide</p>
          </div>
          <button
            onClick={() => { haptic('light'); setNonNumeric(!nonNumeric); }}
            style={{
              width: 44, height: 24, borderRadius: 9999, flexShrink: 0,
              background: nonNumeric ? 'var(--text)' : 'var(--surface-3)',
              border: 'none', cursor: 'pointer', position: 'relative',
              transition: 'background 0.2s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: nonNumeric ? 23 : 3,
              width: 18, height: 18, borderRadius: '50%',
              background: nonNumeric ? 'var(--invert)' : 'var(--text-3)',
              transition: 'left 0.2s, background 0.2s',
            }} />
          </button>
        </div>
      </Section>

      {/* ── Save ── */}
      <div style={{ margin: '0 16px 12px' }}>
        <button onClick={save} className="btn btn-primary btn-block">
          {saved ? 'Saved ✓' : 'Save settings'}
        </button>
      </div>

      {/* ── Account ── */}
      <Section title="Account">
        <button onClick={signOut} className="btn btn-ghost btn-block">
          Sign out →
        </button>
      </Section>
    </div>
  );
}
