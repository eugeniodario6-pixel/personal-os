'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getMeditationSession, addMeditationLog, todayISO, type MeditationSession } from '@/lib/db';

const MONO = "'IBM Plex Mono', monospace";
const lbl = { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#888', margin: 0 };
const border2 = '2px solid #444';

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
    <div style={{ fontFamily: MONO }}>
      <div style={{ padding: '0.75rem 1rem', borderBottom: border2, display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => { if (running) stop(); else router.push('/meditation'); }}
          style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.4rem 0.75rem', background: '#000', border: '2px solid #444', color: '#888', cursor: 'pointer', fontFamily: MONO }}>
          ← BACK
        </button>
        <span style={lbl}>{session?.category?.toUpperCase() ?? ''}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '2rem', padding: '2rem' }}>
        <div style={{ textAlign: 'center', width: '100%' }}>
          <p style={{ ...lbl, marginBottom: '0.5rem' }}>{session?.category?.toUpperCase() ?? ''}</p>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{session?.name ?? ''}</h1>
        </div>

        <div style={{ textAlign: 'center', padding: '2rem 3rem', border: running ? '2px solid #fff' : border2, background: done ? '#fff' : '#000' }}>
          <div style={{ fontSize: '4rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: done ? '#000' : '#fff' }}>
            {done ? 'DONE' : timerText}
          </div>
          <div style={{ marginTop: '0.5rem', ...lbl, color: done ? '#444' : '#888' }}>
            {done ? 'SESSION COMPLETE' : running ? `${mins}:${String(secs).padStart(2, '0')} REMAINING` : `${session?.duration_min ?? 0} MIN SESSION`}
          </div>
        </div>

        {running && (
          <div style={{ width: '100%', maxWidth: 320, height: 6, background: '#111', border: '1px solid #444' }}>
            <div style={{ height: '100%', background: '#fff', width: `${progress * 100}%` }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem' }}>
          {!running && !done && (
            <button onClick={start} style={{ padding: '0.6rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', background: '#fff', color: '#000', border: border2, fontFamily: MONO }}>
              START SESSION
            </button>
          )}
          {running && (
            <button onClick={stop} style={{ padding: '0.6rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', background: '#000', color: '#fff', border: border2, fontFamily: MONO }}>
              STOP
            </button>
          )}
          {done && (
            <button onClick={() => router.push('/meditation')} style={{ padding: '0.6rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', background: '#fff', color: '#000', border: border2, fontFamily: MONO }}>
              DONE →
            </button>
          )}
        </div>

        {!running && !done && instructions.length > 0 && (
          <div style={{ border: '2px solid #111', padding: '1rem', width: '100%', boxSizing: 'border-box' as const }}>
            <p style={{ ...lbl, marginBottom: '0.5rem' }}>INSTRUCTIONS</p>
            {instructions.map((line, i) => (
              <p key={i} style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: '#888', lineHeight: 1.6 }}>{line}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
