'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getMeditationSessions, getMeditationLogs, todayISO, type MeditationSession } from '@/lib/db';

const CATS = ['All', 'Breathing', 'Body Scan', 'Sleep', 'Stress Release', 'Focus'];
const DURATIONS = ['All', '5 min', '10 min', '20 min+'] as const;
type DurationFilter = typeof DURATIONS[number];

const CAT_ICONS: Record<string, string> = {
  'Breathing':      '◌',
  'Body Scan':      '◎',
  'Sleep':          '◗',
  'Stress Release': '◈',
  'Focus':          '◆',
  'All':            '◉',
};

export default function MeditationPage() {
  const router = useRouter();
  const [sessions, setSessions]   = useState<MeditationSession[]>([]);
  const [loggedIds, setLoggedIds] = useState<Set<number>>(new Set());
  const [cat, setCat]             = useState('All');
  const [dur, setDur]             = useState<DurationFilter>('All');
  const [suggested, setSuggested] = useState<MeditationSession | null>(null);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    const today = todayISO();
    const [all, logs] = await Promise.all([getMeditationSessions(), getMeditationLogs(today)]);
    const ids = new Set(logs.map(l => l.session_id));
    setLoggedIds(ids);
    setSessions(all);
    setSuggested(all.find(s => !ids.has(s.id)) ?? all[0] ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const durationMatch = (s: MeditationSession): boolean => {
    if (dur === 'All') return true;
    if (dur === '5 min') return s.duration_min === 5;
    if (dur === '10 min') return s.duration_min === 10;
    if (dur === '20 min+') return s.duration_min >= 20;
    return true;
  };
  const filtered = sessions
    .filter(s => cat === 'All' || s.category.toLowerCase() === cat.toLowerCase())
    .filter(durationMatch);
  const doneCount = loggedIds.size;
  const totalCount = sessions.length;

  const PAD = 16;
  const GAP = 10;

  return (
    <div style={{ minHeight: '100dvh', background: '#000', paddingTop: '4.5rem', paddingBottom: '130px' }}>

      {/* ── Header ── */}
      <div style={{ padding: `0 ${PAD}px 20px` }}>
        <p style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 10, marginTop: 4 }}>Mind</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <h1 style={{ margin: 0, fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff' }}>Meditation</h1>
          {totalCount > 0 && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 'clamp(32px,9vw,44px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1, color: '#fff' }}>{doneCount}</p>
              <p style={{ margin: '4px 0 0', fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)' }}>of {totalCount} today</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: `0 ${PAD}px`, display: 'flex', flexDirection: 'column', gap: GAP }}>

        {/* ── Suggested card ── */}
        {suggested && !loading && (
          <button
            onClick={() => router.push(`/meditation/${suggested.id}`)}
            style={{
              width: '100%', background: 'var(--color-carbon)', borderRadius: 24,
              border: 'none', padding: '20px 20px 18px',
              cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Subtle glow */}
            <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', filter: 'blur(40px)', pointerEvents: 'none' }} />

            <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
              Suggested · {suggested.category}
            </p>
            <p style={{ margin: '0 0 18px', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.2 }}>{suggested.name}</p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: '1.5px solid rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>{suggested.duration_min}</span>
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)' }}>{suggested.duration_min} min</span>
              </div>
              <div style={{ background: '#fff', color: '#000', borderRadius: 99, padding: '8px 20px', fontSize: 13, fontWeight: 700 }}>
                Start →
              </div>
            </div>
          </button>
        )}

        {/* ── Duration filter ── */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {DURATIONS.map(d => (
            <button
              key={d}
              onClick={() => setDur(d)}
              style={{
                flex: '0 0 auto', padding: '7px 14px', borderRadius: 99,
                background: dur === d ? '#fff' : 'transparent',
                color: dur === d ? '#000' : 'rgba(255,255,255,0.40)',
                border: `1px solid ${dur === d ? 'transparent' : 'rgba(255,255,255,0.10)'}`,
                fontSize: 12, fontWeight: dur === d ? 700 : 500,
                cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                transition: 'all 0.15s',
              }}
            >
              {d}
            </button>
          ))}
        </div>

        {/* ── Category pills ── */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {CATS.map(c => (
            <button
              key={c}
              onClick={() => setCat(c)}
              style={{
                flex: '0 0 auto', padding: '7px 14px', borderRadius: 99,
                background: cat === c ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: cat === c ? '#fff' : 'rgba(255,255,255,0.40)',
                border: `1px solid ${cat === c ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)'}`,
                fontSize: 12, fontWeight: cat === c ? 600 : 400,
                cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                transition: 'all 0.15s',
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* ── Session list ── */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ height: 72, borderRadius: 18, background: 'var(--color-carbon)', opacity: 0.6 - i * 0.1 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', background: 'var(--color-carbon)', borderRadius: 20, border: 'none' }}>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>No sessions in this category</p>
          </div>
        ) : (
          <div style={{ background: 'var(--color-carbon)', borderRadius: 20, border: 'none', overflow: 'hidden' }}>
            {filtered.map((s, idx) => {
              const done = loggedIds.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => router.push(`/meditation/${s.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    width: '100%', padding: '16px 20px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    cursor: 'pointer', textAlign: 'left',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {/* Category glyph */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: done ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${done ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: done ? 14 : 16, color: done ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.60)',
                  }}>
                    {done ? '✓' : (CAT_ICONS[s.category] ?? '◎')}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: '0 0 3px', fontSize: 15, fontWeight: 600,
                      letterSpacing: '-0.011em',
                      color: done ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.85)',
                      textDecoration: done ? 'line-through' : 'none',
                      lineHeight: 1.3,
                    }}>{s.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.30)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {s.category} · {s.duration_min} min
                    </p>
                  </div>

                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 20, flexShrink: 0 }}>›</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
