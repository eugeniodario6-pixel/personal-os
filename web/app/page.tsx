'use client'

import { useEffect, useState, useCallback } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-seven-ebon-33.vercel.app'

type NutritionData = {
  date: string
  macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  targets: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  weight: { latest_kg: number | null; rolling_avg_kg: number | null }
  projection: { tdee: number; deficit: number; weekly_rate_kg: number; eta_weeks: number }
  points: { adherence: number; bonus: number; total: number }
  phase: string
}

function formatDate(d: Date): string {
  const day = d.getDate().toString().padStart(2, '0')
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${day} ${months[d.getMonth()]}`
}

function ProgressBar({ value, target, overColor }: { value: number; target: number; overColor?: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  const isOver = value > target
  const fillColor = isOver && overColor ? overColor : '#FF6B35'
  return (
    <div
      style={{
        height: 2,
        background: '#1A1A1A',
        borderRadius: 1,
        marginTop: 6,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: fillColor,
          borderRadius: 1,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  )
}

function Pill({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      style={{
        height: 28,
        padding: '0 10px',
        borderRadius: 4,
        border: `1px solid ${active ? '#FF6B35' : '#1A1A1A'}`,
        color: active ? '#F0F0F0' : '#555555',
        background: '#0D0D0D',
        display: 'flex',
        alignItems: 'center',
        fontFamily: 'var(--font-inter), sans-serif',
        fontWeight: 500,
        fontSize: 11,
      }}
    >
      {label}
    </div>
  )
}

export default function HomePage() {
  const [data, setData] = useState<NutritionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/nutrition/today`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      await fetch(`${API_URL}/api/nutrition/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today }),
      })
      await fetchData()
    } catch (e) {
      console.error('Sync failed', e)
    } finally {
      setSyncing(false)
    }
  }

  const handleLogWeight = async () => {
    const input = window.prompt('Enter current weight (kg):')
    if (!input) return
    const kg = parseFloat(input)
    if (isNaN(kg)) {
      window.alert('Invalid weight value.')
      return
    }
    try {
      const today = new Date().toISOString().split('T')[0]
      await fetch(`${API_URL}/api/weight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, weight_kg: kg }),
      })
      await fetchData()
    } catch (e) {
      console.error('Log weight failed', e)
    }
  }

  const today = new Date()
  const dateLabel = formatDate(today)

  const macros = data?.macros
  const targets = data?.targets
  const weight = data?.weight
  const projection = data?.projection
  const points = data?.points

  const etaWeeks = (() => {
    if (!projection) return '--'
    if (!isFinite(projection.eta_weeks) || projection.eta_weeks <= 0) return '--'
    return projection.eta_weeks.toFixed(1)
  })()

  const macroRows = [
    {
      label: 'CALORIES',
      value: macros?.calories ?? null,
      target: targets?.calories ?? null,
      unit: 'kcal',
      decimals: 0,
      isCalories: true,
    },
    {
      label: 'PROTEIN',
      value: macros?.protein_g ?? null,
      target: targets?.protein_g ?? null,
      unit: 'g',
      decimals: 1,
      isCalories: false,
    },
    {
      label: 'CARBS',
      value: macros?.carbs_g ?? null,
      target: targets?.carbs_g ?? null,
      unit: 'g',
      decimals: 1,
      isCalories: false,
    },
    {
      label: 'FAT',
      value: macros?.fat_g ?? null,
      target: targets?.fat_g ?? null,
      unit: 'g',
      decimals: 1,
      isCalories: false,
    },
  ]

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 20px 32px',
        maxWidth: 430,
        margin: '0 auto',
        gap: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontWeight: 500,
            fontSize: 11,
            color: '#555555',
            letterSpacing: '3px',
          }}
        >
          PERSONAL OS
        </span>
        <span
          style={{
            fontFamily: 'var(--font-ibm-plex-mono), monospace',
            fontWeight: 400,
            fontSize: 11,
            color: '#555555',
          }}
        >
          {dateLabel}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: 11,
            color: '#555555',
            marginBottom: 16,
          }}
        >
          Error: {error}
        </div>
      )}

      {/* ETA Block */}
      <div
        style={{
          textAlign: 'center',
          paddingBottom: 24,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontWeight: 400,
            fontSize: 10,
            color: '#555555',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          WEEKS TO TARGET
        </div>
        <div
          style={{
            fontFamily: 'var(--font-ibm-plex-mono), monospace',
            fontWeight: 600,
            fontSize: 'clamp(72px, 20vw, 96px)',
            color: '#C8FF00',
            lineHeight: 1,
          }}
        >
          {etaWeeks}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontWeight: 400,
            fontSize: 10,
            color: '#555555',
            marginTop: 6,
          }}
        >
          recalculates weekly · 84 kg midpoint
        </div>
      </div>

      {/* Divider */}
      <hr style={{ border: 'none', borderTop: '1px solid #1A1A1A', margin: 0 }} />

      {/* Macros Section */}
      <div style={{ padding: '20px 0' }}>
        <div
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontWeight: 500,
            fontSize: 10,
            color: '#555555',
            letterSpacing: '3px',
            marginBottom: 16,
          }}
        >
          TODAY
        </div>

        {macroRows.map((row) => {
          const displayValue =
            row.value === null
              ? '--'
              : row.decimals === 0
              ? Math.round(row.value).toString()
              : row.value.toFixed(row.decimals)
          const displayTarget = row.target === null ? '--' : `/ ${Math.round(row.target)}`

          return (
            <div key={row.label} style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-inter), sans-serif',
                    fontWeight: 400,
                    fontSize: 11,
                    color: '#555555',
                    flex: '0 0 auto',
                    minWidth: 64,
                  }}
                >
                  {row.label}
                </span>
                <span
                  style={{
                    flex: 1,
                    textAlign: 'center',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-ibm-plex-mono), monospace',
                      fontWeight: 600,
                      fontSize: 20,
                      color: '#F0F0F0',
                    }}
                  >
                    {displayValue}
                  </span>
                  {row.value !== null && (
                    <span
                      style={{
                        fontFamily: 'var(--font-inter), sans-serif',
                        fontWeight: 400,
                        fontSize: 11,
                        color: '#555555',
                        marginLeft: 4,
                      }}
                    >
                      {row.unit}
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-inter), sans-serif',
                    fontWeight: 400,
                    fontSize: 11,
                    color: '#555555',
                    flex: '0 0 auto',
                    textAlign: 'right',
                    minWidth: 48,
                  }}
                >
                  {displayTarget}
                </span>
              </div>
              {row.value !== null && row.target !== null && (
                <ProgressBar
                  value={row.value}
                  target={row.target}
                  overColor={row.isCalories ? '#FF3B30' : undefined}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Divider */}
      <hr style={{ border: 'none', borderTop: '1px solid #1A1A1A', margin: 0 }} />

      {/* Weight Section */}
      <div style={{ padding: '20px 0' }}>
        <div
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontWeight: 500,
            fontSize: 10,
            color: '#555555',
            letterSpacing: '3px',
            marginBottom: 12,
          }}
        >
          WEIGHT
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 6,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-ibm-plex-mono), monospace',
              fontWeight: 600,
              fontSize: 36,
              color: '#F0F0F0',
              lineHeight: 1,
            }}
          >
            {weight?.rolling_avg_kg != null ? weight.rolling_avg_kg.toFixed(1) : '--'}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontWeight: 400,
              fontSize: 14,
              color: '#555555',
            }}
          >
            kg
          </span>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontWeight: 400,
            fontSize: 10,
            color: '#555555',
            marginTop: 4,
          }}
        >
          7-day rolling avg
        </div>
      </div>

      {/* Divider */}
      <hr style={{ border: 'none', borderTop: '1px solid #1A1A1A', margin: 0 }} />

      {/* Points Strip */}
      <div
        style={{
          padding: '20px 0',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
          <Pill label="LOG" active={(points?.adherence ?? 0) > 0} />
          <Pill label="TARGET" active={(points?.bonus ?? 0) > 0} />
        </div>
        <span
          style={{
            fontFamily: 'var(--font-ibm-plex-mono), monospace',
            fontWeight: 600,
            fontSize: 20,
            color: '#F0F0F0',
          }}
        >
          {points != null ? `${points.total} pts` : '-- pts'}
        </span>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <button
          onClick={handleSync}
          disabled={syncing || loading}
          style={{
            width: '100%',
            height: 44,
            background: '#0D0D0D',
            border: '1px solid #1A1A1A',
            borderRadius: 6,
            fontFamily: 'var(--font-inter), sans-serif',
            fontWeight: 500,
            fontSize: 12,
            color: '#F0F0F0',
            letterSpacing: '1px',
            cursor: syncing || loading ? 'not-allowed' : 'pointer',
            opacity: syncing || loading ? 0.6 : 1,
          }}
        >
          {syncing ? 'SYNCING…' : 'SYNC FATSECRET'}
        </button>

        <button
          onClick={handleLogWeight}
          disabled={loading}
          style={{
            width: '100%',
            height: 36,
            background: '#0D0D0D',
            border: '1px solid #1A1A1A',
            borderRadius: 6,
            fontFamily: 'var(--font-inter), sans-serif',
            fontWeight: 500,
            fontSize: 12,
            color: '#555555',
            letterSpacing: '1px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          LOG WEIGHT
        </button>
      </div>
    </div>
  )
}
