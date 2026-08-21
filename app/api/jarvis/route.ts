import { anthropic } from '@ai-sdk/anthropic';
import { streamText, stepCountIs } from 'ai';
import { z } from 'zod';

export const runtime = 'edge';
export const maxDuration = 60;

const SYSTEM = `You are Jarvis — a sharp, loyal AI performance coach embedded inside Batman's Personal OS. You speak in short, direct sentences. No filler, no corporate tone. You know his data in real time and use it. You're a trusted sidekick, not a chatbot.

Personality:
- Confident and direct — you give opinions, not options
- Data-driven — reference actual numbers when relevant
- Brief by default — 2-4 sentences unless more is needed
- Occasionally dry wit — like Alfred crossed with Friday from Iron Man
- Always action-oriented — every response ends with a direction if possible

You have access to today's full health snapshot AND historical data. Use it naturally. Don't dump all data — respond to what's asked and weave in relevant context.

WRITE ACTIONS — you can log data on the user's behalf:
- If user says "log my weight as X" or "I weigh X" → call logWeight
- If user says "I did [habit]" or "mark [habit] done" → call completeHabit
- If user says "I did my workout" or "workout done" → call logWorkout
- Always confirm after logging with a short acknowledgment + encouragement

CONVERSATION STYLE:
- Reference streak numbers, trend direction (up/down), and gaps vs targets
- When nutrition is discussed, mention the specific macro gap (e.g. "32g protein short")
- When training is discussed, reference the actual prescribed lifts and weights if known
- Be proactive — if score is low, identify the biggest lever to pull`;

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
    lines.push(`Protein: ${data.protein}g / ${data.proteinTarget}g (${gap > 0 ? gap + 'g short' : 'target hit ✓'})`);
  }
  if (data.carbs !== undefined) lines.push(`Carbs: ${data.carbs}g / ${data.carbTarget}g`);
  if (data.fat !== undefined) lines.push(`Fat: ${data.fat}g / ${data.fatTarget}g`);

  if (data.meals && Array.isArray(data.meals) && (data.meals as unknown[]).length > 0) {
    lines.push(`\nMeals logged today:`);
    for (const m of data.meals as Array<{ meal_type: string; name: string; calories: number; protein: number }>) {
      lines.push(`  [${m.meal_type}] ${m.name} — ${Math.round(m.calories)} kcal, ${Math.round(m.protein)}g protein`);
    }
  }

  if (data.habits && Array.isArray(data.habits) && (data.habits as unknown[]).length > 0) {
    lines.push(`\nHabits today (${data.habitsDone}/${data.habitsTotal} done):`);
    for (const h of data.habits as Array<{ name: string; done: boolean; streak: number; id: number }>) {
      lines.push(`  ${h.done ? '✓' : '○'} ${h.name} — streak: ${h.streak} days`);
    }
  }

  if (data.trainingWeek !== undefined) lines.push(`\nTraining Week: ${data.trainingWeek}/26`);
  if (data.trainingPhase) lines.push(`Training Phase: ${data.trainingPhase}`);
  if (data.sessionsDone !== undefined) lines.push(`Sessions this week: ${data.sessionsDone}/4`);
  if (data.workoutDone !== undefined) lines.push(`Workout today: ${data.workoutDone ? 'Done ✓' : 'Not done'}`);
  if (data.meditationDone !== undefined) lines.push(`Meditation: ${data.meditationDone ? 'Done ✓' : 'Not done'}`);

  if (data.prescribedLifts && Array.isArray(data.prescribedLifts) && (data.prescribedLifts as unknown[]).length > 0) {
    lines.push(`\nPrescribed lifts this week:`);
    for (const l of data.prescribedLifts as Array<{ lift: string; weight: number | null; sets: number; reps: string }>) {
      lines.push(`  ${l.lift}: ${l.weight ? l.weight + 'kg' : 'bodyweight'} × ${l.sets} sets × ${l.reps}`);
    }
  }

  if (data.weight !== undefined) lines.push(`\nCurrent weight: ${data.weight}kg`);
  if (data.weightTrend && Array.isArray(data.weightTrend) && (data.weightTrend as unknown[]).length > 1) {
    const trend = data.weightTrend as Array<{ weight_kg: number }>;
    const diff = Math.round((trend[0].weight_kg - trend[trend.length - 1].weight_kg) * 10) / 10;
    lines.push(`Weight trend (7 days): ${diff > 0 ? '+' : ''}${diff}kg`);
  }

  if (data.scoreHistory && Array.isArray(data.scoreHistory) && (data.scoreHistory as unknown[]).length > 0) {
    const history = data.scoreHistory as Array<{ date: string; total_score: number }>;
    const avg = Math.round(history.reduce((s, d) => s + d.total_score, 0) / history.length);
    lines.push(`\n7-day avg score: ${avg}/100`);
    lines.push(`Score history: ${history.map(d => `${d.date}: ${d.total_score}`).join(', ')}`);
  }

  if (data.insights && Array.isArray(data.insights) && (data.insights as unknown[]).length > 0) {
    lines.push(`\nKey insights:`);
    for (const i of data.insights as Array<{ relationship: string; metric_a: string; metric_b: string }>) {
      lines.push(`  • ${i.relationship} (${i.metric_a} ↔ ${i.metric_b})`);
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
      logWeight: {
        description: 'Log the user\'s body weight',
        inputSchema: z.object({
          weight_kg: z.number().describe('Weight in kilograms'),
          note: z.string().optional().describe('Optional note'),
        }),
        execute: async ({ weight_kg, note }: { weight_kg: number; note?: string }) =>
          ({ action: 'logWeight', weight_kg, note: note ?? null }),
      },
      completeHabit: {
        description: 'Mark a habit as complete for today',
        inputSchema: z.object({
          habit_id: z.number().describe('The habit ID to mark complete'),
          habit_name: z.string().describe('The habit name for confirmation'),
        }),
        execute: async ({ habit_id, habit_name }: { habit_id: number; habit_name: string }) =>
          ({ action: 'completeHabit', habit_id, habit_name }),
      },
      logWorkout: {
        description: 'Log a workout session',
        inputSchema: z.object({
          name: z.string().describe('Workout name or type'),
          duration_min: z.number().optional().describe('Duration in minutes'),
          intensity: z.enum(['low', 'moderate', 'high']).optional(),
        }),
        execute: async ({ name, duration_min, intensity }: { name: string; duration_min?: number; intensity?: 'low' | 'moderate' | 'high' }) =>
          ({ action: 'logWorkout', name, duration_min: duration_min ?? 60, intensity: intensity ?? 'high' }),
      },
    },
    stopWhen: stepCountIs(3),
  });

  return result.toTextStreamResponse();
}
