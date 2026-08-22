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

  return (
    <div style={{ minHeight: '100dvh', background: '#000', paddingTop: '4rem', paddingBottom: '9rem' }}>

      {/* ── Header ── */}
      <div style={{ padding: '24px 20px 20px' }}>
        <p style={{ margin: '0 0 4px', fontSize: '0.6rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Mind</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <h1 style={{ margin: 0, fontSize: 38, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1.1, color: '#fff' }}>Meditation</h1>
          {totalCount > 0 && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 510, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>{doneCount}</p>
              <p style={{ margin: 0, fontSize: '0.55rem', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>OF {totalCount} TODAY</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Suggested ── */}
      {suggested && !loading && (
        <div
          onClick={() => router.push(`/meditation/${suggested.id}`)}
          style={{ margin: '0 20px 16px', padding: '20px', background: '#141616', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', position: 'relative', overflow: 'hidden' }}
        >
          {/* Subtle glow blob */}
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(218,255,1,0.04)', filter: 'blur(30px)', pointerEvents: 'none' }} />

          <p style={{ margin: '0 0 10px', fontSize: '0.55rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Suggested · {suggested.category}</p>
          <p style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 510, letterSpacing: '-0.015em', color: '#fff', lineHeight: 1.25 }}>{suggested.name}</p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Mini duration ring */}
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', fontWeight: 510 }}>{suggested.duration_min}</span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '-0.01em' }}>{suggested.duration_min} min</span>
            </div>
            <div style={{ background: '#fff', color: '#000', borderRadius: 99, padding: '8px 18px', fontSize: '0.78rem', fontWeight: 510, letterSpacing: '-0.011em' }}>
              Start →
            </div>
          </div>
        </div>
      )}

      {/* ── Duration filter tabs ── */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 20px 10px', scrollbarWidth: 'none' }}>
        {DURATIONS.map(d => (
          <button
            key={d}
            onClick={() => setDur(d)}
            style={{
              flex: '0 0 auto', padding: '6px 13px', borderRadius: 9999,
              background: dur === d ? 'rgba(218,255,1,0.12)' : 'transparent',
              color: dur === d ? '#DAFF01' : 'rgba(255,255,255,0.32)',
              border: `1px solid ${dur === d ? 'rgba(218,255,1,0.3)' : 'rgba(255,255,255,0.08)'}`,
              fontSize: '0.72rem', fontWeight: dur === d ? 600 : 400,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              letterSpacing: '-0.01em', fontFamily: 'var(--font)',
              transition: 'all 0.15s',
            }}
          >
            {d}
          </button>
        ))}
      </div>

      {/* ── Category pills ── */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 20px 16px', scrollbarWidth: 'none' }}>
        {CATS.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            style={{
              flex: '0 0 auto', padding: '7px 14px', borderRadius: 9999,
              background: cat === c ? '#fff' : 'transparent',
              color: cat === c ? '#000' : 'rgba(255,255,255,0.32)',
              border: `1px solid ${cat === c ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
              fontSize: '0.75rem', fontWeight: cat === c ? 600 : 400,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              letterSpacing: '-0.01em', fontFamily: 'var(--font)',
              transition: 'all 0.15s',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* ── Session list ── */}
      {loading ? (
        <div style={{ padding: '48px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ height: 68, borderRadius: 16, background: '#111', opacity: 0.6 - i * 0.1 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '-0.01em' }}>No sessions in this category</p>
        </div>
      ) : (
        <div style={{ margin: '0 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filtered.map((s) => {
            const done = loggedIds.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => router.push(`/meditation/${s.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  width: '100%', padding: '14px 16px',
                  background: done ? 'rgba(255,255,255,0.02)' : '#141616',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 18, cursor: 'pointer', textAlign: 'left',
                  WebkitTapHighlightColor: 'transparent', transition: 'background 0.12s',
                }}
              >
                {/* Category glyph */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: done ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${done ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: done ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.5)',
                }}>
                  {done ? '✓' : (CAT_ICONS[s.category] ?? '◎')}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: '0 0 2px', fontSize: '0.9rem', fontWeight: 500,
                    letterSpacing: '-0.011em',
                    color: done ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.78)',
                    textDecoration: done ? 'line-through' : 'none',
                    lineHeight: 1.3,
                  }}>{s.name}</p>
                  <p style={{ margin: 0, fontSize: '0.65rem', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.02em', fontFamily: 'var(--font-mono)' }}>
                    {s.category.toUpperCase()} · {s.duration_min} MIN
                  </p>
                </div>

                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 18, flexShrink: 0 }}>›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
