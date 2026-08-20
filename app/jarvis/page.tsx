'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getProfile, getHabits, getHabitCompletions, getTodayMacros,
  getTrainingSessions, getCurrentTrainingWeek, getTrainingWeek,
  getWeightHistory, getDailyScore, todayISO,
} from '@/lib/db';
import { haptic } from '@/lib/haptic';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ─── Voice — tap to toggle ─────────────────────────────────────────────────────
function useVoice(onResult: (text: string) => void) {
  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const toggle = useCallback(() => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    if (!supported) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setListening(false);
      onResult(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening, supported, onResult]);

  return { listening, toggle, supported };
}

// ─── TTS ──────────────────────────────────────────────────────────────────────
function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const doSpeak = () => {
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.0;
    utt.pitch = 0.85;
    utt.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find(v => v.name.includes('Daniel')) ||
      voices.find(v => v.name.includes('Aaron')) ||
      voices.find(v => v.name.includes('Alex')) ||
      voices.find(v => v.name === 'Google UK English Male') ||
      voices.find(v => v.lang === 'en-GB') ||
      voices.find(v => v.lang.startsWith('en'));
    if (preferred) utt.voice = preferred;
    window.speechSynthesis.speak(utt);
  };

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    doSpeak();
  } else {
    window.speechSynthesis.onvoiceschanged = () => doSpeak();
  }
}

