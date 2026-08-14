import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEFAULT_TARGET = 1800;

interface MealRow {
  date: string;
  calories: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') ?? '30');

  const today = new Date();
  const results: Array<{
    date: string;
    calories: number;
    target: number;
    isFuture: boolean;
  }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    results.push({ date: dateStr, calories: 0, target: DEFAULT_TARGET, isFuture: false });
  }

  const startDate = results[0].date;
  const endDate = results[results.length - 1].date;

  const { data, error } = await supabase
    .from('meals')
    .select('date, calories')
    .gte('date', startDate)
    .lte('date', endDate);

  if (!error && data) {
    const calsByDate: Record<string, number> = {};
    (data as MealRow[]).forEach((row) => {
      calsByDate[row.date] = (calsByDate[row.date] ?? 0) + row.calories;
    });
    results.forEach((r) => {
      if (calsByDate[r.date] !== undefined) {
        r.calories = calsByDate[r.date];
      }
    });
  }

  return NextResponse.json(results);
}
