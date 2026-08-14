import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calcTDEE, calcDeficit, calcWeeklyRate, calcETA } from '@/lib/tdee';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // 1. Auth check (skip if CRON_SECRET not set — for dev)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    // 2. Last 7 days of daily_logs with weight
    const { data: recentLogs, error: logsError } = await supabase
      .from('daily_logs')
      .select('date, weight_kg')
      .gte('date', sevenDaysAgoStr)
      .lte('date', today)
      .not('weight_kg', 'is', null)
      .order('date', { ascending: false });

    if (logsError) throw logsError;

    const validWeights: number[] = (recentLogs ?? [])
      .map((r: { weight_kg: number | null }) => r.weight_kg)
      .filter((w): w is number => w !== null);

    const rollingAvg =
      validWeights.length > 0
        ? validWeights.reduce((a, b) => a + b, 0) / validWeights.length
        : null;

    // 3. Active targets
    const { data: target } = await supabase
      .from('targets')
      .select('calorie_target')
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const calorieTarget = target?.calorie_target ?? 1800;

    let tdee = 0;
    let deficit = 0;
    let weeklyRate = 0;
    let eta = 0;

    if (rollingAvg !== null) {
      tdee = calcTDEE(rollingAvg);
      deficit = calcDeficit(tdee, calorieTarget);
      weeklyRate = calcWeeklyRate(deficit);
      eta = calcETA(rollingAvg, weeklyRate);
    }

    // 4. Phase transition check
    // Get last 14 days of weights, split into two 7-day windows
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split('T')[0];

    const { data: twoWeekLogs } = await supabase
      .from('daily_logs')
      .select('date, weight_kg')
      .gte('date', fourteenDaysAgoStr)
      .lte('date', today)
      .not('weight_kg', 'is', null)
      .order('date', { ascending: true });

    const allEntries = (twoWeekLogs ?? []) as Array<{
      date: string;
      weight_kg: number;
    }>;

    // Split: older half (first 7) and recent half (last 7)
    const midpoint = Math.floor(allEntries.length / 2);
    const olderHalf = allEntries.slice(0, midpoint);
    const recentHalf = allEntries.slice(midpoint);

    const avgOf = (entries: typeof allEntries) => {
      if (entries.length === 0) return null;
      const sum = entries.reduce((a, b) => a + b.weight_kg, 0);
      return sum / entries.length;
    };

    const olderAvg = avgOf(olderHalf);
    const recentAvgForPhase = avgOf(recentHalf);

    const inTargetRange = (avg: number | null) =>
      avg !== null && avg >= 83 && avg <= 85;

    // 5. Phase transition if both weeks in 83–85 kg and currently fat_loss
    const { data: phaseRow } = await supabase
      .from('phase_state')
      .select('*')
      .order('phase_started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let phaseTransitioned = false;

    if (
      phaseRow?.current_phase === 'fat_loss' &&
      inTargetRange(olderAvg) &&
      inTargetRange(recentAvgForPhase)
    ) {
      const { error: phaseError } = await supabase
        .from('phase_state')
        .update({
          current_phase: 'recomp',
          transitioned_at: new Date().toISOString(),
        })
        .eq('id', phaseRow.id);

      if (phaseError) throw phaseError;
      phaseTransitioned = true;
    }

    return NextResponse.json({
      recalculated_at: new Date().toISOString(),
      rolling_avg_kg: rollingAvg !== null ? Math.round(rollingAvg * 100) / 100 : null,
      samples: validWeights.length,
      tdee: Math.round(tdee),
      deficit: Math.round(deficit),
      weekly_rate_kg: Math.round(weeklyRate * 1000) / 1000,
      eta_weeks: isFinite(eta) ? Math.round(eta * 10) / 10 : -1,
      phase_transitioned: phaseTransitioned,
      current_phase: phaseTransitioned ? 'recomp' : (phaseRow?.current_phase ?? 'fat_loss'),
      older_week_avg: olderAvg !== null ? Math.round(olderAvg * 100) / 100 : null,
      recent_week_avg:
        recentAvgForPhase !== null ? Math.round(recentAvgForPhase * 100) / 100 : null,
    });
  } catch (err) {
    console.error('[cron/weekly-recalc] error:', err);
    return NextResponse.json(
      { error: 'Recalculation failed', detail: String(err) },
      { status: 500 }
    );
  }
}
