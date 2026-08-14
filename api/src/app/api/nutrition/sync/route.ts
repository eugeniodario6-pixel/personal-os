import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getDiaryForDate } from '@/lib/fatsecret';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const dateStr: string =
      body.date ?? new Date().toISOString().split('T')[0];

    // Parse date string into a local Date object (midnight UTC)
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    // 1. Fetch FatSecret diary
    const diary = await getDiaryForDate('default', date);

    // 2. Upsert into daily_logs
    const { data: logRow, error: logError } = await supabase
      .from('daily_logs')
      .upsert(
        {
          date: dateStr,
          calories: diary.calories,
          protein_g: diary.protein_g,
          carbs_g: diary.carbs_g,
          fat_g: diary.fat_g,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'date' }
      )
      .select()
      .single();

    if (logError) throw logError;

    // 3. Fetch active targets for scoring
    const { data: target } = await supabase
      .from('targets')
      .select('calorie_target, protein_target_g')
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const calorieTarget = target?.calorie_target ?? 1800;
    const proteinTarget = target?.protein_target_g ?? 185;

    // Adherence: any food logged
    const adherencePoints = diary.calories > 0 ? 1 : 0;
    // Bonus: hit calorie ceiling AND protein floor
    const bonusPoints =
      diary.calories > 0 &&
      diary.calories <= calorieTarget &&
      diary.protein_g >= proteinTarget
        ? 1
        : 0;

    const reason = [
      adherencePoints ? 'logged food' : null,
      bonusPoints ? 'hit calorie + protein targets' : null,
    ]
      .filter(Boolean)
      .join('; ');

    // 4. Upsert points_ledger
    const { error: pointsError } = await supabase
      .from('points_ledger')
      .upsert(
        {
          date: dateStr,
          adherence_points: adherencePoints,
          bonus_points: bonusPoints,
          reason: reason || null,
        },
        { onConflict: 'date' }
      );

    if (pointsError) throw pointsError;

    // 5. Return updated daily_logs row
    return NextResponse.json({
      synced: true,
      date: dateStr,
      diary,
      points: {
        adherence: adherencePoints,
        bonus: bonusPoints,
        total: adherencePoints + bonusPoints,
        reason: reason || null,
      },
      log: logRow,
    });
  } catch (err) {
    console.error('[nutrition/sync] error:', err);
    return NextResponse.json(
      { error: 'Sync failed', detail: String(err) },
      { status: 500 }
    );
  }
}
