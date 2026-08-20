'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getMeditationSessions, getMeditationLogs, todayISO, type MeditationSession } from '@/lib/db';

const CATS = ['All', 'Breathing', 'Body Scan', 'Sleep', 'Stress Release', 'Focus'];

export default function MeditationPage() {
  const router = useRouter();
  const [sessions, setSessions]   = useState<MeditationSession[]>([]);
  const [loggedIds, setLoggedIds] = useState<Set<number>>(new Set());
  const [cat, setCat]             = useState('All');
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
  }, [])

  useEffect(() => { load(); }, [load]);

  const filtered = cat === 'All' ? sessions : sessions.filter(s => s.category.toLowerCase() === cat.toLowerCase());
  const doneCount = sessions.filter(s => loggedIds.has(s.id)).length;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4rem', paddingBottom: '5rem' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <p className="label" style={{ marginBottom: 6 }}>Mind</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <h1 style={{ fontSize: 32, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1.13, color: 'var(--text)', margin: 0 }}>Meditation</h1>
          {sessions.length > 0 && (
            <span style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: '-0.011em' }}>
              {doneCount}/{sessions.length} done
            </span>
          )}
        </div>
      </div>

      {/* ── Suggested ── */}
      {suggested && (
        <div style={{ margin: '16px', padding: '16px', background: 'var(--color-carbon)', boxShadow: 'var(--shadow-card)', borderRadius: 12, cursor: 'pointer' }}
          onClick={() => router.push(`/meditation/${suggested.id}`)}>
          <p className="label" style={{ marginBottom: 8 }}>Suggested</p>
          <p style={{ margin: '0 0 12px', fontWeight: 510, fontSize: 20, letterSpacing: '-0.012em', color: 'var(--text)', lineHeight: 1.33 }}>
            {suggested.name}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="label">{suggested.category} · {suggested.duration_min} min</span>
            <button
              onClick={e => { e.stopPropagation(); router.push(`/meditation/${suggested.id}`); }}
              className="btn btn-primary btn-sm"
            >
              Start →
            </button>
          </div>
        </div>
      )}

      {/* ── Category filter ── */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 16px 16px', scrollbarWidth: 'none' }}>
        {CATS.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cat === c ? 'btn btn-sm' : 'btn btn-outline btn-sm'}
            style={{
              flex: '0 0 auto',
              borderRadius: 9999,
              background: cat === c ? 'var(--text)' : 'transparent',
              color: cat === c ? 'var(--invert)' : 'var(--text-3)',
              borderColor: cat === c ? 'var(--text)' : 'var(--border)',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* ── Session list ── */}
      {loading ? (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-4)', letterSpacing: '-0.011em', margin: 0 }}>Loading…</p>
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-4)', letterSpacing: '-0.011em', margin: 0 }}>No sessions available.</p>
        </div>
      ) : (
        <div style={{ margin: '0 16px', background: 'var(--color-carbon)', boxShadow: 'var(--shadow-card)', borderRadius: 12, overflow: 'hidden' }}>
          {filtered.map((s, idx) => {
            const done = loggedIds.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => router.push(`/meditation/${s.id}`)}
                style={{
                  display: 'flex', width: '100%', alignItems: 'center',
                  padding: '12px 16px',
                  border: 'none',
                  borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer', textAlign: 'left',
                  background: done ? 'rgba(255,255,255,0.02)' : 'transparent',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                {/* Done indicator */}
                <div style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                  border: `1px solid ${done ? 'var(--accent)' : 'var(--border-2)'}`,
                  background: done ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent-fg)', fontSize: 10, fontWeight: 510,
                  marginRight: 12, transition: 'all 0.15s',
                }}>
                  {done ? '✓' : ''}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: '0 0 2px', fontWeight: 400, fontSize: 15,
                    letterSpacing: '-0.011em',
                    color: done ? 'var(--text-4)' : 'var(--text-2)',
                    textDecoration: done ? 'line-through' : 'none',
                  }}>
                    {s.name}
                  </p>
                  <p className="label">{s.category} · {s.duration_min} min</p>
                </div>
                <span style={{ color: 'var(--text-4)', fontSize: 16, marginLeft: 8 }}>›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
