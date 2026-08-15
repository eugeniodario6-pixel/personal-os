'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { addMeditationLog, todayISO } from '@/lib/db';
import type { MeditationSession } from '@/lib/db';

interface MeditationTimerProps {
  session: MeditationSession;
}

type TimerState = 'idle' | 'running' | 'done';

export default function MeditationTimer({ session }: MeditationTimerProps) {
  const totalSeconds = session.duration_min * 60;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [state, setState] = useState<TimerState>('idle');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.85;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    speechRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, []);

  const handleStart = useCallback(() => {
    setState('running');
    startTimeRef.current = Date.now();
    if (session.instructions) {
      speak(session.instructions.replace(/\n/g, '. '));
    }
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const remaining = Math.max(totalSeconds - elapsed, 0);
      setSecondsLeft(remaining);
      if (remaining === 0) {
        clearInterval(intervalRef.current!);
        setState('done');
        speak('Session complete. Well done.');
      }
    }, 500);
  }, [totalSeconds, session.instructions, speak]);

  const handleStop = useCallback(async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const minutesCompleted = Math.max(Math.round(elapsed / 60), 1);
    await addMeditationLog({
      session_id: session.id,
      date: todayISO(),
      completed: state === 'done',
      duration_actual_min: minutesCompleted,
      logged_at: new Date().toISOString(),
    });
    setState('idle');
    setSecondsLeft(totalSeconds);
    startTimeRef.current = 0;
  }, [state, totalSeconds, session.id]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = 1 - secondsLeft / totalSeconds;
  const formatTime = (m: number, s: number) =>
    `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '2rem', padding: '2rem' }}>
      <div style={{ textAlign: 'center', width: '100%' }}>
        <p className="label" style={{ marginBottom: '0.5rem' }}>{session.category}</p>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', fontFamily: "'IBM Plex Mono', monospace" }}>{session.name}</h1>
      </div>
      <div style={{ textAlign: 'center', border: state === 'running' ? '2px solid #fff' : '2px solid #444', padding: '2rem 3rem', background: state === 'done' ? '#fff' : '#000' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '4rem', fontWeight: 700, letterSpacing: '-0.02em', color: state === 'done' ? '#000' : '#fff', lineHeight: 1 }}>
          {state === 'done' ? 'DONE' : formatTime(minutes, seconds)}
        </div>
        <div className="label" style={{ marginTop: '0.5rem', color: state === 'done' ? '#444' : '#888' }}>
          {state === 'idle' ? `${session.duration_min} MIN` : state === 'done' ? 'COMPLETE' : 'REMAINING'}
        </div>
      </div>
      {state === 'running' && (
        <div style={{ width: '100%', maxWidth: '320px', height: '6px', background: '#111', border: '1px solid #444' }}>
          <div style={{ height: '100%', background: '#fff', width: `${progress * 100}%` }} />
        </div>
      )}
      <div style={{ display: 'flex', gap: '1rem' }}>
        {state === 'idle' && <button className="btn-primary btn" onClick={handleStart}>START SESSION</button>}
        {(state === 'running' || state === 'done') && (
          <button className="btn" onClick={handleStop}>{state === 'done' ? 'LOG & CLOSE' : 'STOP & LOG'}</button>
        )}
      </div>
      {session.instructions && state === 'idle' && (
        <div style={{ border: '2px solid #111', padding: '1rem', maxWidth: '480px', width: '100%' }}>
          <p className="label" style={{ marginBottom: '0.5rem' }}>INSTRUCTIONS</p>
          {session.instructions.split('\n').map((line, i) => (
            <p key={i} style={{ fontSize: '0.8rem', color: '#888', lineHeight: 1.6, fontFamily: "'IBM Plex Mono', monospace", marginBottom: '0.25rem' }}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}
