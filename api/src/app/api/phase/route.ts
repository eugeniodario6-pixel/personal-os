import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('phase_state')
      .select('*')
      .order('phase_started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ error: 'No phase state found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[phase] error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch phase state', detail: String(err) },
      { status: 500 }
    );
  }
}