// ─── Avatar ────────────────────────────────────────────────────────────────────
function JarvisAvatar({ loading, listening }: { loading: boolean; listening: boolean }) {
  const active = loading || listening;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0 28px' }}>
      <div style={{ position: 'relative', width: 130, height: 130 }}>
        {/* Outer ring */}
        <div style={{
          position: 'absolute', inset: -10, borderRadius: '50%',
          border: '1px solid rgba(218,255,1,0.15)',
          animation: active ? 'j-ring1 2s ease-in-out infinite' : 'none',
        }} />
        {/* Mid ring */}
        <div style={{
          position: 'absolute', inset: -4, borderRadius: '50%',
          border: '1px solid rgba(218,255,1,0.3)',
          animation: active ? 'j-ring2 2s ease-in-out 0.4s infinite' : 'none',
        }} />
        {/* Main circle */}
        <div style={{
          width: 130, height: 130, borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 32%, #1c1c1c, #000)',
          boxShadow: active
            ? 'rgba(218,255,1,0.6) 0 0 0 1.5px, rgba(218,255,1,0.25) 0 0 50px'
            : 'rgba(218,255,1,0.25) 0 0 0 1.5px, rgba(218,255,1,0.06) 0 0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
          transition: 'box-shadow 0.4s',
        }}>
          {/* Hex grid */}
          <svg width="130" height="130" style={{ position: 'absolute', opacity: 0.12 }}>
            <defs>
              <pattern id="hexp" x="0" y="0" width="20" height="17.3" patternUnits="userSpaceOnUse">
                <polygon points="10,1 19,5.5 19,14.5 10,19 1,14.5 1,5.5"
                  fill="none" stroke="#DAFF01" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="130" height="130" fill="url(#hexp)" />
          </svg>
          {/* Core hex */}
          <span style={{
            fontSize: 48, lineHeight: 1, color: '#DAFF01', position: 'relative', zIndex: 1,
            filter: active ? 'drop-shadow(0 0 16px #DAFF01)' : 'drop-shadow(0 0 6px rgba(218,255,1,0.4))',
            transition: 'filter 0.3s',
            display: 'inline-block',
            animation: loading ? 'j-spin 5s linear infinite' : 'none',
          }}>⬡</span>
          {/* Waveform bars when listening */}
          {listening && (
            <div style={{
              position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: 3, alignItems: 'center',
            }}>
              {[2,3,5,4,6,4,3,2].map((h, i) => (
                <div key={i} style={{
                  width: 3, height: h * 3, background: '#DAFF01', borderRadius: 2,
                  animation: `j-bar 0.7s ease-in-out ${i * 0.08}s infinite alternate`,
                }} />
              ))}
            </div>
          )}
        </div>
        {/* Status dot */}
        <div style={{
          position: 'absolute', bottom: 5, right: 5,
          width: 15, height: 15, borderRadius: '50%',
          background: loading ? 'rgba(218,255,1,0.5)' : listening ? '#DAFF01' : '#DAFF01',
          boxShadow: '0 0 10px #DAFF01',
          border: '2.5px solid #000',
          animation: (loading || listening) ? 'j-pulse 1s ease infinite' : 'none',
        }} />
      </div>

      <p style={{
        margin: '18px 0 5px', fontSize: '1rem', fontWeight: 700,
        letterSpacing: '0.18em', color: '#fff', fontFamily: 'var(--font-mono)',
      }}>JARVIS</p>
      <p style={{
        margin: 0, fontSize: '0.55rem', letterSpacing: '0.1em',
        color: loading ? '#DAFF01' : listening ? '#DAFF01' : 'rgba(255,255,255,0.28)',
        fontFamily: 'var(--font-mono)', transition: 'color 0.3s',
      }}>
        {loading ? 'PROCESSING…' : listening ? 'LISTENING…' : 'ONLINE'}
      </p>

      <style>{`
        @keyframes j-ring1 { 0%,100%{transform:scale(1);opacity:.3} 50%{transform:scale(1.09);opacity:.7} }
        @keyframes j-ring2 { 0%,100%{transform:scale(1);opacity:.15} 50%{transform:scale(1.14);opacity:.55} }
        @keyframes j-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes j-bar   { from{transform:scaleY(.3)} to{transform:scaleY(1.5)} }
        @keyframes j-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.75)} }
        @keyframes j-dot   { 0%,80%,100%{opacity:.2;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  );
}

// ─── Thinking dots ─────────────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '4px 0' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%', background: '#DAFF01',
          animation: `j-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ─── Bubble ────────────────────────────────────────────────────────────────────
function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
      <div style={{
        maxWidth: '80%', padding: '12px 16px',
        borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
        background: isUser ? '#DAFF01' : '#141414',
        boxShadow: isUser ? 'none' : 'rgba(255,255,255,0.06) 0 0 0 1px inset',
        color: isUser ? '#000' : '#fff',
        fontSize: '0.9rem', lineHeight: 1.55, letterSpacing: '-0.011em',
        whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function JarvisPage() {
  const router = useRouter();
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [context, setContext]     = useState<Record<string, unknown> | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Load context + boot message
  useEffect(() => {
    (async () => {
      try {
        const today = todayISO();
        const week  = getCurrentTrainingWeek();
        const [profile, habits, completions, macros, sessions, plan, weights, score] = await Promise.all([
          getProfile(), getHabits(), getHabitCompletions(today), getTodayMacros(),
          getTrainingSessions(week), getTrainingWeek(week), getWeightHistory(7), getDailyScore(today),
        ]);
        const doneIds = new Set(completions.filter(c => c.completed_at).map(c => c.habit_id));
        setContext({
          date: new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' }),
          score: score?.total_score ?? 0,
          calories: Math.round(macros?.calories ?? 0),
          calorieTarget: profile?.calorie_target ?? 2000,
          protein: Math.round(macros?.protein ?? 0),
          proteinTarget: profile?.macro_targets?.protein ?? 150,
          habitsDone: habits.filter(h => doneIds.has(h.id)).length,
          habitsTotal: habits.length,
          workoutDone: sessions.some(s => s.session_type === 'strength'),
          weight: weights[0]?.weight_kg ?? null,
          trainingWeek: week,
          trainingPhase: plan?.phase ?? null,
          sessionsDone: sessions.length,
        });
        const s = score?.total_score ?? 0;
        const bootMsg = `Systems online. Score at ${s} — ${s >= 75 ? 'strong start' : s >= 50 ? 'room to push' : 'let\'s get moving'}. What do you need?`;
        setMessages([{ id: 'init', role: 'assistant', content: bootMsg }]);
        if (ttsEnabled) setTimeout(() => speak(bootMsg), 600);
      } catch {
        setMessages([{ id: 'init', role: 'assistant', content: 'Jarvis online. What do you need?' }]);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    haptic('light');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/jarvis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })), context }),
      });
      if (!res.ok) throw new Error('API error');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      const aid = Date.now() + '-a';
      setMessages(prev => [...prev, { id: aid, role: 'assistant', content: '' }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantText += decoder.decode(value, { stream: true });
          setMessages(prev => prev.map(m => m.id === aid ? { ...m, content: assistantText } : m));
        }
      }
      if (ttsEnabled && assistantText) speak(assistantText);
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Connection issue. Try again.' }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [messages, context, loading, ttsEnabled]);

  const { listening, toggle: toggleMic, supported: micSupported } = useVoice(sendMessage);

  const PROMPTS = [
    "What should I focus on today?",
    "How's my nutrition looking?",
    "Am I on track this week?",
    "What's my training plan today?",
  ];

  return (
    <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4,
          }}>←</button>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: '#0A0A0A',
              boxShadow: 'rgba(218,255,1,0.35) 0 0 0 1px inset',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, color: '#DAFF01',
            }}>⬡</div>
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 8, height: 8, borderRadius: '50%',
              background: loading ? 'rgba(218,255,1,0.5)' : '#DAFF01',
              boxShadow: '0 0 6px #DAFF01', border: '2px solid #000',
              animation: loading ? 'j-pulse 1s ease infinite' : 'none',
            }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, letterSpacing: '-0.011em', color: '#fff' }}>JARVIS</p>
            <p style={{ margin: 0, fontSize: '0.5rem', letterSpacing: '0.08em', color: loading ? '#DAFF01' : 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', transition: 'color 0.3s' }}>
              {loading ? 'THINKING…' : listening ? 'LISTENING…' : 'ONLINE'}
            </p>
          </div>
        </div>
        {/* Voice output toggle */}
        <button onClick={() => setTtsEnabled(v => !v)} style={{
          background: ttsEnabled ? 'rgba(218,255,1,0.08)' : '#0A0A0A',
          border: `1px solid ${ttsEnabled ? 'rgba(218,255,1,0.3)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 99, padding: '6px 14px',
          fontSize: '0.55rem', letterSpacing: '0.08em',
          color: ttsEnabled ? '#DAFF01' : 'rgba(255,255,255,0.3)',
          cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 510,
          transition: 'all 0.2s',
        }}>
          {ttsEnabled ? '◉ SPEAK' : '○ MUTE'}
        </button>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '80px 20px 260px', display: 'flex', flexDirection: 'column' }}>
        <JarvisAvatar loading={loading} listening={listening} />

        {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}

        {loading && messages[messages.length - 1]?.role === 'user' && (
          <div style={{ display: 'flex', marginBottom: 12 }}>
            <div style={{ padding: '12px 16px', borderRadius: '20px 20px 20px 4px', background: '#141414', boxShadow: 'rgba(255,255,255,0.06) 0 0 0 1px inset' }}>
              <ThinkingDots />
            </div>
          </div>
        )}

        {messages.length === 1 && !loading && (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: '0.5rem', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>SUGGESTED</p>
            {PROMPTS.map(p => (
              <button key={p} onClick={() => sendMessage(p)} style={{
                background: '#0A0A0A', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 'var(--r)', padding: '12px 16px',
                color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem',
                letterSpacing: '-0.011em', cursor: 'pointer',
                textAlign: 'left', fontFamily: 'var(--font)',
                WebkitTapHighlightColor: 'transparent',
              }}>{p}</button>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 400,
        background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '12px 16px',
        paddingBottom: 'max(96px, calc(env(safe-area-inset-bottom) + 84px))',
      }}>
        <form onSubmit={e => { e.preventDefault(); sendMessage(input); }}
          style={{ display: 'flex', gap: 10, alignItems: 'center' }}>

          {/* Mic — tap to toggle */}
          {micSupported && (
            <button type="button" onClick={() => { haptic('light'); toggleMic(); }} style={{
              flexShrink: 0, width: 46, height: 46, borderRadius: '50%',
              background: listening ? '#DAFF01' : '#141414',
              border: listening ? 'none' : '1px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 19,
              boxShadow: listening ? '0 0 24px rgba(218,255,1,0.5)' : 'none',
              transition: 'all 0.2s',
              WebkitTapHighlightColor: 'transparent',
              color: listening ? '#000' : 'rgba(255,255,255,0.45)',
            }}>
              🎙
            </button>
          )}

          {/* Text input */}
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={listening ? 'Listening — tap mic to stop…' : 'Ask Jarvis…'}
            disabled={loading || listening}
            style={{
              flex: 1, background: '#141414',
              border: `1px solid ${listening ? 'rgba(218,255,1,0.3)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 22, padding: '12px 18px',
              color: '#fff', fontSize: '0.9rem', fontFamily: 'var(--font)',
              outline: 'none', letterSpacing: '-0.011em', transition: 'border 0.2s',
            }}
          />

          {/* Send */}
          <button type="submit" disabled={!input.trim() || loading} style={{
            flexShrink: 0, width: 46, height: 46, borderRadius: '50%',
            background: input.trim() && !loading ? '#DAFF01' : '#141414',
            border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, transition: 'all 0.15s',
            color: input.trim() && !loading ? '#000' : 'rgba(255,255,255,0.2)',
            WebkitTapHighlightColor: 'transparent',
          }}>↑</button>
        </form>
      </div>
    </div>
  );
}
