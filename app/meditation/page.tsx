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
    <div style={{ fontFamily: 'var(--font-mono)' }}>
      <div style={{ padding: '1rem', borderBottom: '2px solid var(--border-strong)' }}>
        <p className="label" style={{ marginBottom: '0.25rem' }}>MEDITATION</p>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>MIND</h1>
      </div>

      {suggested && (
        <div style={{ borderBottom: '2px solid var(--border-strong)' }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}><span className="label">START HERE</span></div>
          <button onClick={() => router.push(`/meditation/${suggested.id}`)}
            style={{ width: '100%', padding: '1rem', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-mono)' }}>
            <div>
              <p style={{ margin: '0 0 0.25rem', fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>{suggested.name}</p>
              <p className="label">{suggested.category.toUpperCase()} · {suggested.duration_min} MIN</p>
            </div>
            <span style={{ border: '2px solid var(--border-strong)', background: 'var(--text)', color: 'var(--bg)', padding: '0.5rem 1rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>START →</span>
          </button>
        </div>
      )}

      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '2px solid var(--border-strong)' }}>
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)}
            style={{ flex: '0 0 auto', padding: '0.6rem 1rem', background: 'var(--bg)', border: 'none', marginBottom: -2, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.15em', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', color: cat === c ? 'var(--text)' : 'var(--text-ghost)', borderBottom: `2px solid ${cat === c ? 'var(--text)' : 'var(--text-ghost)'}` }}>
            {c}
          </button>
        ))}
      </div>

      {sessions.length === 0 && (
        <div style={{ padding: '2rem 1rem', color: 'var(--text-ghost)', fontSize: '0.75rem' }}>LOADING SESSIONS...</div>
      )}

      {filtered.map(s => {
        const done = loggedIds.has(s.id);
        return (
          <button key={s.id} onClick={() => router.push(`/meditation/${s.id}`)}
            style={{ display: 'flex', width: '100%', alignItems: 'center', padding: '1rem', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', background: done ? 'var(--surface-2)' : 'var(--bg)', fontFamily: 'var(--font-mono)', borderLeft: done ? '2px solid var(--positive)' : '2px solid transparent' }}>
            <span style={{ fontWeight: 700, fontSize: '0.875rem', minWidth: '2.5rem', color: done ? 'var(--positive)' : 'var(--text)' }}>{done ? '[X]' : '[ ]'}</span>
            <div style={{ flex: 1, marginLeft: '0.5rem' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem', color: done ? 'var(--text-muted)' : 'var(--text)' }}>{s.name}</p>
              <p className="label" style={{ marginTop: '0.2rem' }}>{s.category.toUpperCase()} · {s.duration_min} MIN</p>
            </div>
            <span style={{ color: 'var(--text-ghost)', fontSize: '1rem' }}>→</span>
          </button>
        );
      })}
    </div>
  );
}
