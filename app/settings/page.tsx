'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile, upsertProfile } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptic';
import { useTheme } from '@/components/ThemeProvider';

// ─── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginBottom: 8, margin: '0 0 8px' }}>{label}</p>
      {children}
      {hint && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 6, lineHeight: 1.5, margin: '6px 0 0' }}>{hint}</p>}
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--color-carbon)', borderRadius: 20, border: 'none', overflow: 'hidden', marginBottom: 10 }}>
      <div style={{ padding: '12px 20px', borderBottom: 'none' }}>
        <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', margin: 0 }}>{title}</p>
      </div>
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 12,
  color: '#fff',
  fontSize: 15,
  padding: '13px 16px',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
};

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
    <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)' }}>Loading…</p>
    </div>
  );

  const PAD = 16;

  return (
    <div style={{ minHeight: '100dvh', background: '#000', paddingTop: '4.5rem', paddingBottom: '130px' }}>

      {/* ── Header ── */}
      <div style={{ padding: `0 ${PAD}px 24px` }}>
        <p style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 10, marginTop: 4 }}>Preferences</p>
        <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff', margin: 0 }}>Settings</h1>
      </div>

      <div style={{ padding: `0 ${PAD}px` }}>

        {/* ── Targets bento strip ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div style={{ background: 'var(--color-carbon)', borderRadius: 20, border: 'none', padding: '16px 18px', gridColumn: '1/-1' }}>
            <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', margin: '0 0 14px' }}>Daily Calorie Target</p>
            <input
              type="number" value={calTarget} onChange={e => setCalTarget(e.target.value)}
              style={{ ...inputStyle, fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', textAlign: 'center', borderRadius: 14 }}
            />
          </div>
        </div>

        {/* ── Macro targets strip ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 10 }}>
          {[
            { label: 'Protein', unit: 'g', val: protein, set: setProtein },
            { label: 'Carbs', unit: 'g', val: carbs, set: setCarbs },
            { label: 'Fat', unit: 'g', val: fat, set: setFat },
          ].map(m => (
            <div key={m.label} style={{ background: 'var(--color-carbon)', borderRadius: 18, border: 'none', padding: '14px 14px 12px' }}>
              <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', margin: '0 0 8px' }}>{m.label}</p>
              <input
                type="number" value={m.val} onChange={e => m.set(e.target.value)}
                style={{ ...inputStyle, fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em', textAlign: 'center', padding: '10px 12px', borderRadius: 10 }}
              />
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', margin: '4px 0 0', textAlign: 'center' }}>{m.unit}</p>
            </div>
          ))}
        </div>

        {/* ── Weight goals ── */}
        <Section title="Weight goals">
          <Field label="Starting weight (kg)" hint="Set once — tracks progress from here">
            <input type="number" value={startingWeight} onChange={e => setStartingWeight(e.target.value)} placeholder="e.g. 85.0" style={inputStyle} />
          </Field>
          <Field label="Goal weight (kg)">
            <input type="number" value={weightGoal} onChange={e => setWeightGoal(e.target.value)} placeholder="Optional" style={inputStyle} />
          </Field>
          <Field label="Units">
            <select value={units} onChange={e => setUnits(e.target.value as 'metric' | 'imperial')} style={inputStyle}>
              <option value="metric">Metric (kg)</option>
              <option value="imperial">Imperial (lbs)</option>
            </select>
          </Field>
        </Section>

        {/* ── Display section ── */}
        <Section title="Display">
          {/* Dark / Light mode toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.011em', color: '#fff', margin: '0 0 3px' }}>
                {theme === 'dark' ? '🌙 Dark mode' : '☀️ Light mode'}
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', margin: 0 }}>Follows system by default</p>
            </div>
            <button
              onClick={() => { haptic('light'); toggleTheme(); }}
              style={{
                width: 48, height: 28, borderRadius: 99, flexShrink: 0,
                background: theme === 'dark' ? '#fff' : 'rgba(255,255,255,0.15)',
                border: 'none', cursor: 'pointer', position: 'relative',
                transition: 'background 0.2s', WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{
                position: 'absolute', top: 4, left: theme === 'dark' ? 24 : 4,
                width: 20, height: 20, borderRadius: '50%',
                background: theme === 'dark' ? '#000' : 'rgba(255,255,255,0.60)',
                transition: 'left 0.2s',
              }} />
            </button>
          </div>

          {/* Non-numeric mode */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.011em', color: '#fff', margin: '0 0 3px' }}>Non-numeric mode</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', margin: 0 }}>Hides calorie and weight numbers app-wide</p>
            </div>
            <button
              onClick={() => { haptic('light'); setNonNumeric(!nonNumeric); }}
              style={{
                width: 48, height: 28, borderRadius: 99, flexShrink: 0,
                background: nonNumeric ? '#fff' : 'rgba(255,255,255,0.15)',
                border: 'none', cursor: 'pointer', position: 'relative',
                transition: 'background 0.2s', WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{
                position: 'absolute', top: 4, left: nonNumeric ? 24 : 4,
                width: 20, height: 20, borderRadius: '50%',
                background: nonNumeric ? '#000' : 'rgba(255,255,255,0.60)',
                transition: 'left 0.2s',
              }} />
            </button>
          </div>
        </Section>

        {/* ── Save button ── */}
        <button
          onClick={save}
          style={{
            width: '100%', background: '#fff', color: '#000', border: 'none',
            borderRadius: 99, padding: 16, fontSize: 15, fontWeight: 700,
            cursor: 'pointer', marginBottom: 10,
            WebkitTapHighlightColor: 'transparent',
            transition: 'opacity 0.15s',
          }}
        >
          {saved ? 'Saved ✓' : 'Save settings'}
        </button>

        {/* ── Account ── */}
        <Section title="Account">
          <button
            onClick={signOut}
            style={{
              width: '100%', background: 'transparent', color: 'rgba(255,255,255,0.60)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 99,
              padding: '14px', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}
          >
            Sign out →
          </button>
        </Section>
      </div>
    </div>
  );
}
