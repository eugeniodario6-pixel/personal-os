'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { getWeightHistory, logWeight, deleteWeightEntry, getProfile, type WeightEntry } from '@/lib/db';
import { ScoreRing } from '@/components/ScoreRing';
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
  const score = todayLogged ? 100 : entries.length > 0 ? Math.min(85, entries.length * 5) : 0;

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
    <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: '-0.011em' }}>Loading…</p>
    </div>
  );

  const path = sparkPath();
  const progressPct = latest && startingWeight && goalWeight
    ? Math.min(100, Math.max(0, Math.abs((latest.weight_kg - startingWeight) / (goalWeight - startingWeight)) * 100))
    : 0;

  return (
    <div style={{ minHeight: '100dvh', background: '#000', paddingTop: '4rem', paddingBottom: '8rem' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 16px 12px' }}>
        <p style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 8 }}>Track</p>
        <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff', margin: '0 0 4px' }}>Body Weight</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: 0 }}>Add a new log</p>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* ── Hero weight card (Weight log screen style) ── */}
        <div style={{ background: 'var(--color-carbon)', borderRadius: 20, border: 'none', padding: 20, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginBottom: 10 }}>Current weight</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 'clamp(56px,18vw,80px)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                  {latest ? latest.weight_kg : '—'}
                </span>
                <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.40)', fontWeight: 600 }}>kg</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {delta !== null && (
                <div style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 4 }}>vs Last</p>
                  <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: delta > 0 ? '#ff6b6b' : '#78dc64', margin: 0, lineHeight: 1 }}>{delta > 0 ? '+' : ''}{delta}</p>
                </div>
              )}
              {totalDelta !== null && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 4 }}>From start</p>
                  <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: totalDelta > 0 ? '#ff6b6b' : '#78dc64', margin: 0, lineHeight: 1 }}>{totalDelta > 0 ? '+' : ''}{totalDelta}</p>
                </div>
              )}
            </div>
          </div>

          {/* Sparkline */}
          {path && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <svg width="100%" viewBox="0 0 300 48" preserveAspectRatio="none" style={{ display: 'block', height: 44, marginBottom: 8 }}>
                <path d={path} fill="none" stroke="rgba(255,255,255,0.70)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
              <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>Last {[...entries].reverse().slice(-12).length} entries</p>
            </div>
          )}

          {/* Goal progress */}
          {goalWeight && startingWeight && latest && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Start {startingWeight}kg</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Goal {goalWeight}kg</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progressPct}%`, background: '#fff', borderRadius: 99, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          )}
        </div>

        {/* ── Log input card ── */}
        <div style={{ background: 'var(--color-carbon)', borderRadius: 20, border: 'none', padding: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 16 }}>
            {todayLogged ? 'Update today’s weight' : 'Log weight'}
          </p>
          <input
            type="number" value={input} step="0.1" min="20" max="300"
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLog()}
            placeholder={latest ? String(latest.weight_kg) : '80.0'}
            style={{
              fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 10,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14,
              color: '#fff', fontVariantNumeric: 'tabular-nums', padding: '14px 16px',
            }}
          />
          <input
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="Note (optional)"
            style={{ marginBottom: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, color: '#fff', padding: '12px 16px' }}
          />
          <button
            onClick={handleLog}
            disabled={saving || !input}
            style={{
              width: '100%', background: '#fff', color: '#000', border: 'none', borderRadius: 99,
              padding: '16px', fontSize: 15, fontWeight: 700, cursor: saving || !input ? 'not-allowed' : 'pointer',
              opacity: saving || !input ? 0.5 : 1, transition: 'opacity 0.15s',
              WebkitTapHighlightColor: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {saved ? '✓ Saved' : saving ? '…' : todayLogged ? 'Update' : 'Log weight'}
          </button>
        </div>

        {/* ── Recent logs ── */}
        {entries.length > 0 && (
          <div style={{ background: 'var(--color-carbon)', borderRadius: 20, border: 'none', overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px 12px' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>Recent logs</p>
            </div>
            {entries.slice(0, 10).map((e, i) => {
              const prev = entries[i + 1];
              const d = prev ? Math.round((e.weight_kg - prev.weight_kg) * 10) / 10 : null;
              return (
                <div
                  key={e.id}
                  style={{
                    display: 'flex', alignItems: 'center',
                    padding: '14px 18px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 50, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14, flexShrink: 0 }}>
                    <span style={{ fontSize: 14 }}>⚖️</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{e.weight_kg} kg</span>
                      {d !== null && (
                        <span style={{ fontSize: 13, color: d > 0 ? '#ff6b6b' : d < 0 ? '#78dc64' : 'rgba(255,255,255,0.35)' }}>
                          {d > 0 ? '+' : ''}{d}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0, marginTop: 2 }}>
                      {e.logged_at}{e.note ? ` · ${e.note}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(e.id)}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.28)', cursor: 'pointer', fontSize: 16, padding: '4px 6px', lineHeight: 1, WebkitTapHighlightColor: 'transparent' }}
                  >
                    ›
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {entries.length === 0 && (
          <div style={{ background: 'var(--color-carbon)', borderRadius: 20, border: 'none', padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', marginBottom: 8 }}>No weight logged yet</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6 }}>
              Weigh in each morning for accurate trends.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
