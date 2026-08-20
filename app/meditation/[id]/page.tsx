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
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4rem', paddingBottom: '5rem' }}>

      {/* Back bar — MP-01: padding px */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => { if (running) stop(); else router.push('/meditation'); }}
          className="btn btn-ghost btn-sm"
        >
          ← Back
        </button>
        <span className="label">{session?.category ?? ''}</span>
      </div>

      {/* Main content — MP-12: padding px */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '65vh', gap: '2rem', padding: '24px 16px' }}>

        {/* Title — MP-04: fontWeight 510, fontSize 32, letterSpacing -0.022em */}
        <div style={{ textAlign: 'center' as const }}>
          <p className="label" style={{ marginBottom: 8 }}>{session?.category ?? ''} · {session?.duration_min ?? 0} min</p>
          <h1 style={{ fontSize: 32, fontWeight: 510, letterSpacing: '-0.022em', color: 'var(--text)', margin: 0 }}>
            {session?.name ?? ''}
          </h1>
        </div>

        {/* Done state — MP-10: carbon bg + shadow, text color var(--text) not var(--invert), accent checkmark */}
        {done ? (
          <div style={{ background: 'var(--color-carbon)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-card)', padding: '40px 48px', textAlign: 'center' as const, width: '100%', maxWidth: 360 }}>
            <div style={{ fontSize: '3rem', marginBottom: 12, color: 'var(--accent)' }}>✓</div>
            {/* MP-08: fontWeight 510; MP-06/07: letterSpacing -0.022em */}
            <p style={{ fontSize: 32, fontWeight: 510, letterSpacing: '-0.022em', color: 'var(--text)', margin: '0 0 4px' }}>Complete</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text)', opacity: 0.6, margin: 0 }}>
              {session?.duration_min ?? 0} min session finished
            </p>
          </div>
        ) : (
          /* Timer — MP-02: var(--color-carbon) bg; timer card border per MP spec */
          <div style={{
            background: 'var(--color-carbon)',
            boxShadow: running ? 'var(--color-fog) 0px 0px 0px 1px inset' : 'var(--shadow-card)',
            borderRadius: 'var(--radius)', padding: '40px 48px', textAlign: 'center' as const,
            width: '100%', maxWidth: 360,
          }}>
            {/* MP-03: fontWeight 510; MP-05: letterSpacing var(--tracking-heading-lg); MP-09: keep clamp font size */}
            <div style={{
              fontSize: 'clamp(5rem, 28vw, 8rem)', fontWeight: 510, letterSpacing: 'var(--tracking-heading-lg)', lineHeight: 0.9,
              color: 'var(--text)',
            }}>
              {timerText}
            </div>
            {/* MP-13: fontWeight 400 */}
            <p style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 400 }}>
              {running ? 'in progress' : `${session?.duration_min ?? 0} min session`}
            </p>
          </div>
        )}

        {/* Progress bar */}
        {running && (
          <div style={{ width: '100%', maxWidth: 360 }}>
            <div className="progress">
              <div className="progress-fill" style={{ width: `${progress * 100}%`, transition: 'width 1s linear' }} />
            </div>
          </div>
        )}

        {/* Action buttons — MP-12: gap px */}
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

        {/* Instructions — MP-11: carbon bg + shadow, borderRadius 12; MP-12: padding px */}
        {!running && !done && instructions.length > 0 && (
          <div style={{ background: 'var(--color-carbon)', boxShadow: 'var(--shadow-card)', borderRadius: 12, padding: 20, width: '100%', maxWidth: 360 }}>
            <p className="label" style={{ marginBottom: 12 }}>Instructions</p>
            {instructions.map((line, i) => (
              <p key={i} style={{ margin: '0 0 0.4rem', fontSize: '0.875rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{line}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
