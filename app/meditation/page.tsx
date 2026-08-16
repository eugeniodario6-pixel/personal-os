'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getMeditationSessions, getMeditationLogs, todayISO, type MeditationSession } from '@/lib/db';

const CATS = ['ALL', 'BREATHING', 'BODY SCAN', 'SLEEP', 'STRESS RELEASE', 'FOCUS'];

export default function MeditationPage() {
  const router = useRouter();
  const [sessions, setSessions]   = useState<MeditationSession[]>([]);
  const [loggedIds, setLoggedIds] = useState<Set<number>>(new Set());
  const [cat, setCat]             = useState('ALL');
  const [suggested, setSuggested] = useState<MeditationSession | null>(null);

  const load = useCallback(async () => {
    const today = todayISO();
    const [all, logs] = await Promise.all([getMeditationSessions(), getMeditationLogs(today)]);
    const ids = new Set(logs.map(l => l.session_id));
    setLoggedIds(ids);
    setSessions(all);
    setSuggested(all.find(s => !ids.has(s.id)) ?? all[0] ?? null);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = cat === 'ALL' ? sessions : sessions.filter(s => s.category.toUpperCase() === cat);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4rem', paddingBottom: '5rem' }}>

      {/* Header */}
      <div style={{ padding: '1.5rem var(--pad) 1rem' }}>
        <p className="label" style={{ marginBottom: '0.35rem' }}>Mind</p>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', margin: 0 }}>Meditation</h1>
      </div>

      {/* Suggested session */}
      {suggested && (
        <div
          onClick={() => router.push(`/meditation/${suggested.id}`)}
          style={{ margin: '0 var(--pad) 1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', cursor: 'pointer' }}
        >
          <p className="label" style={{ marginBottom: '0.5rem' }}>Start Here</p>
          <p style={{ margin: '0 0 0.75rem', fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.02em', color: 'var(--text)' }}>
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

      {/* Category filter */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0 var(--pad) 1rem', scrollbarWidth: 'none' as any }}>
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)}
            style={{
              flex: '0 0 auto', padding: '0.4rem 0.875rem',
              borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em',
              background: cat === c ? 'var(--text)' : 'var(--surface)',
              color: cat === c ? 'var(--invert)' : 'var(--text-3)',
              border: `1px solid ${cat === c ? 'var(--text)' : 'var(--border)'}`,
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Session list */}
      {sessions.length === 0 ? (
        <div style={{ padding: '2rem var(--pad)', color: 'var(--text-3)', fontSize: '0.875rem', textAlign: 'center' as const }}>
          Loading sessions…
        </div>
      ) : (
        <div style={{ margin: '0 var(--pad)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {filtered.map((s, idx) => {
            const done = loggedIds.has(s.id);
            return (
              <button key={s.id} onClick={() => router.push(`/meditation/${s.id}`)}
                style={{
                  display: 'flex', width: '100%', alignItems: 'center', padding: '1rem 1.25rem',
                  border: 'none', borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer', textAlign: 'left' as const,
                  background: done ? 'var(--surface-2)' : 'transparent',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 'var(--radius-xs)', flexShrink: 0,
                  border: `2px solid ${done ? 'var(--text)' : 'var(--border-2)'}`,
                  background: done ? 'var(--text)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--invert)', fontSize: '0.8rem', fontWeight: 700, marginRight: '0.875rem',
                }}>
                  {done ? '✓' : ''}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 0.2rem', fontWeight: 600, fontSize: '0.9375rem', color: done ? 'var(--text-3)' : 'var(--text)', textDecoration: done ? 'line-through' : 'none' }}>
                    {s.name}
                  </p>
                  <p className="label">{s.category} · {s.duration_min} min</p>
                </div>
                <span style={{ color: 'var(--text-4)', fontSize: '1rem', marginLeft: '0.5rem' }}>›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
