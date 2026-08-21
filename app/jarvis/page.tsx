'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getProfile, getHabits, getHabitCompletions, getTodayMacros,
  getTrainingSessions, getCurrentTrainingWeek, getTrainingWeek,
  getWeightHistory, getDailyScore, getDailyScores, getMealLogs,
  getHabitStreaks, getInsights, getLiftSetup, calcPrescribedWeight,
  toggleHabitCompletion, logWeight, addWorkoutLog, addHabit, deactivateHabit, renameHabit, todayISO,
} from '@/lib/db';
import { haptic } from '@/lib/haptic';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCall?: { action: string; [key: string]: unknown };
}

type VoiceKey = 'daniel' | 'george' | 'brian' | 'eric' | 'adam' | 'browser';

const VOICE_OPTIONS: { key: VoiceKey; name: string; desc: string }[] = [
  { key: 'daniel', name: 'Daniel', desc: 'British · Formal' },
  { key: 'george', name: 'George', desc: 'British · Warm' },
  { key: 'brian',  name: 'Brian',  desc: 'American · Deep' },
  { key: 'eric',   name: 'Eric',   desc: 'American · Smooth' },
  { key: 'adam',   name: 'Adam',   desc: 'American · Dominant' },
  { key: 'browser', name: 'Browser', desc: 'Built-in · Free' },
];

const STORAGE_KEY_VOICE   = 'jarvis_voice';
const STORAGE_KEY_HISTORY = 'jarvis_history';
const MAX_HISTORY         = 20; // messages to persist

