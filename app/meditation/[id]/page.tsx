'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getMeditationSession, addMeditationLog, todayISO, type MeditationSession } from '@/lib/db';

// ─── iOS audio unlock ──────────────────────────────────────────────────────────
let _unlockedAudio: HTMLAudioElement | null = null;
function unlockAudio() {
  if (_unlockedAudio || typeof window === 'undefined') return;
  try {
    _unlockedAudio = new Audio();
    _unlockedAudio.src = 'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
    _unlockedAudio.volume = 0;
    _unlockedAudio.play().catch(() => {});
  } catch { /* ignore */ }
}

// ─── ElevenLabs TTS ────────────────────────────────────────────────────────────
const JARVIS_VOICE = 'daniel';

async function speakJarvis(text: string, onEnd?: () => void): Promise<HTMLAudioElement | null> {
  try {
    const voice = typeof window !== 'undefined'
      ? (localStorage.getItem('jarvis_voice') ?? JARVIS_VOICE)
      : JARVIS_VOICE;

    const res = await fetch('/api/jarvis/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });
    if (!res.ok) { onEnd?.(); return null; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const audio = _unlockedAudio ?? new Audio();
    audio.src = url; audio.volume = 1;
    if (onEnd) audio.onended = onEnd;
    audio.play().catch(() => {
      const a2 = new Audio(url);
      if (onEnd) a2.onended = onEnd;
      a2.play().catch(() => onEnd?.());
    });
    return audio;
  } catch { onEnd?.(); return null; }
}

// ─── Circular progress ring ────────────────────────────────────────────────────
function ProgressRing({ progress, size = 240 }: { progress: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);
  return (
    <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="#DAFF01" strokeWidth={3}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  );
}

export default function MeditationPlayerPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const [session, setSession]   = useState<MeditationSession | null>(null);
  const [phase, setPhase]       = useState<'ready' | 'running' | 'done'>('ready');
  const [elapsed, setElapsed]   = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [currentLine, setCurrentLine] = useState('');
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef      = useRef<HTMLAudioElement | null>(null);
  const cancelledRef  = useRef(false);

  useEffect(() => {
    getMeditationSession(parseInt(id)).then(s => setSession(s ?? null));
    return () => {
      cancelledRef.current = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    };
  }, [id]);

  const totalSecs = (session?.duration_min ?? 0) * 60;
  const progress  = totalSecs > 0 ? Math.min(elapsed / totalSecs, 1) : 0;
  const remaining = Math.max(totalSecs - elapsed, 0);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  // ── Guide session with Jarvis voice ──────────────────────────────────────────
  const runGuidance = useCallback(async (s: MeditationSession) => {
    if (!s.instructions) return;
    cancelledRef.current = false;

    // Opening line
    const opener = `Let's begin. ${s.name}. ${s.duration_min} minute session. ${s.instructions.split('.')[0]}.`;
    setSpeaking(true); setCurrentLine(opener);
    await new Promise<void>(resolve => {
      speakJarvis(opener, () => { setSpeaking(false); resolve(); });
    });

    // Timed cues — spread instruction sentences across the session
    const sentences = s.instructions
      .split(/[.!?]+/)
      .map(l => l.trim())
      .filter(l => l.length > 10);

    const intervalMs = sentences.length > 0
      ? Math.floor((totalSecs * 1000) / (sentences.length + 2))
      : 30000;

    for (let i = 0; i < sentences.length; i++) {
      if (cancelledRef.current) return;
      await new Promise<void>(r => setTimeout(r, intervalMs));
      if (cancelledRef.current) return;
      const line = sentences[i];
      setSpeaking(true); setCurrentLine(line);
      await new Promise<void>(resolve => {
        speakJarvis(line, () => { setSpeaking(false); resolve(); });
      });
    }
  }, [totalSecs]);

  const start = useCallback(async () => {
    if (!session) return;
    unlockAudio();
    setPhase('running'); setElapsed(0); cancelledRef.current = false;

    // Start timer
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev + 1 >= totalSecs) {
          clearInterval(intervalRef.current!);
          cancelledRef.current = true;
          setPhase('done');
          addMeditationLog({
            session_id: session.id, date: todayISO(), completed: true,
            duration_actual_min: session.duration_min, logged_at: new Date().toISOString(),
          });
          // Closing line from Jarvis
          setTimeout(() => {
            setSpeaking(true);
            setCurrentLine('Session complete. Well done.');
            speakJarvis('Session complete. Well done.', () => setSpeaking(false));
          }, 500);
          return totalSecs;
        }
        return prev + 1;
      });
    }, 1000);

    // Start voice guidance
    runGuidance(session);
  }, [session, totalSecs, runGuidance]);

  const stop = useCallback(async () => {
    cancelledRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    if (session && elapsed > 0) {
      await addMeditationLog({
        session_id: session.id, date: todayISO(), completed: false,
        duration_actual_min: Math.round(elapsed / 60), logged_at: new Date().toISOString(),
      });
    }
    router.push('/meditation');
  }, [session, elapsed, router]);

  if (!session) {
    return (
      <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'rgba(255,255,255,0.5)', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{ padding: '52px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => phase === 'running' ? stop() : router.push('/meditation')}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 22, padding: '4px 8px', lineHeight: 1, WebkitTapHighlightColor: 'transparent' }}
        >←</button>
        <div>
          <p style={{ margin: 0, fontSize: '0.55rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{session.category} · {session.duration_min} min</p>
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#fff', letterSpacing: '-0.015em' }}>{session.name}</p>
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 32px', gap: 0 }}>

        {/* ── Timer circle ── */}
        <div style={{ position: 'relative', width: 240, height: 240, marginBottom: 40 }}>
          <ProgressRing progress={phase === 'ready' ? 0 : progress} size={240} />

          {/* Inner content */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {phase === 'done' ? (
              <>
                <div style={{ fontSize: 42, marginBottom: 4, color: '#fff' }}>✓</div>
                <p style={{ margin: 0, fontSize: '0.6rem', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>COMPLETE</p>
              </>
            ) : phase === 'ready' ? (
              <>
                <p style={{ margin: 0, fontSize: '2.2rem', fontWeight: 510, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>READY</p>
                <p style={{ margin: '6px 0 0', fontSize: '0.6rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-mono)' }}>{session.duration_min} MIN</p>
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: '3rem', fontWeight: 510, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </p>
                {/* Jarvis speaking indicator */}
                {speaking && (
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginTop: 10 }}>
                    {[1,2,3,2,1].map((h, i) => (
                      <div key={i} style={{ width: 3, height: h * 4, background: '#DAFF01', borderRadius: 2, animation: `jbar 0.7s ease-in-out ${i * 0.1}s infinite alternate` }} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Current instruction / Jarvis line ── */}
        <div style={{ minHeight: 72, textAlign: 'center', maxWidth: 300 }}>
          {phase === 'running' && currentLine && (
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.65, color: speaking ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.28)', letterSpacing: '-0.01em', transition: 'color 0.4s', animation: 'fadeup 0.4s ease' }}>
              {currentLine}
            </p>
          )}
          {phase === 'done' && (
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '-0.01em' }}>
              {session.duration_min} min completed
            </p>
          )}
          {phase === 'ready' && session.instructions && (
            <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.65, color: 'rgba(255,255,255,0.32)', letterSpacing: '-0.01em' }}>
              {session.instructions.split('.')[0]}.
            </p>
          )}
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{ padding: '0 24px', paddingBottom: 'max(48px, calc(env(safe-area-inset-bottom) + 36px))', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {phase === 'ready' && (
          <button
            onClick={start}
            style={{ width: '100%', padding: '17px', background: '#fff', color: '#000', border: 'none', borderRadius: 99, fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em', WebkitTapHighlightColor: 'transparent', fontFamily: 'var(--font)' }}
          >
            Start Session
          </button>
        )}
        {phase === 'running' && (
          <button
            onClick={stop}
            style={{ width: '100%', padding: '17px', background: 'transparent', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 99, fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer', letterSpacing: '-0.01em', WebkitTapHighlightColor: 'transparent', fontFamily: 'var(--font)' }}
          >
            Stop Session
          </button>
        )}
        {phase === 'done' && (
          <button
            onClick={() => router.push('/meditation')}
            style={{ width: '100%', padding: '17px', background: '#fff', color: '#000', border: 'none', borderRadius: 99, fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em', WebkitTapHighlightColor: 'transparent', fontFamily: 'var(--font)' }}
          >
            Done →
          </button>
        )}

        {/* Instructions — ready state only */}
        {phase === 'ready' && session.instructions && (
          <div style={{ background: '#141616', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: '16px 18px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '0.55rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Instructions</p>
            <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.4)', letterSpacing: '-0.008em' }}>
              {session.instructions}
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes jbar    { from{transform:scaleY(.3)} to{transform:scaleY(1.6)} }
        @keyframes fadeup  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}
