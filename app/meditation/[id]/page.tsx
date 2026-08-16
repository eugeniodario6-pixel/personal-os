'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getMeditationSession, addMeditationLog, todayISO, type MeditationSession } from '@/lib/db';

export default function MeditationPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<MeditationSession | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const load = useCallback(async () => {
    const s = await getMeditationSession(parseInt(id));
    setSession(s ?? null);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    };
  }, []);

  const totalSecs = (session?.duration_min ?? 0) * 60;
  const remaining = Math.max(totalSecs - elapsed, 0);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timerText = running || done ? `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : 'READY';
  const progress = totalSecs > 0 ? Math.min(elapsed / totalSecs, 1) : 0;

  const start = () => {
    if (!session) return;
    setRunning(true);
    setElapsed(0);
    setDone(false);

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const lines = (session.instructions ?? '').split('\n').filter(Boolean);
      let i = 0;
      const speakNext = () => {
        if (i >= lines.length) return;
        const u = new SpeechSynthesisUtterance(lines[i++]);
        u.rate = 0.85;
        u.onend = () => setTimeout(speakNext, 1500);
        synthRef.current = u;
        window.speechSynthesis.speak(u);
      };
      speakNext();
    }

    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev + 1 >= totalSecs) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          setDone(true);
          if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
          addMeditationLog({
            session_id: session.id,
            date: todayISO(),
            completed: true,
            duration_actual_min: session.duration_min,
            logged_at: new Date().toISOString(),
          });
          return totalSecs;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stop = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    setRunning(false);
    if (session && elapsed > 0) {
      await addMeditationLog({
        session_id: session.id,
        date: todayISO(),
        completed: false,
        duration_actual_min: Math.round(elapsed / 60),
        logged_at: new Date().toISOString(),
      });
    }
    router.push('/meditation');
  };

  const instructions = (session?.instructions ?? '').split('\n').filter(Boolean);

  return (
    <div style={{ fontFamily: 'var(--font-mono)' }}>
      <div style={{ padding: '0.75rem 1rem', borderBottom: '2px solid var(--border-strong)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => { if (running) stop(); else router.push('/meditation'); }}
          style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.4rem 0.75rem', background: 'var(--bg)', border: '2px solid var(--border-strong)', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
          ← BACK
        </button>
        <span className="label">{session?.category?.toUpperCase() ?? ''}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '2rem', padding: '2rem' }}>
        <div style={{ textAlign: 'center', width: '100%' }}>
          <p className="label" style={{ marginBottom: '0.5rem' }}>{session?.category?.toUpperCase() ?? ''}</p>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>{session?.name ?? ''}</h1>
        </div>

        <div style={{ textAlign: 'center', padding: '2rem 3rem', border: running ? '2px solid var(--text)' : '2px solid var(--border-strong)', background: done ? 'var(--surface-2)' : 'var(--bg)' }}>
          <div style={{ fontSize: '4rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: done ? 'var(--positive)' : 'var(--text)' }}>
            {done ? 'DONE' : timerText}
          </div>
          <div className="label" style={{ marginTop: '0.5rem', color: done ? 'var(--text-ghost)' : 'var(--text-muted)' }}>
            {done ? 'SESSION COMPLETE' : running ? `${mins}:${String(secs).padStart(2, '0')} REMAINING` : `${session?.duration_min ?? 0} MIN SESSION`}
          </div>
        </div>

        {running && (
          <div style={{ width: '100%', maxWidth: 320, height: 6, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{ height: '100%', background: 'var(--text)', width: `${progress * 100}%` }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem' }}>
          {!running && !done && (
            <button onClick={start} className="btn btn-primary" style={{ padding: '0.6rem 1.5rem' }}>
              START SESSION
            </button>
          )}
          {running && (
            <button onClick={stop} className="btn btn-outline" style={{ padding: '0.6rem 1.5rem' }}>
              STOP
            </button>
          )}
          {done && (
            <button onClick={() => router.push('/meditation')} className="btn btn-primary" style={{ padding: '0.6rem 1.5rem' }}>
              DONE →
            </button>
          )}
        </div>

        {!running && !done && instructions.length > 0 && (
          <div style={{ border: '2px solid var(--border)', padding: '1rem', width: '100%', boxSizing: 'border-box' as const }}>
            <p className="label" style={{ marginBottom: '0.5rem' }}>INSTRUCTIONS</p>
            {instructions.map((line, i) => (
              <p key={i} style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{line}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
