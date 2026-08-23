'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getMeditationSessions, getMeditationLogs, todayISO, type MeditationSession } from '@/lib/db';
import { haptic } from '@/lib/haptic';

const CATS = ['All', 'Breathing', 'Body Scan', 'Sleep', 'Stress Release', 'Focus'];

export default function MeditationPage() {
  const router = useRouter();
  const [sessions, setSessions]   = useState<MeditationSession[]>([]);
  const [loggedIds, setLoggedIds] = useState<Set<number>>(new Set());
  const [cat, setCat]             = useState('All');
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

  const filtered = cat === 'All' ? sessions : sessions.filter(s => s.category.toLowerCase() === cat.toLowerCase());

  return (
    <div className="page">

      <div className="page-head">
        <div className="page-head-left">
          <span className="label" style={{ color: 'var(--text-ghost)' }}>MIND</span>
          <span className="page-title">Meditation</span>
        </div>
      </div>

      {suggested && (
        <>
          <div className="section-label">
            <span className="label">Up next</span>
          </div>
          <button
            className="row t-fast"
            onClick={() => { haptic('light'); router.push(`/meditation/${suggested.id}`); }}
            style={{ width: '100%', border: 'none', justifyContent: 'space-between', background: 'var(--surface)' }}
          >
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: '0 0 0.25rem', fontWeight: 600, fontSize: '1rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{suggested.name}</p>
              <p className="label">{suggested.category} · {suggested.duration_min} min</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); haptic('light'); router.push(`/meditation/${suggested.id}`); }}>
              Start
            </button>
          </button>
        </>
      )}

      <div className="tab-bar">
        {CATS.map(c => (
          <button
            key={c}
            className={`tab t-fast${cat === c ? ' active' : ''}`}
            onClick={() => setCat(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {sessions.length === 0 && <div className="loading-state">Loading sessions…</div>}

      {filtered.map(s => {
        const done = loggedIds.has(s.id);
        return (
          <button
            key={s.id}
            className={`row t-fast${done ? ' active' : ''}`}
            onClick={() => { haptic('light'); router.push(`/meditation/${s.id}`); }}
            style={{ width: '100%', border: 'none', justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flex: 1, textAlign: 'left' }}>
              <span className="mono" style={{ fontSize: '0.8rem', fontWeight: 700, color: done ? 'var(--positive)' : 'var(--text-ghost)', minWidth: '2rem' }}>
                {done ? '[X]' : '[ ]'}
              </span>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: done ? 'var(--text-muted)' : 'var(--text)', fontFamily: 'var(--font-sans)', textDecoration: done ? 'line-through' : 'none' }}>{s.name}</p>
                <p className="label" style={{ marginTop: '0.15rem' }}>{s.category} · {s.duration_min} min</p>
              </div>
            </div>
            <span style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>›</span>
          </button>
        );
      })}
    </div>
  );
}
