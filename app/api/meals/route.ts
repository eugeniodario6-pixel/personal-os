import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const date = dateParam === 'today' || !dateParam ? getToday() : dateParam

    const client = createServerClient()
    const { data, error } = await client
      .from('meals')
      .select('*')
      .eq('date', date)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('GET /api/meals error:', err)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      name: string
      calories: number
      protein_g: number
      carbs_g: number
      fat_g: number
      date?: string
    }

    const date = body.date ?? getToday()
    const client = createServerClient()

    const { data, error } = await client
      .from('meals')
      .insert({
        name: body.name,
        calories: body.calories,
        protein_g: body.protein_g,
        carbs_g: body.carbs_g,
        fat_g: body.fat_g,
        date,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('POST /api/meals error:', err)
    return NextResponse.json({ error: 'Failed to log meal' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const client = createServerClient()
    const { error } = await client.from('meals').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/meals error:', err)
    return NextResponse.json({ error: 'Failed to delete meal' }, { status: 500 })
  }
}
