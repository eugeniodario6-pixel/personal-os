'use client';

import { useEffect, useState, useCallback } from 'react';
import { getWeightHistory, logWeight, deleteWeightEntry, getProfile, type WeightEntry } from '@/lib/db';
import { haptic } from '@/lib/haptic';

export default function BodyPage() {
  const [entries, setEntries]               = useState<WeightEntry[]>([]);
  const [startingWeight, setStartingWeight] = useState<number | null>(null);
  const [goalWeight, setGoalWeight]         = useState<number | null>(null);
  const [input, setInput]                   = useState('');
  const [note, setNote]                     = useState('');
  const [saving, setSaving]                 = useState(false);
  const [saved, setSaved]                   = useState(false);
  const [loading, setLoading]               = useState(true);

  const load = useCallback(async () => {
    const [history, profile] = await Promise.all([getWeightHistory(52), getProfile()]);
    setEntries(history);
    setStartingWeight(profile?.starting_weight ?? null);
    setGoalWeight(profile?.weight_goal ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const latest   = entries[0] ?? null;
  const previous = entries[1] ?? null;
  const delta    = latest && previous ? Math.round((latest.weight_kg - previous.weight_kg) * 10) / 10 : null;
  const totalDelta = latest && startingWeight ? Math.round((latest.weight_kg - startingWeight) * 10) / 10 : null;
  const todayLogged = entries[0]?.logged_at === new Date().toISOString().split('T')[0];

  const sparkPath = () => {
    const pts = [...entries].reverse().slice(-12);
    if (pts.length < 2) return null;
    const weights = pts.map(e => e.weight_kg);
    const min = Math.min(...weights) - 1;
    const max = Math.max(...weights) + 1;
    const W = 300, H = 48;
    const coords = pts.map((e, i) => {
      const x = (i / (pts.length - 1)) * W;
      const y = H - ((e.weight_kg - min) / (max - min)) * H;
      return `${x},${y}`;
    });
    return `M ${coords.join(' L ')}`;
  };

  const handleLog = async () => {
    const kg = parseFloat(input);
    if (!kg || kg < 20 || kg > 300) return;
    setSaving(true); haptic('medium');
    await logWeight(kg, note.trim() || undefined);
    setInput(''); setNote(''); setSaved(true);
    await load(); setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = async (id: number) => {
    haptic('light'); await deleteWeightEntry(id); await load();
  };

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: 'var(--text-4)', letterSpacing: '-0.011em' }}>Loading…</p>
    </div>
  );

  const path = sparkPath();
  const progressPct = latest && startingWeight && goalWeight
    ? Math.min(100, Math.max(0, Math.abs((latest.weight_kg - startingWeight) / (goalWeight - startingWeight)) * 100))
    : 0;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4rem', paddingBottom: '5rem' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <p className="label" style={{ marginBottom: 6 }}>Track</p>
        <h1 style={{ fontSize: 32, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1.13, color: 'var(--text)', margin: 0 }}>Body Weight</h1>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Stats card ── */}
        <div style={{ background: 'var(--color-carbon)', boxShadow: 'var(--shadow-card)', borderRadius: 12, padding: '20px' }}>

          {/* Current / deltas */}
          <div style={{ display: 'flex', gap: 24, marginBottom: path ? 16 : 0 }}>
            <div>
              <p className="label" style={{ marginBottom: 6 }}>Current</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 48, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1, color: 'var(--text)' }}>
                  {latest ? latest.weight_kg : '—'}
                </span>
                <span style={{ fontSize: 15, color: 'var(--text-3)', fontWeight: 400, letterSpacing: '-0.011em' }}>kg</span>
              </div>
            </div>
            {delta !== null && (
              <div>
                <p className="label" style={{ marginBottom: 6 }}>vs Last</p>
                <p style={{ fontSize: 24, fontWeight: 510, letterSpacing: '-0.022em', color: delta < 0 ? 'var(--color-pulse-green)' : delta > 0 ? 'var(--color-coral-red)' : 'var(--text-3)', margin: 0 }}>
                  {delta > 0 ? '+' : ''}{delta}
                </p>
              </div>
            )}
            {totalDelta !== null && (
              <div>
                <p className="label" style={{ marginBottom: 6 }}>From start</p>
                <p style={{ fontSize: 24, fontWeight: 510, letterSpacing: '-0.022em', color: totalDelta < 0 ? 'var(--color-pulse-green)' : totalDelta > 0 ? 'var(--color-coral-red)' : 'var(--text-3)', margin: 0 }}>
                  {totalDelta > 0 ? '+' : ''}{totalDelta}
                </p>
              </div>
            )}
          </div>

          {/* Sparkline */}
          {path && (
            <svg width="100%" viewBox="0 0 300 48" preserveAspectRatio="none" style={{ display: 'block', height: 40, marginBottom: goalWeight && startingWeight ? 16 : 0 }}>
              <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.7" />
            </svg>
          )}

          {/* Goal progress */}
          {goalWeight && startingWeight && latest && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="label">Start {startingWeight}kg</span>
                <span className="label">Goal {goalWeight}kg</span>
              </div>
              <div className="progress">
                <div className="progress-fill progress-fill--accent" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* ── Log input ── */}
        <div style={{ background: 'var(--color-carbon)', boxShadow: 'var(--shadow-card)', borderRadius: 12, padding: '20px' }}>
          <p style={{ fontSize: 13, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text-2)', marginBottom: 16 }}>
            {todayLogged ? 'Update today' : 'Log weight'}
          </p>
          <input
            type="number" value={input} step="0.1" min="20" max="300"
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLog()}
            placeholder={latest ? String(latest.weight_kg) : '80.0'}
            style={{ fontSize: 32, fontWeight: 510, letterSpacing: '-0.022em', textAlign: 'center', marginBottom: 8 }}
          />
          <input
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="Note (optional)"
            style={{ marginBottom: 12 }}
          />
          <button
            onClick={handleLog}
            disabled={saving || !input}
            className="btn btn-primary btn-block"
          >
            {saved ? 'Saved ✓' : saving ? '…' : todayLogged ? 'Update →' : 'Log →'}
          </button>
        </div>

        {/* ── History ── */}
        {entries.length > 0 && (
          <div>
            <p style={{ fontSize: 13, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text-3)', marginBottom: 8, paddingLeft: 4 }}>History</p>
            <div style={{ background: 'var(--color-carbon)', boxShadow: 'var(--shadow-card)', borderRadius: 12, overflow: 'hidden' }}>
              {entries.map((e, i) => {
                const prev = entries[i + 1];
                const d = prev ? Math.round((e.weight_kg - prev.weight_kg) * 10) / 10 : null;
                return (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex', alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontWeight: 510, color: 'var(--text)', fontSize: 20, letterSpacing: '-0.012em' }}>{e.weight_kg}kg</span>
                        {d !== null && (
                          <span style={{ fontSize: 13, letterSpacing: '-0.011em', color: d < 0 ? 'var(--color-pulse-green)' : d > 0 ? 'var(--color-coral-red)' : 'var(--text-4)' }}>
                            {d > 0 ? '+' : ''}{d}
                          </span>
                        )}
                      </div>
                      <p className="label" style={{ marginTop: 3 }}>
                        {e.logged_at}{e.note ? ` · ${e.note}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(e.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: 14, padding: '4px 6px', lineHeight: 1, WebkitTapHighlightColor: 'transparent' }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {entries.length === 0 && (
          <div style={{ background: 'var(--color-carbon)', boxShadow: 'var(--shadow-card)', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: '-0.011em' }}>No entries yet. Log your first weight above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