// ─── ElevenLabs TTS ────────────────────────────────────────────────────────────
async function speakElevenLabs(text: string, voice: VoiceKey): Promise<HTMLAudioElement | null> {
  try {
    const res = await fetch('/api/jarvis/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: stripMarkdown(text), voice }),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
    return audio;
  } catch { return null; }
}

// ─── Browser TTS fallback ──────────────────────────────────────────────────────
function speakBrowser(text: string): SpeechSynthesisUtterance | null {
  if (!('speechSynthesis' in window)) return null;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(stripMarkdown(text));
  utt.rate = 1.0; utt.pitch = 0.85; utt.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find(v => v.name.includes('Daniel')) ||
    voices.find(v => v.name.includes('Aaron'))  ||
    voices.find(v => v.lang === 'en-GB')        ||
    voices.find(v => v.lang.startsWith('en'));
  if (preferred) utt.voice = preferred;
  const doSpeak = () => window.speechSynthesis.speak(utt);
  voices.length > 0 ? doSpeak() : (window.speechSynthesis.onvoiceschanged = doSpeak);
  return utt;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

// ─── Voice input ───────────────────────────────────────────────────────────────
function useVoice(onResult: (text: string) => void) {
  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const toggle = useCallback(() => {
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    if (!supported) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false; rec.lang = 'en-US';
    rec.onresult = (e: any) => { setListening(false); onResult(e.results[0][0].transcript); };
    rec.onend  = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec; rec.start(); setListening(true);
  }, [listening, supported, onResult]);

  return { listening, toggle, supported };
}

// ─── Avatar ────────────────────────────────────────────────────────────────────
function JarvisAvatar({ loading, listening }: { loading: boolean; listening: boolean }) {
  const active = loading || listening;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0 28px' }}>
      <div style={{ position: 'relative', width: 160, height: 160 }}>
        <div style={{ position: 'absolute', inset: -14, borderRadius: '50%', border: '1px solid rgba(218,255,1,0.12)', animation: active ? 'j-ring1 2s ease-in-out infinite' : 'none' }} />
        <div style={{ position: 'absolute', inset: -6, borderRadius: '50%', border: '1.5px solid rgba(218,255,1,0.25)', animation: active ? 'j-ring2 2s ease-in-out 0.35s infinite' : 'none' }} />
        <div style={{ width: 160, height: 160, borderRadius: '50%', overflow: 'hidden', boxShadow: active ? 'rgba(218,255,1,0.7) 0 0 0 2px, rgba(218,255,1,0.3) 0 0 60px' : 'rgba(218,255,1,0.3) 0 0 0 2px, rgba(218,255,1,0.08) 0 0 30px', transition: 'box-shadow 0.4s', position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/jarvis-avatar.jpg" alt="Jarvis" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: active ? 'brightness(1.15) contrast(1.1)' : 'brightness(0.9) contrast(1.05)', transition: 'filter 0.4s' }} />
          <div style={{ position: 'absolute', inset: 0, background: active ? 'rgba(218,255,1,0.07)' : 'transparent', transition: 'background 0.4s' }} />
          {listening && (
            <div style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 3, alignItems: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: 99, padding: '4px 10px' }}>
              {[2,3,5,7,5,3,2].map((h, i) => (
                <div key={i} style={{ width: 3, height: h * 3, background: '#DAFF01', borderRadius: 2, animation: `j-bar 0.65s ease-in-out ${i * 0.09}s infinite alternate` }} />
              ))}
            </div>
          )}
        </div>
        <div style={{ position: 'absolute', bottom: 6, right: 6, width: 16, height: 16, borderRadius: '50%', background: '#DAFF01', boxShadow: '0 0 12px #DAFF01', border: '3px solid #000', animation: active ? 'j-pulse 1s ease infinite' : 'none' }} />
      </div>
      <p style={{ margin: '18px 0 5px', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.18em', color: '#fff', fontFamily: 'var(--font-mono)' }}>JARVIS</p>
      <p style={{ margin: 0, fontSize: '0.55rem', letterSpacing: '0.1em', color: active ? '#DAFF01' : 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-mono)', transition: 'color 0.3s' }}>
        {loading ? 'PROCESSING…' : listening ? 'LISTENING…' : 'ONLINE'}
      </p>
      <style>{`
        @keyframes j-ring1 { 0%,100%{transform:scale(1);opacity:.25} 50%{transform:scale(1.08);opacity:.65} }
        @keyframes j-ring2 { 0%,100%{transform:scale(1);opacity:.15} 50%{transform:scale(1.13);opacity:.5} }
        @keyframes j-bar   { from{transform:scaleY(.3)} to{transform:scaleY(1.6)} }
        @keyframes j-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.7)} }
        @keyframes j-dot   { 0%,80%,100%{opacity:.2;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }
        @keyframes j-fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '4px 0' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#DAFF01', animation: `j-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </div>
  );
}

// ─── Tool action confirmation card ─────────────────────────────────────────────
function ToolCard({ toolCall, onExecute }: { toolCall: Message['toolCall']; onExecute: (tc: Message['toolCall']) => void }) {
  const [done, setDone] = useState(false);
  if (!toolCall) return null;
  const labels: Record<string, string> = {
    logWeight:    '⚖️ Log Weight',
    completeHabit:'✅ Mark Habit Done',
    logFood:      '🍽 Log Food',
    logWorkout:   '💪 Log Workout',
    createHabit:  '➕ Create Habit',
    deleteHabit:  '🗑 Remove Habit',
    renameHabit:  '✏️ Rename Habit',
  };
  const label = labels[toolCall.action] ?? toolCall.action;
  let detail = '';
  if (toolCall.action === 'logWeight') detail = `${toolCall.weight_kg}kg`;
  if (toolCall.action === 'completeHabit') detail = toolCall.habit_name as string;
  if (toolCall.action === 'logFood') detail = `${toolCall.food_name} · ${toolCall.meal_type}`;
  if (toolCall.action === 'logWorkout') detail = `${toolCall.name} · ${toolCall.duration_min}min`;
  if (toolCall.action === 'createHabit') detail = toolCall.name as string;
  if (toolCall.action === 'deleteHabit') detail = toolCall.habit_name as string;
  if (toolCall.action === 'renameHabit') detail = `${toolCall.old_name} → ${toolCall.new_name}`;

  if (done) return (
    <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(218,255,1,0.06)', border: '1px solid rgba(218,255,1,0.2)', margin: '4px 0', animation: 'j-fadein 0.3s ease', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: '#DAFF01', fontSize: '0.75rem' }}>✓ {label} — {detail}</span>
    </div>
  );

  return (
    <div style={{ padding: '10px 14px', borderRadius: 12, background: '#0D0D0D', border: '1px solid rgba(255,255,255,0.08)', margin: '4px 0', animation: 'j-fadein 0.3s ease' }}>
      <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>ACTION PENDING</p>
      <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#fff' }}>{label}: <span style={{ color: '#DAFF01' }}>{detail}</span></p>
      <button onClick={() => { setDone(true); onExecute(toolCall); }} style={{ background: '#DAFF01', border: 'none', borderRadius: 8, padding: '7px 16px', color: '#000', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', letterSpacing: '-0.01em' }}>Confirm</button>
    </div>
  );
}

// ─── Bubble ────────────────────────────────────────────────────────────────────
function Bubble({
  msg, ttsEnabled, voice, onExecute,
}: {
  msg: Message;
  ttsEnabled: boolean;
  voice: VoiceKey;
  onExecute: (tc: Message['toolCall']) => void;
}) {
  const isUser = msg.role === 'user';
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleTap = async () => {
    if (isUser || !ttsEnabled || !msg.content) return;
    if (speaking) {
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    if (voice === 'browser') {
      const utt = speakBrowser(msg.content);
      if (utt) utt.onend = () => setSpeaking(false);
      else setSpeaking(false);
    } else {
      const audio = await speakElevenLabs(msg.content, voice);
      if (audio) {
        audioRef.current = audio;
        audio.onended = () => setSpeaking(false);
        audio.onerror = () => setSpeaking(false);
      } else { setSpeaking(false); }
    }
  };

  return (
    <div style={{ animation: 'j-fadein 0.25s ease' }}>
      <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: msg.toolCall ? 4 : 12 }}>
        <div onClick={handleTap} style={{ maxWidth: '80%', padding: '12px 16px', borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px', background: isUser ? '#DAFF01' : speaking ? '#1a1a1a' : '#141414', boxShadow: isUser ? 'none' : speaking ? 'rgba(218,255,1,0.4) 0 0 0 1px inset' : 'rgba(255,255,255,0.06) 0 0 0 1px inset', color: isUser ? '#000' : '#fff', fontSize: '0.9rem', lineHeight: 1.55, letterSpacing: '-0.011em', whiteSpace: 'pre-wrap', cursor: isUser ? 'default' : 'pointer', transition: 'box-shadow 0.2s', WebkitTapHighlightColor: 'transparent' }}>
          {msg.content}
          {!isUser && msg.content && (
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              {speaking ? (
                <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  {[1,2,3,2,1].map((h, i) => (
                    <div key={i} style={{ width: 2, height: h * 3, background: '#DAFF01', borderRadius: 1, animation: `j-bar 0.6s ease-in-out ${i * 0.1}s infinite alternate` }} />
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>TAP TO SPEAK</span>
              )}
            </div>
          )}
        </div>
      </div>
      {msg.toolCall && <ToolCard toolCall={msg.toolCall} onExecute={onExecute} />}
    </div>
  );
}

// ─── Voice picker modal ─────────────────────────────────────────────────────────
function VoicePicker({ voice, onSelect, onClose }: { voice: VoiceKey; onSelect: (v: VoiceKey) => void; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0D0D0D', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '28px 20px 48px', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none' }}>
        <p style={{ margin: '0 0 6px', fontSize: '0.55rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>SELECT VOICE</p>
        <p style={{ margin: '0 0 20px', fontSize: '1rem', fontWeight: 600, color: '#fff' }}>Jarvis Voice</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {VOICE_OPTIONS.map(v => (
            <button key={v.key} onClick={() => { onSelect(v.key); onClose(); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 14, background: voice === v.key ? 'rgba(218,255,1,0.08)' : '#141414', border: `1px solid ${voice === v.key ? 'rgba(218,255,1,0.35)' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
              <div style={{ textAlign: 'left' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: voice === v.key ? '#DAFF01' : '#fff', fontFamily: 'var(--font)' }}>{v.name}</p>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>{v.desc}</p>
              </div>
              {voice === v.key && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#DAFF01', boxShadow: '0 0 8px #DAFF01' }} />}
            </button>
          ))}
        </div>
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
  const [voice, setVoice]         = useState<VoiceKey>('daniel');
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Load saved voice preference
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_VOICE) as VoiceKey | null;
    if (saved) setVoice(saved);
  }, []);

  // Load context + history + boot message
  useEffect(() => {
    (async () => {
      try {
        // Restore conversation history
        const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
        const history: Message[] = saved ? JSON.parse(saved) : [];

        const today = todayISO();
        const week  = getCurrentTrainingWeek();

        const [
          profile, habits, completions, macros, sessions, plan,
          weights, score, scoreHistory, mealLogs, insights, liftSetup,
        ] = await Promise.all([
          getProfile(),
          getHabits(),
          getHabitCompletions(today),
          getTodayMacros(),
          getTrainingSessions(week),
          getTrainingWeek(week),
          getWeightHistory(7),
          getDailyScore(today),
          getDailyScores(7),
          getMealLogs(today),
          getInsights(),
          getLiftSetup(),
        ]);

        const doneIds = new Set(completions.filter(c => c.completed_at).map(c => c.habit_id));
        const activeHabits = habits.filter(h => h.active);
        const streaks = await getHabitStreaks(activeHabits.map(h => h.id));

        // Prescribed lifts
        const prescribedLifts = plan ? liftSetup.map(l => ({
          lift: l.lift,
          weight: calcPrescribedWeight(l, plan),
          sets: 4,
          reps: plan.phase === 'Base' ? '5' : '3–5',
        })) : [];

        const ctx = {
          date: new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' }),
          score: score?.total_score ?? 0,
          calories: Math.round(macros?.calories ?? 0),
          calorieTarget: profile?.calorie_target ?? 2000,
          protein: Math.round(macros?.protein ?? 0),
          proteinTarget: profile?.macro_targets?.protein ?? 150,
          carbs: Math.round(macros?.carbs ?? 0),
          carbTarget: profile?.macro_targets?.carbs ?? 200,
          fat: Math.round(macros?.fat ?? 0),
          fatTarget: profile?.macro_targets?.fat ?? 65,
          habitsDone: activeHabits.filter(h => doneIds.has(h.id)).length,
          habitsTotal: activeHabits.length,
          habits: activeHabits.map(h => ({
            id: h.id,
            name: h.name,
            done: doneIds.has(h.id),
            streak: streaks.get(h.id) ?? 0,
          })),
          workoutDone: sessions.some(s => s.session_type === 'strength'),
          meditationDone: false, // fetched separately if needed
          weight: weights[0]?.weight_kg ?? null,
          weightTrend: weights,
          trainingWeek: week,
          trainingPhase: plan?.phase ?? null,
          sessionsDone: sessions.length,
          prescribedLifts,
          meals: mealLogs.map(l => ({
            meal_type: l.meal_type,
            name: l.food?.name ?? 'Unknown',
            calories: l.food ? l.food.calories * (l.quantity / l.food.serving_size) : 0,
            protein:  l.food ? l.food.protein  * (l.quantity / l.food.serving_size) : 0,
          })),
          scoreHistory,
          insights,
        };
        setContext(ctx);

        if (history.length > 0) {
          setMessages(history);
        } else {
          const s = score?.total_score ?? 0;
          const bootMsg = `Systems online. Score sitting at ${s} — ${s >= 75 ? 'solid start, let\'s keep the momentum' : s >= 50 ? 'room to push today' : 'we\'ve got work to do'}. What do you need?`;
          const initMsg: Message = { id: 'init', role: 'assistant', content: bootMsg };
          setMessages([initMsg]);
          const voicePref = (localStorage.getItem(STORAGE_KEY_VOICE) as VoiceKey) ?? 'daniel';
          if (ttsEnabled) {
            setTimeout(async () => {
              if (voicePref === 'browser') { speakBrowser(bootMsg); }
              else { const a = await speakElevenLabs(bootMsg, voicePref); if (a) currentAudioRef.current = a; }
            }, 600);
          }
        }
      } catch (e) {
        console.error('Context load failed:', e);
        setMessages([{ id: 'init', role: 'assistant', content: 'Jarvis online. What do you need?' }]);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Persist messages to localStorage
  useEffect(() => {
    if (messages.length > 1) {
      const toSave = messages.slice(-MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(toSave));
    }
  }, [messages]);

  // Execute confirmed tool actions
  const executeToolAction = useCallback(async (toolCall: Message['toolCall']) => {
    if (!toolCall || !context) return;
    try {
      if (toolCall.action === 'logWeight') {
        await logWeight(toolCall.weight_kg as number, toolCall.note as string | undefined);
      } else if (toolCall.action === 'completeHabit') {
        await toggleHabitCompletion(toolCall.habit_id as number);
      } else if (toolCall.action === 'createHabit') {
        await addHabit({
          name: toolCall.name as string,
          active: true,
          stacked_after_habit_id: null,
          streak_freeze_available: 0,
          created_at: new Date().toISOString(),
        });
      } else if (toolCall.action === 'deleteHabit') {
        await deactivateHabit(toolCall.habit_id as number);
      } else if (toolCall.action === 'renameHabit') {
        await renameHabit(toolCall.habit_id as number, toolCall.new_name as string);
      } else if (toolCall.action === 'logWorkout') {
        await addWorkoutLog({
          date: todayISO(),
          template_id: null,
          name: toolCall.name as string,
          duration_min: toolCall.duration_min as number,
          intensity: (toolCall.intensity as 'low' | 'moderate' | 'high') ?? 'high',
          calories_burned: null,
          source: 'manual',
          logged_at: new Date().toISOString(),
        });
      }
      // logFood requires food item lookup — show a note for now
    } catch (e) {
      console.error('Tool action failed:', e);
    }
  }, [context]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    haptic('light');

    // Stop any playing audio
    currentAudioRef.current?.pause();
    window.speechSynthesis?.cancel();

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/jarvis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          context,
        }),
      });
      if (!res.ok) throw new Error('API error');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let toolCallData: Message['toolCall'] | undefined;
      const aid = Date.now() + '-a';
      setMessages(prev => [...prev, { id: aid, role: 'assistant', content: '' }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          // Detect tool calls embedded in stream (simple JSON marker)
          if (chunk.includes('"action":')) {
            try {
              const tc = JSON.parse(chunk);
              if (tc.action) { toolCallData = tc; continue; }
            } catch { /* not JSON */ }
          }

          assistantText += chunk;
          setMessages(prev => prev.map(m => m.id === aid ? { ...m, content: assistantText } : m));
        }
      }

      // Update with final toolCall if any
      setMessages(prev => prev.map(m => m.id === aid ? { ...m, content: assistantText, toolCall: toolCallData } : m));

      // Speak response
      if (ttsEnabled && assistantText) {
        const currentVoice = (localStorage.getItem(STORAGE_KEY_VOICE) as VoiceKey) ?? 'daniel';
        if (currentVoice === 'browser') {
          speakBrowser(assistantText);
        } else {
          const a = await speakElevenLabs(assistantText, currentVoice);
          if (a) currentAudioRef.current = a;
        }
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Connection issue. Try again.' }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [messages, context, loading, ttsEnabled]);

  const handleVoiceSelect = (v: VoiceKey) => {
    setVoice(v);
    localStorage.setItem(STORAGE_KEY_VOICE, v);
  };

  const { listening, toggle: toggleMic, supported: micSupported } = useVoice(sendMessage);

  const PROMPTS = [
    'What should I focus on today?',
    "How's my nutrition looking?",
    'Am I on track this week?',
    "What's my training plan today?",
    'Give me a full status report.',
    'What habit is falling behind?',
  ];

  const clearHistory = () => {
    localStorage.removeItem(STORAGE_KEY_HISTORY);
    window.location.reload();
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>←</button>
          <div style={{ position: 'relative' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#0A0A0A', boxShadow: 'rgba(218,255,1,0.35) 0 0 0 1px inset', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: '#DAFF01' }}>⬡</div>
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: loading ? 'rgba(218,255,1,0.5)' : '#DAFF01', boxShadow: '0 0 6px #DAFF01', border: '2px solid #000', animation: loading ? 'j-pulse 1s ease infinite' : 'none' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, letterSpacing: '-0.011em', color: '#fff' }}>JARVIS</p>
            <p style={{ margin: 0, fontSize: '0.5rem', letterSpacing: '0.08em', color: loading ? '#DAFF01' : 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', transition: 'color 0.3s' }}>
              {loading ? 'THINKING…' : listening ? 'LISTENING…' : 'ONLINE'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Voice picker button */}
          <button onClick={() => setShowVoicePicker(true)} style={{ background: '#0A0A0A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 99, padding: '6px 12px', fontSize: '0.55rem', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
            {VOICE_OPTIONS.find(v => v.key === voice)?.name?.toUpperCase() ?? 'VOICE'}
          </button>
          {/* TTS toggle */}
          <button onClick={() => setTtsEnabled(v => !v)} style={{ background: ttsEnabled ? 'rgba(218,255,1,0.08)' : '#0A0A0A', border: `1px solid ${ttsEnabled ? 'rgba(218,255,1,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 99, padding: '6px 12px', fontSize: '0.55rem', letterSpacing: '0.06em', color: ttsEnabled ? '#DAFF01' : 'rgba(255,255,255,0.3)', cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 510, transition: 'all 0.2s' }}>
            {ttsEnabled ? '◉ ON' : '○ OFF'}
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '80px 20px 260px', display: 'flex', flexDirection: 'column' }}>
        <JarvisAvatar loading={loading} listening={listening} />

        {messages.map(msg => (
          <Bubble key={msg.id} msg={msg} ttsEnabled={ttsEnabled} voice={voice} onExecute={executeToolAction} />
        ))}

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
              <button key={p} onClick={() => sendMessage(p)} style={{ background: '#0A0A0A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 'var(--r)', padding: '12px 16px', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', letterSpacing: '-0.011em', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', WebkitTapHighlightColor: 'transparent' }}>{p}</button>
            ))}
          </div>
        )}

        {messages.length > 4 && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button onClick={clearHistory} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>CLEAR HISTORY</button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 400, background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px', paddingBottom: 'max(96px, calc(env(safe-area-inset-bottom) + 84px))' }}>
        <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {micSupported && (
            <button type="button" onClick={() => { haptic('light'); toggleMic(); }} style={{ flexShrink: 0, width: 46, height: 46, borderRadius: '50%', background: listening ? '#DAFF01' : '#141414', border: listening ? 'none' : '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 19, boxShadow: listening ? '0 0 24px rgba(218,255,1,0.5)' : 'none', transition: 'all 0.2s', WebkitTapHighlightColor: 'transparent', color: listening ? '#000' : 'rgba(255,255,255,0.45)' }}>
              🎙
            </button>
          )}
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} placeholder={listening ? 'Listening — tap mic to stop…' : 'Ask Jarvis…'} disabled={loading || listening} style={{ flex: 1, background: '#141414', border: `1px solid ${listening ? 'rgba(218,255,1,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 22, padding: '12px 18px', color: '#fff', fontSize: '0.9rem', fontFamily: 'var(--font)', outline: 'none', letterSpacing: '-0.011em', transition: 'border 0.2s' }} />
          <button type="submit" disabled={!input.trim() || loading} style={{ flexShrink: 0, width: 46, height: 46, borderRadius: '50%', background: input.trim() && !loading ? '#DAFF01' : '#141414', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'all 0.15s', color: input.trim() && !loading ? '#000' : 'rgba(255,255,255,0.2)', WebkitTapHighlightColor: 'transparent' }}>↑</button>
        </form>
      </div>

      {showVoicePicker && <VoicePicker voice={voice} onSelect={handleVoiceSelect} onClose={() => setShowVoicePicker(false)} />}
    </div>
  );
}
