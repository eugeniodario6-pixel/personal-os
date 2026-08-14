'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface Meal {
  id: string
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  date: string
}

interface FoodResult {
  food_id: string
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  serving_description: string
}

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 20,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 400,
  color: 'var(--muted)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const rowBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 0',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text)',
  fontSize: 15,
  padding: '8px 10px',
  outline: 'none',
}

export default function MealsPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodResult[]>([])
  const [selected, setSelected] = useState<FoodResult | null>(null)
  const [serving, setServing] = useState(1)
  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [form, setForm] = useState({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function fetchMeals() {
      try {
        const res = await fetch('/api/meals?date=today')
        const data = await res.json() as Meal[]
        setMeals(Array.isArray(data) ? data : [])
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    void fetchMeals()
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/food-search?q=${encodeURIComponent(query)}`)
        const data = await res.json() as FoodResult[]
        setResults(Array.isArray(data) ? data : [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 500)
  }, [query])

  function selectFood(food: FoodResult) {
    setSelected(food)
    setServing(1)
    setForm({
      calories: food.calories,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
    })
    setResults([])
    setQuery('')
  }

  function handleServingChange(val: number) {
    if (!selected) return
    const s = Math.max(0.5, val)
    setServing(s)
    setForm({
      calories: Math.round(selected.calories * s),
      protein_g: Math.round(selected.protein_g * s * 10) / 10,
      carbs_g: Math.round(selected.carbs_g * s * 10) / 10,
      fat_g: Math.round(selected.fat_g * s * 10) / 10,
    })
  }

  async function logMeal() {
    if (!selected) return
    try {
      const res = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selected.name,
          calories: form.calories,
          protein_g: form.protein_g,
          carbs_g: form.carbs_g,
          fat_g: form.fat_g,
        }),
      })
      const newMeal = await res.json() as Meal
      if (newMeal.id) {
        setMeals((prev) => [...prev, newMeal])
      }
      setSelected(null)
      setQuery('')
    } catch {
      // silent
    }
  }

  async function deleteMeal(id: string) {
    try {
      await fetch(`/api/meals?id=${id}`, { method: 'DELETE' })
      setMeals((prev) => prev.filter((m) => m.id !== id))
    } catch {
      // silent
    }
  }

  const total = meals.reduce((acc, m) => acc + (m.calories ?? 0), 0)

  return (
    <main style={{ padding: '24px 24px 80px', maxWidth: 390, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 32,
        }}
      >
        <span style={labelStyle}>meals</span>
        <Link href="/" style={{ fontSize: 20, color: 'var(--muted)', lineHeight: 1 }}>
          ←
        </Link>
      </div>

      {/* Search card */}
      <div style={{ ...card, marginBottom: 12 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search foods"
          style={{
            width: '100%',
            height: 40,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text)',
            fontSize: 15,
            padding: '0 14px',
            outline: 'none',
          }}
        />
        {searching && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
            searching...
          </div>
        )}
        {results.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {results.map((food, i) => (
              <div
                key={food.food_id}
                onClick={() => selectFood(food)}
                style={{
                  ...rowBase,
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 15 }}>{food.name}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{food.calories} kcal</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected food form */}
      {selected && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>{selected.name}</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {(
              [
                { key: 'calories', label: 'calories' },
                { key: 'protein_g', label: 'protein (g)' },
                { key: 'carbs_g', label: 'carbs (g)' },
                { key: 'fat_g', label: 'fat (g)' },
              ] as const
            ).map((field) => (
              <div key={field.key}>
                <div style={{ ...labelStyle, marginBottom: 4 }}>{field.label}</div>
                <input
                  type="number"
                  value={form[field.key]}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [field.key]: parseFloat(e.target.value) || 0 }))
                  }
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...labelStyle, marginBottom: 4 }}>servings</div>
            <input
              type="number"
              value={serving}
              step={0.5}
              min={0.5}
              onChange={(e) => handleServingChange(parseFloat(e.target.value) || 1)}
              style={inputStyle}
            />
          </div>
          <button
            onClick={() => void logMeal()}
            style={{
              width: '100%',
              height: 44,
              background: 'var(--text)',
              color: 'var(--bg)',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'block',
            }}
          >
            log meal
          </button>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button
              onClick={() => setSelected(null)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 12,
                color: 'var(--muted)',
                cursor: 'pointer',
              }}
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {/* Today's meals card */}
      <div style={card}>
        <div
          style={{
            ...labelStyle,
            marginBottom: 0,
            paddingBottom: 14,
            borderBottom: '1px solid var(--border)',
          }}
        >
          today
        </div>
        {loading ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted)' }}>
            loading
          </div>
        ) : meals.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 15 }}>
            no meals logged
          </div>
        ) : (
          <>
            {meals.map((meal, i) => (
              <div
                key={meal.id}
                style={{
                  ...rowBase,
                  borderBottom: i < meals.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span style={{ fontSize: 15 }}>{meal.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 15 }}>{meal.calories}</span>
                  <button
                    onClick={() => void deleteMeal(meal.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 14,
                      color: 'var(--muted)',
                      cursor: 'pointer',
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            <div
              style={{
                ...rowBase,
                paddingBottom: 0,
                borderTop: '1px solid var(--border)',
              }}
            >
              <span style={{ ...labelStyle }}>total</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{total} kcal</span>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
