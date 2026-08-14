import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json({ error: 'date param required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('exercise_log')
    .select('exercise_key, completed')
    .eq('date', date);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    date: string;
    exercise_key: string;
    completed: boolean;
  };
  const { date, exercise_key, completed } = body;

  if (!date || !exercise_key || completed === undefined) {
    return NextResponse.json(
      { error: 'date, exercise_key, and completed are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('exercise_log')
    .upsert(
      { date, exercise_key, completed },
      { onConflict: 'date,exercise_key' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
