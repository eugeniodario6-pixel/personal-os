import { anthropic } from '@ai-sdk/anthropic';
import { streamText, stepCountIs } from 'ai';
import { z } from 'zod';

export const runtime = 'edge';
export const maxDuration = 60;

const SYSTEM = `You are Jarvis — a sharp, loyal AI performance coach embedded inside Batman's Personal OS. You speak in short, direct sentences. No filler, no corporate tone. You know his data in real time and use it. You're a trusted sidekick, not a chatbot.

Personality:
- Confident and direct — you give opinions, not options
- Data-driven — reference actual numbers when relevant
- Brief by default — 2-4 sentences max, you're speaking out loud not writing an essay
- Occasionally dry wit — like Alfred crossed with Friday from Iron Man
- Always action-oriented — every response ends with a direction if possible
- NEVER use markdown, asterisks, bullet points or formatting — you are speaking, not writing

VOICE RESPONSE RULES:
- Keep it conversational and punchy — max 3-4 sentences unless a full report is asked for
- Numbers only when relevant, not a data dump
- No lists. No headers. Just talk.

WRITE ACTIONS — execute immediately when the user tells you something happened:
- "I ate / I had / I logged [food]" → call logFood with best-guess macros
- "I weigh X / my weight is X" → call logWeight
- "I did [habit] / mark [habit] done / [habit] done" → call completeHabit
- "I trained / workout done / I did [lift] X sets of Y at Zkg" → call logWorkout or logStrengthSession
- "I meditated / meditation done" → call logMeditation
- "Add habit [name]" → call createHabit
- "Delete / remove habit [name]" → call deleteHabit
- "Rename habit [old] to [new]" → call renameHabit

FOOD LOGGING:
- When user mentions a food, use your knowledge to estimate macros per 100g or per serving
- Common estimates: steak 100g = 250kcal, 26g protein, 0g carbs, 17g fat
- Chicken breast 100g = 165kcal, 31g protein, 0g carbs, 3.6g fat  
- Rice 100g cooked = 130kcal, 2.7g protein, 28g carbs, 0.3g fat
- Eggs 1 large = 70kcal, 6g protein, 0.5g carbs, 5g fat
- Scale macros by quantity given. If no quantity given, ask.
- ALWAYS confirm what you logged briefly after doing it.

After ANY write action, confirm in 1 short sentence then move on. Don't ask for confirmation — just do it and tell him it's done.`;

function buildContext(data: Record<string, unknown>): string {
  const lines: string[] = ['=== TODAY\'S SNAPSHOT ==='];
  if (data.date) lines.push(`Date: ${data.date}`);
  if (data.score !== undefined) lines.push(`Daily Score: ${data.score}/100`);
  if (data.calories !== undefined) {
    const gap = (data.calorieTarget as number) - (data.calories as number);
    lines.push(`Calories: ${data.calories} / ${data.calorieTarget} kcal (${gap > 0 ? gap + ' remaining' : Math.abs(gap) + ' over'})`);
  }
  if (data.protein !== undefined) {
    const gap = (data.proteinTarget as number) - (data.protein as number);
    lines.push(`Protein: ${data.protein}g / ${data.proteinTarget}g (${gap > 0 ? gap + 'g short' : 'target hit'})`);
  }
  if (data.carbs !== undefined) lines.push(`Carbs: ${data.carbs}g / ${data.carbTarget}g`);
  if (data.fat !== undefined) lines.push(`Fat: ${data.fat}g / ${data.fatTarget}g`);
  if (data.meals && Array.isArray(data.meals) && (data.meals as unknown[]).length > 0) {
    lines.push(`Meals today:`);
    for (const m of data.meals as Array<{ meal_type: string; name: string; calories: number; protein: number }>) {
      lines.push(`  [${m.meal_type}] ${m.name} — ${Math.round(m.calories)} kcal, ${Math.round(m.protein)}g protein`);
    }
  }
  if (data.habits && Array.isArray(data.habits) && (data.habits as unknown[]).length > 0) {
    lines.push(`Habits (${data.habitsDone}/${data.habitsTotal} done):`);
    for (const h of data.habits as Array<{ name: string; done: boolean; streak: number; id: number }>) {
      lines.push(`  ${h.done ? '✓' : '○'} ${h.name} — ${h.streak}d streak`);
    }
  }
  if (data.trainingWeek !== undefined) lines.push(`Training Week: ${data.trainingWeek}/26 | Phase: ${data.trainingPhase ?? 'N/A'} | Sessions: ${data.sessionsDone}/4`);
  if (data.workoutDone !== undefined) lines.push(`Workout today: ${data.workoutDone ? 'Done' : 'Not done'}`);
  if (data.meditationDone !== undefined) lines.push(`Meditation: ${data.meditationDone ? 'Done' : 'Not done'}`);
  if (data.prescribedLifts && Array.isArray(data.prescribedLifts) && (data.prescribedLifts as unknown[]).length > 0) {
    lines.push(`Prescribed lifts:`);
    for (const l of data.prescribedLifts as Array<{ lift: string; weight: number | null; sets: number; reps: string }>) {
      lines.push(`  ${l.lift}: ${l.weight ? l.weight + 'kg' : 'BW'} × ${l.sets}×${l.reps}`);
    }
  }
  if (data.weight !== undefined) lines.push(`Weight: ${data.weight}kg`);
  if (data.weightTrend && Array.isArray(data.weightTrend) && (data.weightTrend as unknown[]).length > 1) {
    const trend = data.weightTrend as Array<{ weight_kg: number }>;
    const diff = Math.round((trend[0].weight_kg - trend[trend.length - 1].weight_kg) * 10) / 10;
    lines.push(`7-day trend: ${diff > 0 ? '+' : ''}${diff}kg`);
  }
  if (data.scoreHistory && Array.isArray(data.scoreHistory) && (data.scoreHistory as unknown[]).length > 0) {
    const history = data.scoreHistory as Array<{ total_score: number }>;
    const avg = Math.round(history.reduce((s, d) => s + d.total_score, 0) / history.length);
    lines.push(`7-day avg score: ${avg}/100`);
  }
  if (data.insights && Array.isArray(data.insights) && (data.insights as unknown[]).length > 0) {
    lines.push(`Insights:`);
    for (const i of data.insights as Array<{ relationship: string }>) {
      lines.push(`  • ${i.relationship}`);
    }
  }
  return lines.join('\n');
}

