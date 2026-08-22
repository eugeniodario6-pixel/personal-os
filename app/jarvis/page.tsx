'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getProfile, getHabits, getHabitCompletions, getTodayMacros,
  getTrainingSessions, getCurrentTrainingWeek, getTrainingWeek,
  getWeightHistory, getDailyScore, getDailyScores, getMealLogs,
  getHabitStreaks, getInsights, getLiftSetup, calcPrescribedWeight,
  toggleHabitCompletion, logWeight, addWorkoutLog, addHabit,
  deactivateHabit, renameHabit, addFoodItem, addMealLog,
  addMeditationLog, getMeditationSessions, createTrainingSession,
  addStrengthSets, computeDailyScore, todayISO, getCurrentTrainingWeek as getWeek,
} from '@/lib/db';
import { haptic } from '@/lib/haptic';
import JarvisOrb from '@/components/JarvisOrb';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type VoiceKey = 'sarah' | 'browser';

const VOICE_OPTIONS: { key: VoiceKey; name: string; desc: string }[] = [
  { key: 'sarah',   name: 'Sarah',   desc: 'American · Soft' },
  { key: 'browser', name: 'Browser', desc: 'Built-in · Free' },
];

const STORAGE_KEY_VOICE   = 'jarvis_voice';
const STORAGE_KEY_HISTORY = 'jarvis_history';
const MAX_HISTORY         = 30;

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

// ─── TTS ──────────────────────────────────────────────────────────────────────
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1').replace(/#{1,6}\s/g, '')
    .replace(/\n+/g, ' ').trim();
}

async function speakElevenLabs(text: string, voice: VoiceKey, onEnd?: () => void): Promise<void> {
  try {
    const res = await fetch('/api/jarvis/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: stripMarkdown(text), voice }),
    });
    if (!res.ok) { onEnd?.(); return; }
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
  } catch { onEnd?.(); }
}

function speakBrowser(text: string, onEnd?: () => void): void {
  if (!('speechSynthesis' in window)) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(stripMarkdown(text));
  utt.rate = 1.0; utt.pitch = 0.85; utt.volume = 1;
  if (onEnd) utt.onend = onEnd;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.name.includes('Daniel')) || voices.find(v => v.lang === 'en-GB') || voices.find(v => v.lang.startsWith('en'));
  if (preferred) utt.voice = preferred;
  voices.length > 0 ? window.speechSynthesis.speak(utt) : (window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.speak(utt));
}

