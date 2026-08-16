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
    <div style={{ minHeight: '100dvh', background: '#0F0F14', paddingTop: '4rem', paddingBottom: '5rem', fontFamily: 'Inter, sans-serif' }}>
      {/* Header bar */}
      <div style={{ margin: '0 1rem 1rem', background: '#17171F', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={() => { if (running) stop(); else router.push('/meditation'); }}
          style={{ background: '#1E1E28', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, color: '#7A7A8C', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, padding: '0.4rem 0.875rem', fontFamily: 'Inter, sans-serif' }}
        >
          ← Back
        </button>
        <span style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7A7A8C' }}>
          {session?.category?.toUpperCase() ?? ''}
        </span>
      </div>

      {/* Main centered content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '2rem', padding: '1rem 1.5rem' }}>
        {/* Session title */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 0.4rem', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6366F1' }}>
            {session?.category?.toUpperCase() ?? ''}
          </p>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>
            {session?.name ?? ''}
          </h1>
        </div>

        {/* Timer display */}
        {done ? (
          <div style={{ background: 'linear-gradient(135deg,#6366F1,#818CF8)', borderRadius: 24, padding: '2.5rem 3rem', textAlign: 'center', width: '100%', maxWidth: 360, boxSizing: 'border-box' }}>
            <div style={{ fontSize: '3.5rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1 }}>✓</div>
            <p style={{ margin: '0.75rem 0 0.25rem', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>Complete</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
              {session?.duration_min ?? 0} min session finished
            </p>
          </div>
        ) : (
          <div style={{
            background: '#17171F', border: `1px solid ${running ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 24, padding: '2.5rem 3rem', textAlign: 'center', width: '100%', maxWidth: 360, boxSizing: 'border-box',
          }}>
            {/* Giant timer */}
            <div style={{
              fontSize: 'clamp(5rem, 28vw, 8rem)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1,
              background: running ? 'linear-gradient(90deg,#6366F1,#818CF8)' : 'none',
              WebkitBackgroundClip: running ? 'text' : 'unset',
              WebkitTextFillColor: running ? 'transparent' : '#fff',
              color: running ? 'transparent' : '#fff',
            }}>
              {timerText}
            </div>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', fontWeight: 500, color: '#7A7A8C' }}>
              {running ? `${mins}:${String(secs).padStart(2, '0')} remaining` : `${session?.duration_min ?? 0} min session`}
            </p>
          </div>
        )}

        {/* Progress bar (indigo) */}
        {running && (
          <div style={{ width: '100%', maxWidth: 360, height: 5, background: '#25252F', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 999,
              background: 'linear-gradient(90deg,#6366F1,#818CF8)',
              width: `${progress * 100}%`,
              transition: 'width 1s linear',
            }} />
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', width: '100%', maxWidth: 360 }}>
          {!running && !done && (
            <button
              onClick={start}
              style={{ flex: 1, background: 'linear-gradient(90deg,#6366F1,#818CF8)', color: '#fff', border: 'none', borderRadius: 14, padding: '1rem', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.01em' }}
            >
              Start Session
            </button>
          )}
          {running && (
            <button
              onClick={stop}
              style={{ flex: 1, background: '#17171F', color: '#7A7A8C', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '1rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              Stop
            </button>
          )}
          {done && (
            <button
              onClick={() => router.push('/meditation')}
              style={{ flex: 1, background: '#fff', color: '#000', border: 'none', borderRadius: 14, padding: '1rem', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              Done →
            </button>
          )}
        </div>

        {/* Instructions */}
        {!running && !done && instructions.length > 0 && (
          <div style={{ background: '#17171F', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.25rem', width: '100%', maxWidth: 360, boxSizing: 'border-box' }}>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7A7A8C' }}>INSTRUCTIONS</p>
            {instructions.map((line, i) => (
              <p key={i} style={{ margin: '0 0 0.4rem', fontSize: '0.85rem', color: '#7A7A8C', lineHeight: 1.6 }}>{line}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
