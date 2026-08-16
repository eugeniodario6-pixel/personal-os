'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getMeditationSessions, getMeditationLogs, todayISO, type MeditationSession } from '@/lib/db';

const CATS = ['ALL', 'BREATHING', 'BODY SCAN', 'SLEEP', 'STRESS RELEASE', 'FOCUS'];

export default function MeditationPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<MeditationSession[]>([]);
  const [loggedIds, setLoggedIds] = useState<Set<number>>(new Set());
  const [cat, setCat] = useState('ALL');
  const [suggested, setSuggested] = useState<MeditationSession | null>(null);

  const load = useCallback(async () => {
    const today = todayISO();
    const [all, logs] = await Promise.all([
      getMeditationSessions(),
      getMeditationLogs(today),
    ]);
    const ids = new Set(logs.map(l => l.session_id));
    setLoggedIds(ids);
    setSessions(all);
    const unplayed = all.find(s => !ids.has(s.id));
    setSuggested(unplayed ?? all[0] ?? null);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = cat === 'ALL' ? sessions : sessions.filter(s => s.category.toUpperCase() === cat);

  return (
    <div style={{ minHeight: '100dvh', background: '#0F0F14', paddingTop: '4rem', paddingBottom: '5rem', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ margin: '0 1rem 1rem', background: '#17171F', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.25rem' }}>
        <p style={{ margin: '0 0 0.25rem', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7A7A8C' }}>MIND</p>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#fff' }}>Meditation</h1>
      </div>

      {/* Suggested session — indigo gradient card */}
      {suggested && (
        <div style={{ margin: '0 1rem 1rem', background: 'linear-gradient(135deg,#6366F1,#818CF8)', borderRadius: 16, padding: '1.25rem', cursor: 'pointer' }}
          onClick={() => router.push(`/meditation/${suggested.id}`)}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>START HERE</p>
          <p style={{ margin: '0 0 0.25rem', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em', color: '#fff' }}>{suggested.name}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
              {suggested.category.toUpperCase()} · {suggested.duration_min} MIN
            </span>
            <button
              onClick={e => { e.stopPropagation(); router.push(`/meditation/${suggested.id}`); }}
              style={{ background: '#fff', color: '#6366F1', border: 'none', borderRadius: 10, padding: '0.5rem 1.25rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              Start →
            </button>
          </div>
        </div>
      )}

      {/* Category filter — horizontal scrollable pills */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0 1rem 1rem', scrollbarWidth: 'none' }}>
        {CATS.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            style={{
              flex: '0 0 auto', padding: '0.45rem 0.875rem', border: 'none', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif',
              fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em',
              background: cat === c ? 'linear-gradient(90deg,#6366F1,#818CF8)' : '#17171F',
              color: cat === c ? '#fff' : '#7A7A8C',
              boxShadow: cat === c ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,0.07)',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Session list */}
      {sessions.length === 0 ? (
        <div style={{ padding: '2rem 1rem', color: '#7A7A8C', fontSize: '0.85rem', textAlign: 'center' }}>Loading sessions…</div>
      ) : (
        <div style={{ margin: '0 1rem', background: '#17171F', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
          {filtered.map((s, idx) => {
            const done = loggedIds.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => router.push(`/meditation/${s.id}`)}
                style={{
                  display: 'flex', width: '100%', alignItems: 'center', padding: '1rem 1.25rem',
                  border: 'none', borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  cursor: 'pointer', textAlign: 'left', background: done ? '#1E1E28' : 'transparent',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {/* Done indicator */}
                <span style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? 'linear-gradient(135deg,#6366F1,#818CF8)' : '#25252F',
                  color: '#fff', fontSize: '0.85rem', fontWeight: 700, marginRight: '0.875rem',
                }}>
                  {done ? '✓' : ''}
                </span>

                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 0.2rem', fontWeight: 700, fontSize: '0.95rem', color: done ? '#7A7A8C' : '#fff' }}>{s.name}</p>
                  <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7A7A8C' }}>
                    {s.category.toUpperCase()} · {s.duration_min} MIN
                  </p>
                </div>

                <span style={{ color: '#7A7A8C', fontSize: '1rem', marginLeft: '0.5rem' }}>›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
