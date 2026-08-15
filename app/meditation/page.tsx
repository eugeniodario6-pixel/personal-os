'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { db, todayISO, type MeditationSession, type MeditationLog } from '@/lib/db';

const CATEGORY_ORDER = ['Breathing', 'Body scan', 'Sleep', 'Stress release', 'Focus'];

interface SessionWithLog extends MeditationSession {
  doneToday: boolean;
  totalMinutes: number;
}

export default function MeditationPage() {
  const [sessions, setSessions] = useState<SessionWithLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  const loadData = useCallback(async () => {
    const today = todayISO();
    const [allSessions, todayLogs, allLogs] = await Promise.all([
      db.meditation_session.toArray(),
      db.meditation_log.where('date').equals(today).toArray(),
      db.meditation_log.toArray(),
    ]);

    const doneSet = new Set(todayLogs.filter((l) => l.completed || l.duration_actual_min > 0).map((l) => l.session_id));
    const minutesBySession: Record<number, number> = {};
    for (const log of allLogs) {
      minutesBySession[log.session_id] = (minutesBySession[log.session_id] ?? 0) + log.duration_actual_min;
    }

    const enriched: SessionWithLog[] = allSessions.map((s) => ({
      ...s,
      doneToday: doneSet.has(s.id),
      totalMinutes: minutesBySession[s.id] ?? 0,
    }));

    setSessions(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', fontFamily: "'IBM Plex Mono', monospace", color: '#444', fontSize: '0.75rem' }}>
        LOADING...
      </div>
    );
  }

  const categories = ['ALL', ...CATEGORY_ORDER.filter((c) => sessions.some((s) => s.category === c))];
  const filtered = activeCategory === 'ALL' ? sessions : sessions.filter((s) => s.category === activeCategory);

  const todayTotal = sessions.filter((s) => s.doneToday).reduce((a, s) => {
    const todayLog = db.meditation_log; // we'll use our precomputed
    return a;
  }, 0);

  // Find a suggestion (not done today, shortest)
  const undone = sessions.filter((s) => !s.doneToday).sort((a, b) => a.duration_min - b.duration_min);
  const suggested = undone[0] ?? null;

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: '2px solid #444' }}>
        <p className="label" style={{ marginBottom: '0.25rem' }}>MEDITATION</p>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', fontFamily: "'IBM Plex Mono', monospace" }}>MIND</h1>
      </div>

      {/* Suggested session */}
      {suggested && (
        <div style={{ borderBottom: '2px solid #444' }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}>
            <span className="label">START HERE</span>
          </div>
          <Link href={`/meditation/${suggested.id}`} style={{ textDecoration: 'none', display: 'block' }}>
            <div
              style={{
                padding: '1rem',
                background: '#111',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: '1rem', color: '#fff', marginBottom: '0.25rem' }}>
                  {suggested.name}
                </p>
                <p className="label">
                  {suggested.category} · {suggested.duration_min} MIN
                </p>
              </div>
              <div
                style={{
                  border: '2px solid #fff',
                  background: '#fff',
                  color: '#000',
                  padding: '0.5rem 1rem',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                START →
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Category filter */}
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          borderBottom: '2px solid #444',
          gap: '0',
        }}
      >
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              flex: '0 0 auto',
              padding: '0.6rem 1rem',
              background: '#000',
              border: 'none',
              borderBottom: activeCategory === cat ? '2px solid #fff' : '2px solid transparent',
              marginBottom: '-2px',
              color: activeCategory === cat ? '#fff' : '#444',
              fontSize: '0.6rem',
              fontWeight: 700,
              letterSpacing: '0.15em',
              fontFamily: "'IBM Plex Mono', monospace",
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {cat.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Session list */}
      <div>
        {filtered.map((session, i) => (
          <Link
            key={session.id}
            href={`/meditation/${session.id}`}
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '1rem',
                borderBottom: '1px solid #111',
                background: session.doneToday ? '#111' : '#000',
              }}
            >
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  color: session.doneToday ? '#fff' : '#444',
                  minWidth: '2.5rem',
                }}
              >
                {session.doneToday ? '[X]' : '[ ]'}
              </span>
              <div style={{ flex: 1, marginLeft: '0.5rem' }}>
                <p
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    color: session.doneToday ? '#888' : '#fff',
                  }}
                >
                  {session.name}
                </p>
                <p className="label">
                  {session.category} · {session.duration_min} MIN
                  {session.totalMinutes > 0 ? ` · ${session.totalMinutes}MIN TOTAL` : ''}
                </p>
              </div>
              <span style={{ color: '#444', fontSize: '1rem' }}>→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
