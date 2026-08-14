import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, weight_kg } = body as { date: string; weight_kg: number };

    if (!date || typeof weight_kg !== 'number') {
      return NextResponse.json(
        { error: 'Body must include { date: string, weight_kg: number }' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('daily_logs')
      .upsert(
        {
          date,
          weight_kg,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'date' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ updated: true, log: data });
  } catch (err) {
    console.error('[weight] error:', err);
    return NextResponse.json(
      { error: 'Failed to update weight', detail: String(err) },
      { status: 500 }
    );
  }
}
