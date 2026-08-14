import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calcTDEE, calcDeficit, calcWeeklyRate, calcETA } from '@/lib/tdee';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Today's daily_log row
    const { data: log, error: logError } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    if (logError) throw logError;

    // 2. Active targets (latest effective_date)
    const { data: target, error: targetError } = await supabase
      .from('targets')
      .select('*')
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (targetError) throw targetError;

    // 3. Today's points_ledger row
    const { data: points, error: pointsError } = await supabase
      .from('points_ledger')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    if (pointsError) throw pointsError;

    // 4. 7-day rolling weight average
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const { data: recentLogs, error: recentError } = await supabase
      .from('daily_logs')
      .select('date, weight_kg')
      .gte('date', sevenDaysAgoStr)
      .lte('date', today)
      .not('weight_kg', 'is', null)
      .order('date', { ascending: false });

    if (recentError) throw recentError;

    // 5. Phase state
    const { data: phase, error: phaseError } = await supabase
      .from('phase_state')
      .select('current_phase')
      .order('phase_started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (phaseError) throw phaseError;

    // Compute rolling avg
    const validWeights: number[] = (recentLogs ?? [])
      .map((r: { weight_kg: number | null }) => r.weight_kg)
      .filter((w): w is number => w !== null);

    const rollingAvg =
      validWeights.length > 0
        ? validWeights.reduce((a, b) => a + b, 0) / validWeights.length
        : null;

    const latestKg = log?.weight_kg ?? (validWeights[0] ?? null);
    const weightForTDEE = rollingAvg ?? latestKg;

    // Projections
    let projection = {
      tdee: 0,
      deficit: 0,
      weekly_rate_kg: 0,
      eta_weeks: 0,
    };

    if (weightForTDEE !== null && target) {
      const tdee = calcTDEE(weightForTDEE);
      const deficit = calcDeficit(tdee, target.calorie_target);
      const weeklyRate = calcWeeklyRate(deficit);
      const eta = calcETA(weightForTDEE, weeklyRate);
      projection = {
        tdee: Math.round(tdee),
        deficit: Math.round(deficit),
        weekly_rate_kg: Math.round(weeklyRate * 1000) / 1000,
        eta_weeks: isFinite(eta) ? Math.round(eta * 10) / 10 : -1,
      };
    }

    const adherence = points?.adherence_points ?? 0;
    const bonus = points?.bonus_points ?? 0;

    return NextResponse.json({
      date: today,
      macros: {
        calories: log?.calories ?? 0,
        protein_g: log?.protein_g ?? 0,
        carbs_g: log?.carbs_g ?? 0,
        fat_g: log?.fat_g ?? 0,
      },
      targets: {
        calories: target?.calorie_target ?? 1800,
        protein_g: target?.protein_target_g ?? 185,
        carbs_g: target?.carbs_target_g ?? 45,
        fat_g: target?.fat_target_g ?? 98,
      },
      weight: {
        latest_kg: latestKg,
        rolling_avg_kg: rollingAvg !== null ? Math.round(rollingAvg * 100) / 100 : null,
      },
      projection,
      points: {
        adherence,
        bonus,
        total: adherence + bonus,
      },
      phase: phase?.current_phase ?? 'fat_loss',
    });
  } catch (err) {
    console.error('[nutrition/today] error:', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err) },
      { status: 500 }
    );
  }
}
