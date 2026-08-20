'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getProfile, getHabits, getHabitCompletions, getTodayMacros,
  getTrainingSessions, getCurrentTrainingWeek, getTrainingWeek,
  getWeightHistory, getDailyScore, todayISO,
} from '@/lib/db';
import { haptic } from '@/lib/haptic';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ─── Voice hook ───────────────────────────────────────────────────────────────
function useVoice(onResult: (text: string) => void) {
  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const supported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const start = useCallback(() => {
    if (!supported) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      onResult(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [supported, onResult]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, start, stop, supported };
}

// ─── TTS ──────────────────────────────────────────────────────────────────────
function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 1.05;
  utt.pitch = 0.9;
  utt.volume = 1;
  // Pick a deep voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.name.includes('Daniel') || v.name.includes('Alex') || v.name.includes('Google UK') || v.lang === 'en-GB'
  );
  if (preferred) utt.voice = preferred;
  window.speechSynthesis.speak(utt);
}

// ─── Thinking dots ────────────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#DAFF01',
          animation: `jarvis-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes jarvis-dot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12,
    }}>
      <div style={{
        maxWidth: '80%',
        padding: '12px 16px',
        borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
        background: isUser ? '#DAFF01' : '#141414',
        boxShadow: isUser ? 'none' : 'rgba(255,255,255,0.06) 0px 0px 0px 1px inset',
        color: isUser ? '#000000' : '#ffffff',
        fontSize: '0.9rem',
        lineHeight: 1.55,
        letterSpacing: '-0.011em',
        whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function JarvisPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<Record<string, unknown> | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load context on mount
  useEffect(() => {
    (async () => {
      try {
        const today = todayISO();
        const week = getCurrentTrainingWeek();
        const [profile, habits, completions, macros, trainingSessions, plan, weightHistory, score] = await Promise.all([
          getProfile(),
          getHabits(),
          getHabitCompletions(today),
          getTodayMacros(),
          getTrainingSessions(week),
          getTrainingWeek(week),
          getWeightHistory(7),
          getDailyScore(today),
        ]);

        const completedIds = new Set(completions.filter(c => c.completed_at).map(c => c.habit_id));
        const habitsDone = habits.filter(h => completedIds.has(h.id)).length;

        setContext({
          date: new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' }),
          score: score?.total_score ?? 0,
          calories: Math.round(macros?.calories ?? 0),
          calorieTarget: profile?.calorie_target ?? 2000,
          protein: Math.round(macros?.protein ?? 0),
          proteinTarget: profile?.macro_targets?.protein ?? 150,
          habitsDone,
          habitsTotal: habits.length,
          workoutDone: trainingSessions.some(s => s.session_type === 'strength'),
          meditationDone: false,
          weight: weightHistory[0]?.weight_kg ?? null,
          trainingWeek: week,
          trainingPhase: plan?.phase ?? null,
          sessionsDone: trainingSessions.length,
        });

        // Opening message
        setMessages([{
          id: 'init',
          role: 'assistant',
          content: `Systems online. Score sitting at ${score?.total_score ?? 0} — what do you need?`,
        }]);
      } catch {
        setMessages([{
          id: 'init',
          role: 'assistant',
          content: `Jarvis online. What do you need?`,
        }]);
      }
    })();
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    haptic('light');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/jarvis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          context,
        }),
      });

      if (!res.ok) throw new Error('API error');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      const assistantId = Date.now().toString() + '-a';

      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // Parse Vercel AI SDK data stream format
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('0:')) {
              try {
                const text = JSON.parse(line.slice(2));
                assistantText += text;
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: assistantText } : m
                ));
              } catch {}
            }
          }
        }
      }

      if (ttsEnabled && assistantText) speak(assistantText);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Connection issue. Try again.',
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [messages, context, loading, ttsEnabled]);

  const { listening, start: startVoice, stop: stopVoice, supported: voiceSupported } = useVoice((text) => {
    sendMessage(text);
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Suggested prompts
  const PROMPTS = [
    'What should I focus on today?',
    'How\'s my nutrition looking?',
    'Am I on track this week?',
    'What\'s my training plan today?',
  ];

  return (
    <div style={{ minHeight: '100dvh', background: '#000000', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '4px',
          }}>←</button>
          {/* Jarvis avatar — animated lime dot */}
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: '#0A0A0A',
              boxShadow: 'rgba(218,255,1,0.3) 0px 0px 0px 1px inset',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>
              ⬡
            </div>
            <div style={{
              position: 'absolute', bottom: 1, right: 1,
              width: 8, height: 8, borderRadius: '50%',
              background: loading ? 'rgba(218,255,1,0.5)' : '#DAFF01',
              boxShadow: loading ? '0 0 8px #DAFF01' : '0 0 4px #DAFF01',
              transition: 'all 0.3s',
              animation: loading ? 'jarvis-pulse 1s ease infinite' : 'none',
            }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, letterSpacing: '-0.011em', color: '#ffffff' }}>
              JARVIS
            </p>
            <p style={{ margin: 0, fontSize: '0.55rem', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>
              {loading ? 'THINKING…' : 'ONLINE'}
            </p>
          </div>
        </div>
        {/* TTS toggle */}
        <button onClick={() => setTtsEnabled(v => !v)} style={{
          background: ttsEnabled ? 'rgba(218,255,1,0.1)' : 'var(--surface)',
          border: `1px solid ${ttsEnabled ? 'rgba(218,255,1,0.3)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 'var(--r-sm)', padding: '0.35rem 0.75rem',
          fontSize: '0.55rem', letterSpacing: '0.08em',
          color: ttsEnabled ? '#DAFF01' : 'rgba(255,255,255,0.3)',
          cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 510,
        }}>
          {ttsEnabled ? '◉ VOICE' : '○ VOICE'}
        </button>
      </div>

      {/* ── Messages ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '80px 20px 160px',
        display: 'flex', flexDirection: 'column',
      }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <ThinkingDots />
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)' }}>BOOTING…</p>
          </div>
        )}

        {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}
        {loading && messages[messages.length - 1]?.role === 'user' && (
          <div style={{ display: 'flex', marginBottom: 12 }}>
            <div style={{
              padding: '12px 16px', borderRadius: '20px 20px 20px 4px',
              background: '#141414', boxShadow: 'rgba(255,255,255,0.06) 0px 0px 0px 1px inset',
            }}>
              <ThinkingDots />
            </div>
          </div>
        )}

        {/* Suggested prompts — only show at start */}
        {messages.length === 1 && !loading && (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: '0.55rem', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
              SUGGESTED
            </p>
            {PROMPTS.map(p => (
              <button key={p} onClick={() => sendMessage(p)} style={{
                background: '#0A0A0A', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 'var(--r)', padding: '12px 16px',
                color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem',
                letterSpacing: '-0.011em', cursor: 'pointer',
                textAlign: 'left', fontFamily: 'var(--font)',
                WebkitTapHighlightColor: 'transparent',
              }}>
                {p}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(0,0,0,0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '12px 16px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Voice button */}
          {voiceSupported && (
            <button
              type="button"
              onPointerDown={startVoice}
              onPointerUp={stopVoice}
              style={{
                flexShrink: 0, width: 44, height: 44, borderRadius: '50%',
                background: listening ? '#DAFF01' : '#141414',
                border: listening ? 'none' : '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 18,
                boxShadow: listening ? '0 0 20px rgba(218,255,1,0.4)' : 'none',
                transition: 'all 0.15s',
                WebkitTapHighlightColor: 'transparent',
                color: listening ? '#000' : 'rgba(255,255,255,0.4)',
              }}
            >
              🎙
            </button>
          )}

          {/* Text input */}
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={listening ? 'Listening…' : 'Ask Jarvis…'}
            disabled={loading || listening}
            style={{
              flex: 1, background: '#141414',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 22, padding: '12px 18px',
              color: '#ffffff', fontSize: '0.9rem', fontFamily: 'var(--font)',
              outline: 'none', letterSpacing: '-0.011em',
            }}
          />

          {/* Send button */}
          <button type="submit" disabled={!input.trim() || loading} style={{
            flexShrink: 0, width: 44, height: 44, borderRadius: '50%',
            background: input.trim() && !loading ? '#DAFF01' : '#141414',
            border: 'none', cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, transition: 'all 0.15s',
            color: input.trim() && !loading ? '#000' : 'rgba(255,255,255,0.2)',
            WebkitTapHighlightColor: 'transparent',
          }}>
            ↑
          </button>
        </form>
      </div>

      <style>{`
        @keyframes jarvis-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
