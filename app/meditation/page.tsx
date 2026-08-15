'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db, todayISO, type MeditationSession } from '@/lib/db';

const MONO = "'IBM Plex Mono', monospace";
const lbl = { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#888', margin: 0 };
const border2 = '2px solid #444';
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
      db.meditation_session.toArray(),
      db.meditation_log.where('date').equals(today).toArray(),
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
    <div style={{ fontFamily: MONO }}>
      <div style={{ padding: '1rem', borderBottom: border2 }}>
        <p style={{ ...lbl, marginBottom: '0.25rem' }}>MEDITATION</p>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>MIND</h1>
      </div>

      {suggested && (
        <div style={{ borderBottom: border2 }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}><span style={lbl}>START HERE</span></div>
          <button onClick={() => router.push(`/meditation/${suggested.id}`)}
            style={{ width: '100%', padding: '1rem', background: '#111', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: MONO }}>
            <div>
              <p style={{ margin: '0 0 0.25rem', fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{suggested.name}</p>
              <p style={{ ...lbl }}>{suggested.category.toUpperCase()} · {suggested.duration_min} MIN</p>
            </div>
            <span style={{ border: border2, background: '#fff', color: '#000', padding: '0.5rem 1rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>START →</span>
          </button>
        </div>
      )}

      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: border2 }}>
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)}
            style={{ flex: '0 0 auto', padding: '0.6rem 1rem', background: '#000', border: 'none', marginBottom: -2, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.15em', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: MONO, color: cat === c ? '#fff' : '#444', borderBottom: `2px solid ${cat === c ? '#fff' : '#444'}` }}>
            {c}
          </button>
        ))}
      </div>

      {filtered.map(s => {
        const done = loggedIds.has(s.id);
        return (
          <button key={s.id} onClick={() => router.push(`/meditation/${s.id}`)}
            style={{ display: 'flex', width: '100%', alignItems: 'center', padding: '1rem', border: 'none', borderBottom: '1px solid #111', cursor: 'pointer', textAlign: 'left', background: done ? '#fff' : '#000', fontFamily: MONO }}>
            <span style={{ fontWeight: 700, fontSize: '0.875rem', minWidth: '2.5rem', color: done ? '#000' : '#fff' }}>{done ? '[X]' : '[ ]'}</span>
            <div style={{ flex: 1, marginLeft: '0.5rem' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem', color: done ? '#000' : '#fff' }}>{s.name}</p>
              <p style={{ ...lbl, marginTop: '0.2rem' }}>{s.category.toUpperCase()} · {s.duration_min} MIN</p>
            </div>
            <span style={{ color: done ? '#444' : '#444', fontSize: '1rem' }}>→</span>
          </button>
        );
      })}
    </div>
  );
}