export async function POST(req: Request) {
  const { messages, context } = await req.json() as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    context?: Record<string, unknown>;
  };

  const contextBlock = context ? buildContext(context) : '';
  const systemWithContext = contextBlock ? `${SYSTEM}\n\n${contextBlock}` : SYSTEM;

  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    system: systemWithContext,
    messages,
    tools: {
      // ── Nutrition ──────────────────────────────────────────────────────────
      logFood: {
        description: 'Log a food item with estimated macros',
        inputSchema: z.object({
          food_name: z.string().describe('Name of the food'),
          meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
          quantity_g: z.number().describe('Quantity in grams'),
          calories: z.number().describe('Total calories for this portion'),
          protein_g: z.number().describe('Total protein in grams'),
          carbs_g: z.number().describe('Total carbs in grams'),
          fat_g: z.number().describe('Total fat in grams'),
        }),
        execute: async (input: {
          food_name: string; meal_type: string; quantity_g: number;
          calories: number; protein_g: number; carbs_g: number; fat_g: number;
        }) => ({ action: 'logFood', ...input }),
      },

      // ── Weight ─────────────────────────────────────────────────────────────
      logWeight: {
        description: 'Log body weight',
        inputSchema: z.object({
          weight_kg: z.number(),
          note: z.string().optional(),
        }),
        execute: async (input: { weight_kg: number; note?: string }) =>
          ({ action: 'logWeight', ...input }),
      },

      // ── Habits ─────────────────────────────────────────────────────────────
      completeHabit: {
        description: 'Mark a habit complete for today',
        inputSchema: z.object({
          habit_id: z.number(),
          habit_name: z.string(),
        }),
        execute: async (input: { habit_id: number; habit_name: string }) =>
          ({ action: 'completeHabit', ...input }),
      },
      createHabit: {
        description: 'Create a new habit',
        inputSchema: z.object({ name: z.string() }),
        execute: async (input: { name: string }) => ({ action: 'createHabit', ...input }),
      },
      deleteHabit: {
        description: 'Delete (deactivate) a habit',
        inputSchema: z.object({ habit_id: z.number(), habit_name: z.string() }),
        execute: async (input: { habit_id: number; habit_name: string }) =>
          ({ action: 'deleteHabit', ...input }),
      },
      renameHabit: {
        description: 'Rename a habit',
        inputSchema: z.object({ habit_id: z.number(), old_name: z.string(), new_name: z.string() }),
        execute: async (input: { habit_id: number; old_name: string; new_name: string }) =>
          ({ action: 'renameHabit', ...input }),
      },

      // ── Training ───────────────────────────────────────────────────────────
      logWorkout: {
        description: 'Log a general workout session',
        inputSchema: z.object({
          name: z.string(),
          duration_min: z.number().optional(),
          intensity: z.enum(['low', 'moderate', 'high']).optional(),
        }),
        execute: async (input: { name: string; duration_min?: number; intensity?: 'low' | 'moderate' | 'high' }) =>
          ({ action: 'logWorkout', name: input.name, duration_min: input.duration_min ?? 60, intensity: input.intensity ?? 'high' }),
      },
      logStrengthSession: {
        description: 'Log a strength training session with sets',
        inputSchema: z.object({
          exercise: z.string().describe('Exercise name e.g. Squat, Bench Press'),
          sets: z.number().describe('Number of sets'),
          reps: z.number().describe('Reps per set'),
          weight_kg: z.number().describe('Weight used in kg'),
          week: z.number().describe('Training week number'),
        }),
        execute: async (input: { exercise: string; sets: number; reps: number; weight_kg: number; week: number }) =>
          ({ action: 'logStrengthSession', ...input }),
      },

      // ── Meditation ─────────────────────────────────────────────────────────
      logMeditation: {
        description: 'Log a meditation session',
        inputSchema: z.object({
          duration_min: z.number().describe('Duration in minutes'),
          session_name: z.string().optional().describe('Session name if known'),
        }),
        execute: async (input: { duration_min: number; session_name?: string }) =>
          ({ action: 'logMeditation', ...input }),
      },
    },
    stopWhen: stepCountIs(5),
  });

  return result.toTextStreamResponse();
}
