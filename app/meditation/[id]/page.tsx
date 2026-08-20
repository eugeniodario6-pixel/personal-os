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
  const timerText = running || done
    ? `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : 'READY';
  const progress = totalSecs > 0 ? Math.min(elapsed / totalSecs, 1) : 0;

  const start = () => {
    if (!session) return;
    setRunning(true); setElapsed(0); setDone(false);
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
          setRunning(false); setDone(true);
          if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
          addMeditationLog({
            session_id: session.id, date: todayISO(), completed: true,
            duration_actual_min: session.duration_min, logged_at: new Date().toISOString(),
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
        session_id: session.id, date: todayISO(), completed: false,
        duration_actual_min: Math.round(elapsed / 60), logged_at: new Date().toISOString(),
      });
    }
    router.push('/meditation');
  };

  const instructions = (session?.instructions ?? '').split('\n').filter(Boolean);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4rem', paddingBottom: '100px' }}>

      {/* Back bar */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => { if (running) stop(); else router.push('/meditation'); }}
          className="btn btn-ghost btn-sm"
        >
          ← Back
        </button>
        <span className="label">{session?.category ?? ''}</span>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '65vh', gap: '2rem', padding: '24px 16px' }}>

        {/* Title */}
        <div style={{ textAlign: 'center' as const }}>
          <p className="label" style={{ marginBottom: 8 }}>{session?.category ?? ''} · {session?.duration_min ?? 0} min</p>
          <h1 style={{ fontSize: 32, fontWeight: 510, letterSpacing: '-0.022em', color: 'var(--text)', margin: 0 }}>
            {session?.name ?? ''}
          </h1>
        </div>

        {/* Done state */}
        {done ? (
          <div style={{
            background: 'var(--surface-2)',
            borderRadius: 24,
            boxShadow: 'var(--ring)',
            padding: '40px 48px',
            textAlign: 'center' as const,
            width: '100%',
            maxWidth: 360,
          }}>
            <div style={{ fontSize: '3rem', marginBottom: 12, color: 'var(--text)' }}>✓</div>
            <p style={{ fontSize: 32, fontWeight: 510, letterSpacing: '-0.022em', color: 'var(--text)', margin: '0 0 4px' }}>Complete</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: 0 }}>
              {session?.duration_min ?? 0} min session finished
            </p>
          </div>
        ) : (
          /* Timer card */
          <div style={{
            background: 'var(--surface)',
            boxShadow: running ? 'var(--ring-2)' : 'var(--ring)',
            borderRadius: 24,
            padding: '40px 48px',
            textAlign: 'center' as const,
            width: '100%',
            maxWidth: 360,
            transition: 'box-shadow 0.2s',
          }}>
            <div style={{
              fontSize: 'clamp(5rem, 28vw, 8rem)',
              fontWeight: 510,
              letterSpacing: '-0.022em',
              lineHeight: 0.9,
              color: 'var(--text)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {timerText}
            </div>
            <p style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 400 }}>
              {running ? 'in progress' : `${session?.duration_min ?? 0} min session`}
            </p>
          </div>
        )}

        {/* Progress bar */}
        {running && (
          <div style={{ width: '100%', maxWidth: 360 }}>
            <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress * 100}%`, background: 'var(--text)', borderRadius: 2, transition: 'width 1s linear' }} />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 360 }}>
          {!running && !done && (
            <button onClick={start} className="btn btn-primary btn-block">
              Start Session
            </button>
          )}
          {running && (
            <button onClick={stop} className="btn btn-ghost btn-block">
              Stop
            </button>
          )}
          {done && (
            <button onClick={() => router.push('/meditation')} className="btn btn-primary btn-block">
              Done →
            </button>
          )}
        </div>

        {/* Instructions card */}
        {!running && !done && instructions.length > 0 && (
          <div style={{
            background: 'var(--surface)',
            boxShadow: 'var(--ring)',
            borderRadius: 24,
            padding: 20,
            width: '100%',
            maxWidth: 360,
          }}>
            <p className="label" style={{ marginBottom: 12 }}>Instructions</p>
            {instructions.map((line, i) => (
              <p key={i} style={{ margin: '0 0 0.4rem', fontSize: '0.875rem', color: 'var(--text-3)', lineHeight: 1.6 }}>{line}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
