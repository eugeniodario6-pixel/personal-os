'use client';

import { useEffect, useState, useCallback } from 'react';
import { getWeightHistory, logWeight, deleteWeightEntry, getProfile, type WeightEntry } from '@/lib/db';
import { haptic } from '@/lib/haptic';

const F = "'Inter', system-ui, sans-serif";
const BG = '#0F0F14';
const CARD = '#17171F';
const CARD2 = '#1E1E28';
const BORDER = 'rgba(255,255,255,0.07)';
const MUTED = '#7A7A8C';
const GHOST = '#3A3A4A';
const CYAN = '#06B6D4';

export default function BodyPage() {
  const [entries, setEntries]             = useState<WeightEntry[]>([]);
  const [startingWeight, setStartingWeight] = useState<number | null>(null);
  const [goalWeight, setGoalWeight]       = useState<number | null>(null);
  const [input, setInput]                 = useState('');
  const [note, setNote]                   = useState('');
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [loading, setLoading]             = useState(true);

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

  // Sparkline SVG
  const sparkPath = () => {
    const pts = [...entries].reverse().slice(-12);
    if (pts.length < 2) return null;
    const weights = pts.map(e => e.weight_kg);
    const min = Math.min(...weights) - 1;
    const max = Math.max(...weights) + 1;
    const W = 300, H = 60;
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
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: '0.8rem', color: GHOST, fontFamily: F }}>Loading...</p>
    </div>
  );

  const path = sparkPath();

  return (
    <div style={{ minHeight: '100dvh', background: BG, paddingTop: '4rem', paddingBottom: '5rem', fontFamily: F }}>

      {/* Header */}
      <div style={{ padding: '1.5rem 1.25rem 1rem' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', color: MUTED, marginBottom: '0.35rem' }}>Track</p>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>Body Weight</h1>
      </div>

      <div style={{ padding: '0 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Stats card */}
        <div style={{ background: 'linear-gradient(135deg, #0E1E2A, #0F0F14)', border: `1px solid rgba(6,182,212,0.2)`, borderRadius: 20, padding: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: path ? '1.25rem' : 0 }}>
            <div>
              <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: MUTED, marginBottom: '0.35rem' }}>Current</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                <span style={{ fontSize: '2.75rem', fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 0.9, background: `linear-gradient(135deg, #fff, ${CYAN})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  {latest ? latest.weight_kg : '—'}
                </span>
                <span style={{ fontSize: '1rem', color: MUTED, fontWeight: 500 }}>kg</span>
              </div>
            </div>
            {delta !== null && (
              <div>
                <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: MUTED, marginBottom: '0.35rem' }}>vs Last</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em', color: delta < 0 ? '#10B981' : delta > 0 ? '#EF4444' : GHOST }}>
                  {delta > 0 ? '+' : ''}{delta}
                </p>
              </div>
            )}
            {totalDelta !== null && (
              <div>
                <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: MUTED, marginBottom: '0.35rem' }}>From Start</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em', color: totalDelta < 0 ? '#10B981' : totalDelta > 0 ? '#EF4444' : GHOST }}>
                  {totalDelta > 0 ? '+' : ''}{totalDelta}
                </p>
              </div>
            )}
          </div>

          {/* Sparkline */}
          {path && (
            <svg width="100%" viewBox="0 0 300 60" preserveAspectRatio="none" style={{ display: 'block', height: 48, marginBottom: goalWeight && startingWeight ? '1rem' : 0 }}>
              <path d={path} fill="none" stroke={CYAN} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />
            </svg>
          )}

          {/* Goal bar */}
          {goalWeight && startingWeight && latest && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: MUTED }}>Start {startingWeight}kg</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: MUTED }}>Goal {goalWeight}kg</span>
              </div>
              <div style={{ height: 5, background: GHOST, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, Math.abs((latest.weight_kg - startingWeight) / (goalWeight - startingWeight)) * 100))}%`, background: `linear-gradient(90deg,${CYAN},#67E8F9)`, borderRadius: 999, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}
        </div>

        {/* Log input */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '1.25rem' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>
            {todayLogged ? 'Update Today' : 'Log Weight'}
          </p>
          <input
            type="number" value={input} step="0.1" min="20" max="300"
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLog()}
            placeholder={latest ? String(latest.weight_kg) : '80.0'}
            style={{ width: '100%', fontFamily: F, fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', background: CARD2, color: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '0.875rem 1rem', outline: 'none', textAlign: 'center', marginBottom: '0.75rem', WebkitAppearance: 'none' }}
          />
          <input
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="Note (optional) — e.g. morning, post-workout"
            style={{ width: '100%', fontFamily: F, fontSize: '0.875rem', background: CARD2, color: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '0.875rem 1rem', outline: 'none', marginBottom: '0.875rem', WebkitAppearance: 'none' }}
          />
          <button onClick={handleLog} disabled={saving || !input}
            style={{ width: '100%', padding: '0.875rem', background: saved ? '#10B981' : !input ? GHOST : CYAN, color: '#000', border: 'none', borderRadius: 10, fontSize: '0.9375rem', fontWeight: 700, cursor: !input ? 'not-allowed' : 'pointer', fontFamily: F, transition: 'background 0.2s' }}>
            {saved ? 'Saved ✓' : saving ? '...' : todayLogged ? 'Update →' : 'Log →'}
          </button>
        </div>

        {/* History */}
        {entries.length > 0 && (
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem' }}>History</p>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden' }}>
              {entries.map((e, i) => {
                const prev = entries[i + 1];
                const d = prev ? Math.round((e.weight_kg - prev.weight_kg) * 10) / 10 : null;
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: i < entries.length - 1 ? `1px solid rgba(255,255,255,0.05)` : 'none' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                        <span style={{ fontWeight: 700, color: '#fff', fontSize: '1.125rem', letterSpacing: '-0.02em' }}>{e.weight_kg}kg</span>
                        {d !== null && (
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: d < 0 ? '#10B981' : d > 0 ? '#EF4444' : GHOST }}>
                            {d > 0 ? '+' : ''}{d}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.7rem', color: MUTED, marginTop: '0.2rem' }}>
                        {e.logged_at}{e.note ? ` · ${e.note}` : ''}
                      </p>
                    </div>
                    <button onClick={() => handleDelete(e.id)} style={{ background: 'none', border: 'none', color: GHOST, cursor: 'pointer', fontSize: '1rem', padding: '0.25rem', fontFamily: F }}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {entries.length === 0 && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '2.5rem', textAlign: 'center' as const }}>
            <p style={{ fontSize: '0.875rem', color: GHOST }}>No entries yet. Log your first weight above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