// ─── Voice input ───────────────────────────────────────────────────────────────
function useVoiceInput(onResult: (text: string) => void) {
  const recRef      = useRef<any>(null);
  const onResultRef = useRef(onResult);
  const listeningRef = useRef(false);
  const [listening, setListeningState] = useState(false);
  const supported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Always keep ref current — never stale inside recognition callback
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const setListening = (v: boolean) => { listeningRef.current = v; setListeningState(v); };

  const start = useCallback(() => {
    if (!supported || listeningRef.current) return;
    const SR  = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false; rec.lang = 'en-US';
    // Always calls latest sendMessage via ref — fixes stale closure conversation loop
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setListening(false);
      onResultRef.current(transcript);
    };
    rec.onend   = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  const stop   = useCallback(() => { recRef.current?.stop(); setListening(false); }, []);
  const toggle = useCallback(() => listeningRef.current ? stop() : start(), [start, stop]);

  return { listening, toggle, start, stop, supported };
}

// ─── Voice picker sheet ────────────────────────────────────────────────────────
function VoicePicker({ voice, onSelect, onClose }: { voice: VoiceKey; onSelect: (v: VoiceKey) => void; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0D0D0D', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '28px 20px 52px', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none' }}>
        <p style={{ margin: '0 0 4px', fontSize: '0.5rem', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)' }}>JARVIS VOICE</p>
        <p style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: 510, color: '#fff' }}>Select Voice</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {VOICE_OPTIONS.map(v => (
            <button key={v.key} onClick={() => { onSelect(v.key); onClose(); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 14, background: voice === v.key ? 'rgba(218,255,1,0.08)' : '#141414', border: `1px solid ${voice === v.key ? 'rgba(218,255,1,0.35)' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
              <div style={{ textAlign: 'left' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 510, color: voice === v.key ? '#DAFF01' : '#fff', fontFamily: 'var(--font)' }}>{v.name}</p>
                <p style={{ margin: 0, fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>{v.desc}</p>
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
  const [messages, setMessages]     = useState<Message[]>([]);
  const [loading, setLoading]       = useState(false);
  const [speaking, setSpeaking]     = useState(false);
  const [context, setContext]       = useState<Record<string, unknown> | null>(null);
  const [voice, setVoice]           = useState<VoiceKey>('sarah');
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [lastJarvisText, setLastJarvisText]   = useState('');
  const autoListenRef  = useRef(false);
  const startMicRef    = useRef<() => void>(() => {}); // always-current ref to mic start
  const messagesRef    = useRef<Message[]>([]);
  const contextRef     = useRef<Record<string, unknown> | null>(null);

  // Keep refs in sync for use inside callbacks
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { contextRef.current = context; }, [context]);

  // Load voice pref
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_VOICE) as VoiceKey | null;
    if (saved) setVoice(saved);
  }, []);

  // ── Execute tool actions immediately (no confirm) ─────────────────────────────
  const executeAction = useCallback(async (toolCall: Record<string, unknown>) => {
    const today = todayISO();
    try {
      switch (toolCall.action) {

        case 'logFood': {
          const foodId = await addFoodItem({
            external_id: null,
            name: toolCall.food_name as string,
            brand: null,
            barcode: null,
            serving_unit: 'g',
            serving_size: toolCall.quantity_g as number,
            calories: toolCall.calories as number,
            protein: toolCall.protein_g as number,
            carbs: toolCall.carbs_g as number,
            fat: toolCall.fat_g as number,
            is_favorite: false,
          });
          await addMealLog({
            date: today,
            meal_type: toolCall.meal_type as 'breakfast' | 'lunch' | 'dinner' | 'snack',
            food_item_id: foodId,
            quantity: toolCall.quantity_g as number,
            logged_at: new Date().toISOString(),
            source: 'manual',
          });
          // Recompute daily score so nutrition page + dashboard reflect the new food
          await computeDailyScore(today);
          break;
        }

        case 'logWeight':
          await logWeight(toolCall.weight_kg as number, toolCall.note as string | undefined);
          break;

        case 'completeHabit':
          await toggleHabitCompletion(toolCall.habit_id as number);
          break;

        case 'createHabit':
          await addHabit({ name: toolCall.name as string, active: true, stacked_after_habit_id: null, streak_freeze_available: 0, created_at: new Date().toISOString() });
          break;

        case 'deleteHabit':
          await deactivateHabit(toolCall.habit_id as number);
          break;

        case 'renameHabit':
          await renameHabit(toolCall.habit_id as number, toolCall.new_name as string);
          break;

        case 'logWorkout': {
          // Write to workout_log (dashboard + progress page reads this)
          await addWorkoutLog({
            date: today,
            template_id: null,
            name: toolCall.name as string,
            duration_min: toolCall.duration_min as number,
            intensity: (toolCall.intensity as 'low' | 'moderate' | 'high') ?? 'high',
            calories_burned: null,
            source: 'manual',
            logged_at: new Date().toISOString(),
          });
          // Also write to training_sessions (fitness plan page + workoutDone context flag reads this)
          try {
            await createTrainingSession({
              week: getWeek(),
              session_type: (toolCall.session_type as 'strength' | 'cardio' | 'boxing' | 'agility') ?? 'strength',
              date: today,
              rpe: null,
              notes: toolCall.name as string,
            });
          } catch (tsErr) {
            console.error('createTrainingSession failed:', JSON.stringify(tsErr));
          }
          break;
        }

        case 'logStrengthSession': {
          const week = getWeek();
          const lifts = (toolCall.lifts as Array<{ exercise: string; sets: number; reps: number; weight_kg: number }>) ?? [];
          // Build notes summary from lifts
          const liftSummary = lifts.length > 0
            ? lifts.map(l => `${l.exercise} ${l.sets}×${l.reps} @ ${l.weight_kg}kg`).join(', ')
            : (toolCall.session_notes as string | undefined) ?? 'Strength session';
          const sessionId = await createTrainingSession({
            week,
            session_type: 'strength',
            date: today,
            rpe: (toolCall.rpe as number | undefined) ?? null,
            notes: liftSummary,
          });
          // Log individual sets for each lift
          if (lifts.length > 0) {
            const allSets: Array<{
              session_id: number; exercise_id: string; exercise_name: string;
              set_number: number; prescribed_weight: number | null;
              actual_weight: number | null; reps: number | null;
              rpe: number | null; notes: string | null;
            }> = [];
            for (const lift of lifts) {
              for (let i = 0; i < lift.sets; i++) {
                allSets.push({
                  session_id: sessionId,
                  exercise_id: lift.exercise.toLowerCase().replace(/\s+/g, '_'),
                  exercise_name: lift.exercise,
                  set_number: i + 1,
                  prescribed_weight: null,
                  actual_weight: lift.weight_kg,
                  reps: lift.reps,
                  rpe: null,
                  notes: null,
                });
              }
            }
            await addStrengthSets(allSets);
          }
          // Also write to workout_log so dashboard + progress page see it
          await addWorkoutLog({
            date: today, template_id: null,
            name: lifts.length > 0 ? 'Strength' : ((toolCall.session_notes as string) ?? 'Strength'),
            duration_min: (toolCall.duration_min as number | undefined) ?? 60,
            intensity: 'high', calories_burned: null,
            source: 'manual', logged_at: new Date().toISOString(),
          });
          break;
        }

        case 'logMeditation': {
          const sessions = await getMeditationSessions();
          const session = sessions[0]; // default first session
          if (session) {
            await addMeditationLog({ session_id: session.id, date: today, completed: true, duration_actual_min: toolCall.duration_min as number, logged_at: new Date().toISOString() });
          }
          break;
        }
      }
    } catch (e) {
      console.error('Tool action failed:', toolCall.action, e);
    }
  }, []);

  // ── Speak ─────────────────────────────────────────────────────────────────────
  const currentVoiceRef = useRef<VoiceKey>('sarah');
  useEffect(() => { currentVoiceRef.current = voice; }, [voice]);

  const speakText = useCallback((text: string, onEnd?: () => void) => {
    setSpeaking(true);
    const v = currentVoiceRef.current;
    const done = () => { setSpeaking(false); onEnd?.(); };
    if (v === 'browser') speakBrowser(text, done);
    else speakElevenLabs(text, v, done);
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    haptic('light');

    // Stop current audio
    if (_unlockedAudio) { _unlockedAudio.pause(); _unlockedAudio.currentTime = 0; }
    window.speechSynthesis?.cancel();
    setSpeaking(false);

    const userMsg: Message = { role: 'user', content: text.trim() };
    const updatedMessages = [...messagesRef.current, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const res = await fetch('/api/jarvis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          context: contextRef.current,
        }),
      });
      if (!res.ok) throw new Error('API error');

      // Parse clean JSON response — text + actions separated server-side
      const json = await res.json() as { text: string; actions: Record<string, unknown>[] };
      const assistantText = json.text ?? '';
      // Fire all tool actions against the DB
      for (const action of json.actions ?? []) {
        try { await executeAction(action); } catch (e) { console.error('Tool action failed:', action, e); }
      }

      const finalMessages = [...updatedMessages, { role: 'assistant' as const, content: assistantText }];
      setMessages(finalMessages);
      setLastJarvisText(assistantText);

      // Persist
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(finalMessages.slice(-MAX_HISTORY)));

      // Speak — auto-listen after done in conversation mode
      if (assistantText) {
        speakText(assistantText, () => {
          if (autoListenRef.current) setTimeout(() => startMicRef.current(), 500);
        });
      }

    } catch {
      const errMsg = 'Connection issue. Try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg }]);
      setLastJarvisText(errMsg);
      speakText(errMsg);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, speakText, executeAction]);

  const voiceInput = useVoiceInput(sendMessage);
  // Keep startMicRef always pointing to the latest start fn — fixes stale closure in speakText callback
  useEffect(() => { startMicRef.current = voiceInput.start; }, [voiceInput.start]);
  // Auto-enable continuous listen after first mic tap
  useEffect(() => { if (voiceInput.listening) autoListenRef.current = true; }, [voiceInput.listening]);

  // ── Load context ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
        const history: Message[] = saved ? JSON.parse(saved) : [];
        const today = todayISO();
        const week  = getCurrentTrainingWeek();
        const [
          profile, habits, completions, macros, sessions, plan,
          weights, score, scoreHistory, mealLogs, insights, liftSetup,
        ] = await Promise.all([
          getProfile(), getHabits(), getHabitCompletions(today), getTodayMacros(),
          getTrainingSessions(week), getTrainingWeek(week), getWeightHistory(7),
          getDailyScore(today), getDailyScores(7), getMealLogs(today), getInsights(), getLiftSetup(),
        ]);
        const doneIds      = new Set(completions.filter(c => c.completed_at).map(c => c.habit_id));
        const activeHabits = habits.filter(h => h.active);
        const streaks      = await getHabitStreaks(activeHabits.map(h => h.id));
        const prescribedLifts = plan ? liftSetup.map(l => ({ lift: l.lift, weight: calcPrescribedWeight(l, plan), sets: 4, reps: plan.phase === 'Base' ? '5' : '3–5' })) : [];
        const ctx = {
          date: new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' }),
          score: score?.total_score ?? 0,
          calories: Math.round(macros?.calories ?? 0), calorieTarget: profile?.calorie_target ?? 2000,
          protein: Math.round(macros?.protein ?? 0),   proteinTarget: profile?.macro_targets?.protein ?? 150,
          carbs: Math.round(macros?.carbs ?? 0),       carbTarget: profile?.macro_targets?.carbs ?? 200,
          fat: Math.round(macros?.fat ?? 0),           fatTarget: profile?.macro_targets?.fat ?? 65,
          habitsDone: activeHabits.filter(h => doneIds.has(h.id)).length,
          habitsTotal: activeHabits.length,
          habits: activeHabits.map(h => ({ id: h.id, name: h.name, done: doneIds.has(h.id), streak: streaks.get(h.id) ?? 0 })),
          workoutDone: sessions.some(s => s.session_type === 'strength'),
          meditationDone: false,
          weight: weights[0]?.weight_kg ?? null, weightTrend: weights,
          trainingWeek: week, trainingPhase: plan?.phase ?? null, sessionsDone: sessions.length,
          prescribedLifts,
          meals: mealLogs.map(l => ({ meal_type: l.meal_type, name: l.food?.name ?? 'Unknown', calories: l.food ? l.food.calories * (l.quantity / l.food.serving_size) : 0, protein: l.food ? l.food.protein * (l.quantity / l.food.serving_size) : 0 })),
          scoreHistory, insights,
        };
        setContext(ctx);

        if (history.length > 0) {
          setMessages(history);
          const last = [...history].reverse().find(m => m.role === 'assistant');
          if (last) setLastJarvisText(last.content);
        } else {
          // Use real computed score, fall back to computing it now if missing
          const realScore = score?.total_score ?? (await computeDailyScore(today))?.total_score ?? 0;
          const s = realScore;
          const boot = s >= 75
            ? `Veronica online. Score at ${s}. Strong start — what do you need?`
            : s >= 50
            ? `Veronica online. Score at ${s}. Room to push today — what's the move?`
            : s > 0
            ? `Veronica online. Score at ${s}. We've got work to do. Where do you want to start?`
            : `Veronica online. Nothing logged yet today — let's get started. What's first?`;
          setMessages([{ role: 'assistant', content: boot }]);
          setLastJarvisText(boot);
        }
      } catch {
        const boot = 'Veronica online. What do you need?';
        setMessages([{ role: 'assistant', content: boot }]);
        setLastJarvisText(boot);
      }
    })();
  }, []);

  const handleVoiceSelect = (v: VoiceKey) => {
    setVoice(v); localStorage.setItem(STORAGE_KEY_VOICE, v);
  };

  const handleMicTap = () => {
    unlockAudio();
    haptic('medium');
    if (!autoListenRef.current) autoListenRef.current = true;
    voiceInput.toggle();
  };

  // Stop all audio/mic on back
  const handleBack = () => {
    autoListenRef.current = false;
    voiceInput.stop();
    if (_unlockedAudio) { _unlockedAudio.pause(); }
    window.speechSynthesis?.cancel();
    router.back();
  };

  const state = loading ? 'THINKING…' : speaking ? 'SPEAKING…' : voiceInput.listening ? 'LISTENING…' : 'TAP TO SPEAK';
  const stateColor = loading || speaking || voiceInput.listening ? '#DAFF01' : 'rgba(255,255,255,0.28)';
  const avatarActive = loading || speaking || voiceInput.listening;

  return (
    <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '0', overflow: 'hidden' }}>

      {/* ── Top bar ── */}
      <div style={{ width: '100%', padding: '52px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={handleBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 22, padding: 8, lineHeight: 1, WebkitTapHighlightColor: 'transparent' }}>←</button>
        <button onClick={() => { unlockAudio(); setShowVoicePicker(true); }} style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 99, padding: '7px 14px', fontSize: '0.55rem', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'var(--font-mono)', WebkitTapHighlightColor: 'transparent' }}>
          {VOICE_OPTIONS.find(v => v.key === voice)?.name?.toUpperCase() ?? 'VOICE'}
        </button>
      </div>

      {/* ── Avatar — WebGL Orb ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center', width: '100%', padding: '0 32px' }}>
        <div style={{ marginBottom: 32, position: 'relative' }}>
          <JarvisOrb loading={loading} listening={voiceInput.listening} speaking={speaking} size={240} />
        </div>

        {/* Name + state */}
        <p style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 510, letterSpacing: '0.05em', color: '#fff', fontFamily: 'var(--font-mono)' }}>VERONICA</p>
        <p style={{ margin: '0 0 28px', fontSize: '0.58rem', letterSpacing: '0.12em', color: stateColor, fontFamily: 'var(--font-mono)', transition: 'color 0.3s', minHeight: 14 }}>{state}</p>

        {/* Last Jarvis utterance */}
        {lastJarvisText && !voiceInput.listening && !loading && (
          <p style={{ margin: '0', fontSize: '0.95rem', lineHeight: 1.65, color: 'rgba(255,255,255,0.42)', textAlign: 'center', maxWidth: 320, letterSpacing: '-0.01em', animation: 'j-slideup 0.4s ease' }}>
            {stripMarkdown(lastJarvisText).slice(0, 200)}{lastJarvisText.length > 200 ? '…' : ''}
          </p>
        )}
      </div>

      {/* ── Mic + clear ── */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 'max(48px, calc(env(safe-area-inset-bottom) + 36px))', gap: 20, flexShrink: 0 }}>
        <button
            onClick={handleMicTap}
            disabled={loading || speaking}
            style={{
              width: 96, height: 96, borderRadius: '50%',
              background: voiceInput.listening ? '#DAFF01' : '#111',
              border: voiceInput.listening ? 'none' : '1.5px solid rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: loading || speaking ? 'default' : 'pointer',
              fontSize: 36,
              boxShadow: voiceInput.listening
                ? '0 0 48px rgba(218,255,1,0.55), 0 0 0 12px rgba(218,255,1,0.08)'
                : '0 0 0 12px rgba(255,255,255,0.02)',
              transition: 'all 0.2s',
              WebkitTapHighlightColor: 'transparent',
              color: voiceInput.listening ? '#000' : 'rgba(255,255,255,0.55)',
              opacity: loading || speaking ? 0.25 : 1,
              transform: voiceInput.listening ? 'scale(1.08)' : 'scale(1)',
            }}
          >🎙</button>
        <button
          onClick={() => { localStorage.removeItem(STORAGE_KEY_HISTORY); window.location.reload(); }}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.15)', fontSize: '0.55rem', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
        >CLEAR HISTORY</button>
      </div>

      <style>{`
        @keyframes j-ring1  { 0%,100%{transform:scale(1);opacity:.2} 50%{transform:scale(1.07);opacity:.6} }
        @keyframes j-ring2  { 0%,100%{transform:scale(1);opacity:.12} 50%{transform:scale(1.12);opacity:.45} }
        @keyframes j-bar    { from{transform:scaleY(.25)} to{transform:scaleY(1.7)} }
        @keyframes j-pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.25;transform:scale(.65)} }
        @keyframes j-slideup { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes j-fadein  { from{opacity:0} to{opacity:1} }
      `}</style>

      {showVoicePicker && <VoicePicker voice={voice} onSelect={handleVoiceSelect} onClose={() => setShowVoicePicker(false)} />}
    </div>
  );
}
