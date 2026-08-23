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
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: '-0.011em' }}>Loading…</p>
    </div>
  );

  const path = sparkPath();
  const progressPct = latest && startingWeight && goalWeight
    ? Math.min(100, Math.max(0, Math.abs((latest.weight_kg - startingWeight) / (goalWeight - startingWeight)) * 100))
    : 0;

  return (
    <div style={{ minHeight: '100dvh', background: '#000000', paddingTop: '4rem', paddingBottom: '8rem' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 20px 16px' }}>
        <p style={{ fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 6 }}>Track</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 40, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1.1, color: '#ffffff', margin: 0 }}>Body Weight</h1>
          <ScoreRing score={score} label={todayLogged ? 'Logged' : 'Log today'} />
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Stats card ── */}
        <div style={{ background: 'var(--surface)', border: '1px solid rgba(216,234,255,0.08)', borderRadius: 'var(--r)', padding: 18 }}>

          {/* Current / deltas */}
          <div style={{ display: 'flex', gap: 24, marginBottom: path ? 16 : 0 }}>
            <div>
              <p className="label" style={{ marginBottom: 6 }}>Current</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 48, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  {latest ? latest.weight_kg : '—'}
                </span>
                <span style={{ fontSize: 15, color: 'var(--text-3)', fontWeight: 400, letterSpacing: '-0.011em' }}>kg</span>
              </div>
            </div>
            {delta !== null && (
              <div>
                <p className="label" style={{ marginBottom: 6 }}>vs Last</p>
                <p style={{ fontSize: 24, fontWeight: 510, letterSpacing: '-0.012em', color: 'var(--text-3)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {delta > 0 ? '+' : ''}{delta}
                </p>
              </div>
            )}
            {totalDelta !== null && (
              <div>
                <p className="label" style={{ marginBottom: 6 }}>From start</p>
                <p style={{ fontSize: 24, fontWeight: 510, letterSpacing: '-0.012em', color: 'var(--text-3)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {totalDelta > 0 ? '+' : ''}{totalDelta}
                </p>
              </div>
            )}
          </div>

          {/* Sparkline — monochrome: white stroke, no gradient fill */}
          {path && (
            <div style={{ marginTop: 4 }}>
              <svg width="100%" viewBox="0 0 300 56" preserveAspectRatio="none" style={{ display: 'block', height: 52, marginBottom: goalWeight && startingWeight ? 16 : 0 }}>
                <path d={path} fill="none" stroke="var(--text)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
              <p className="label" style={{ marginBottom: goalWeight && startingWeight ? 0 : undefined }}>Last {[...entries].reverse().slice(-12).length} entries</p>
            </div>
          )}

          {/* Goal progress */}
          {goalWeight && startingWeight && latest && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="label">Start {startingWeight}kg</span>
                <span className="label">Goal {goalWeight}kg</span>
              </div>
              <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--text)', borderRadius: 2, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}
        </div>

        {/* ── Log input ── */}
        <div style={{ background: 'var(--surface)', border: '1px solid rgba(216,234,255,0.08)', borderRadius: 'var(--r)', padding: 18 }}>
          <p style={{ fontSize: 13, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text-3)', marginBottom: 16 }}>
            {todayLogged ? 'Update today' : 'Log weight'}
          </p>
          <input
            type="number" value={input} step="0.1" min="20" max="300"
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLog()}
            placeholder={latest ? String(latest.weight_kg) : '80.0'}
            style={{
              fontSize: 32, fontWeight: 510, letterSpacing: '-0.022em', textAlign: 'center', marginBottom: 8,
              background: 'var(--surface-2)', border: '1px solid rgba(216,234,255,0.08)', borderRadius: 14,
              fontVariantNumeric: 'tabular-nums',
            }}
          />
          <input
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="Note (optional)"
            style={{ marginBottom: 12, background: 'var(--surface-2)', border: '1px solid rgba(216,234,255,0.08)', borderRadius: 14 }}
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
            <div style={{ background: 'var(--surface)', border: '1px solid rgba(216,234,255,0.08)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
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
                        <span style={{ fontWeight: 510, color: 'var(--text)', fontSize: 20, letterSpacing: '-0.012em', fontVariantNumeric: 'tabular-nums' }}>{e.weight_kg}kg</span>
                        {d !== null && (
                          <span style={{ fontSize: 13, letterSpacing: '-0.011em', color: 'var(--text-3)' }}>
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
                      style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, padding: '4px 6px', lineHeight: 1, WebkitTapHighlightColor: 'transparent' }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {entries.length === 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(216,234,255,0.08)', borderRadius: 'var(--r)', padding: '32px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text)', marginBottom: 6 }}>No weight logged yet</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: '-0.011em', lineHeight: 1.6, marginBottom: 16 }}>
              Weigh in each morning for accurate trends — consistency unlocks the insight.
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', letterSpacing: '-0.011em' }}>↑ Log your first weigh-in above</p>
          </div>
        )}
      </div>
    </div>
  );
}
