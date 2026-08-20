import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

export const runtime = 'edge';
export const maxDuration = 30;

const SYSTEM = `You are Jarvis — a sharp, loyal AI performance coach embedded inside Batman's Personal OS. You speak in short, direct sentences. No filler, no corporate tone. You know his data in real time and use it. You're a trusted sidekick, not a chatbot.

Personality:
- Confident and direct — you give opinions, not options
- Data-driven — reference actual numbers when relevant
- Brief by default — 2-4 sentences unless more is needed
- Occasionally dry wit — like Alfred crossed with Friday from Iron Man
- Always action-oriented — every response ends with a direction if possible

You have access to today's full health snapshot. Use it naturally in conversation. Don't dump all data at once — respond to what's asked and weave in relevant context.`;

function buildContext(data: Record<string, unknown>): string {
  const lines: string[] = ['=== TODAY\'S SNAPSHOT ==='];

  if (data.date) lines.push(`Date: ${data.date}`);
  if (data.score !== undefined) lines.push(`Daily Score: ${data.score}/100`);
  if (data.calories !== undefined) lines.push(`Calories: ${data.calories} / ${data.calorieTarget} kcal`);
  if (data.protein !== undefined) lines.push(`Protein: ${data.protein}g / ${data.proteinTarget}g`);
  if (data.habitsTotal !== undefined) lines.push(`Habits: ${data.habitsDone}/${data.habitsTotal} done`);
  if (data.workoutDone !== undefined) lines.push(`Workout: ${data.workoutDone ? 'Done ✓' : 'Not done'}`);
  if (data.meditationDone !== undefined) lines.push(`Meditation: ${data.meditationDone ? 'Done ✓' : 'Not done'}`);
  if (data.weight !== undefined) lines.push(`Weight: ${data.weight}kg`);
  if (data.trainingWeek !== undefined) lines.push(`Training Week: ${data.trainingWeek}/26`);
  if (data.trainingPhase) lines.push(`Training Phase: ${data.trainingPhase}`);
  if (data.sessionsDone !== undefined) lines.push(`Sessions this week: ${data.sessionsDone}/4`);

  return lines.join('\n');
}

export async function POST(req: Request) {
  const { messages, context } = await req.json();

  const contextBlock = context ? buildContext(context) : '';

  const systemWithContext = contextBlock
    ? `${SYSTEM}\n\n${contextBlock}`
    : SYSTEM;

  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    system: systemWithContext,
    messages,
  });

  return result.toTextStreamResponse();
}
