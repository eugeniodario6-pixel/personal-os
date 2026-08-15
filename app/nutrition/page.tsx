'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  getMealLogs, addFoodItem, addMealLog, deleteMealLog,
  getProfile, todayISO, type FoodItem, type MealLog
} from '@/lib/db';

const MONO = "'IBM Plex Mono', monospace";
const lbl: React.CSSProperties = { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--fg-muted)', margin: 0 };
const border2 = '2px solid var(--border-color)';

function haptic(ms = 10) {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
}

interface OFFProduct {
  product_name: string;
  brands?: string;
  nutriments: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
  };
}

interface SearchResult {
  name: string;
  brand: string;
  cal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
}

interface MealLogWithFood extends MealLog { food: FoodItem | null; }
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type Mode = 'log' | 'search';

function NutritionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(searchParams.get('action') === 'add' ? 'search' : 'log');
  const [logs, setLogs] = useState<MealLogWithFood[]>([]);
  const [calorieTarget, setCalorieTarget] = useState(2000);
  const [macroTargets, setMacroTargets] = useState({ protein: 150, carbs: 200, fat: 65 });

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selected food state
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [grams, setGrams] = useState('100');
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const today = todayISO();
    const [rawLogs, profile] = await Promise.all([getMealLogs(today), getProfile()]);
    setLogs(rawLogs);
    if (profile) {
      setCalorieTarget(profile.calorie_target);
      setMacroTargets(profile.macro_targets);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const doSearch = useCallback(async (q: string) => {
    setSearching(true);
    setSearchError('');
    setResults([]);
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=15&fields=product_name,brands,nutriments&lc=en&cc=za`
      );
      const data = await res.json() as { products?: OFFProduct[] };
      const products: OFFProduct[] = data.products ?? [];
      const parsed: SearchResult[] = products
        .filter(p => p.product_name?.trim() && (p.nutriments['energy-kcal_100g'] ?? 0) > 0)
        .slice(0, 10)
        .map(p => ({
          name: p.product_name.trim(),
          brand: p.brands?.trim() ?? '',
          cal100: Math.round(p.nutriments['energy-kcal_100g'] ?? 0),
          protein100: Math.round((p.nutriments.proteins_100g ?? 0) * 10) / 10,
          carbs100: Math.round((p.nutriments.carbohydrates_100g ?? 0) * 10) / 10,
          fat100: Math.round((p.nutriments.fat_100g ?? 0) * 10) / 10,
        }));
      if (parsed.length === 0) {
        setSearchError('NO RESULTS. TRY A DIFFERENT TERM.');
      } else {
        setResults(parsed);
      }
    } catch {
      setSearchError('SEARCH FAILED. CHECK CONNECTION.');
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setSearchError('');
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      doSearch(query.trim());
    }, 500);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query, doSearch]);

  const selectFood = (food: SearchResult) => {
    haptic(10);
    setSelected(food);
    setResults([]);
    setQuery('');
  };

  const clearSelected = () => {
    setSelected(null);
    setGrams('100');
  };

  // Live-calculated macros
  const g = parseFloat(grams) || 0;
  const ratio = g / 100;
  const calcCal = selected ? Math.round(selected.cal100 * ratio) : 0;
  const calcProtein = selected ? Math.round(selected.protein100 * ratio * 10) / 10 : 0;
  const calcCarbs = selected ? Math.round(selected.carbs100 * ratio * 10) / 10 : 0;
  const calcFat = selected ? Math.round(selected.fat100 * ratio * 10) / 10 : 0;

  const handleLog = async () => {
    if (!selected || g <= 0) return;
    haptic(15);
    setSaving(true);
    try {
      const foodId = await addFoodItem({
        external_id: null,
        name: selected.name,
        brand: selected.brand || null,
        barcode: null,
        serving_unit: 'g',
        serving_size: 100,
        calories: selected.cal100,
        protein: selected.protein100,
        carbs: selected.carbs100,
        fat: selected.fat100,
        is_favorite: false,
      });
      await addMealLog({
        date: todayISO(),
        meal_type: mealType,
        food_item_id: foodId,
        quantity: g,
        logged_at: new Date().toISOString(),
        source: 'search',
      });
      clearSelected();
      setQuery('');
      await loadData();
      setMode('log');
      router.replace('/nutrition');
    } catch {
      // stay on screen
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    haptic(10);
    await deleteMealLog(id);
    await loadData();
  };

  const totals = logs.reduce((acc, l) => {
    if (!l.food) return acc;
    const r = l.quantity / l.food.serving_size;
    return {
      calories: acc.calories + l.food.calories * r,
      protein: acc.protein + l.food.protein * r,
      carbs: acc.carbs + l.food.carbs * r,
      fat: acc.fat + l.food.fat * r,
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const calPct = Math.min((totals.calories / calorieTarget) * 100, 100);

  const inputStyle: React.CSSProperties = {
    width: '100%', fontFamily: MONO, fontSize: '0.875rem',
    background: 'var(--bg)', color: 'var(--fg)',
    border: '2px solid var(--border-color)',
    padding: '0.5rem 0.75rem', outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ fontFamily: MONO }}>

      {/* Header */}
      <div style={{ padding: '1rem', paddingRight: '4.5rem', borderBottom: border2, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <p style={{ ...lbl, marginBottom: '0.25rem' }}>NUTRITION</p>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--fg)' }}>EAT</h1>
        </div>
        <button
          onClick={() => {
            haptic(8);
            setMode(mode === 'search' ? 'log' : 'search');
            router.replace('/nutrition');
            clearSelected();
            setQuery('');
            setResults([]);
          }}
          style={{
            fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', padding: '0.5rem 0.75rem', border: border2,
            background: mode === 'search' ? 'var(--fg)' : 'var(--bg)',
            color: mode === 'search' ? 'var(--bg)' : 'var(--fg)',
            cursor: 'pointer', fontFamily: MONO,
          }}
        >
          {mode === 'search' ? '← BACK' : '+ ADD'}
        </button>
      </div>

      {/* Daily totals bar */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: border2, background: 'var(--bg-dark)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
          <span style={lbl}>TODAY</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>/ {calorieTarget} KCAL</span>
        </div>
        <div style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--fg)', marginBottom: '0.5rem' }}>
          {Math.round(totals.calories)}
        </div>
        <div style={{ height: 4, background: 'var(--bg)', border: '1px solid var(--border-color)', marginBottom: '0.75rem' }}>
          <div style={{ height: '100%', background: 'var(--fg)', width: `${calPct}%`, transition: 'width 600ms ease' }} />
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {[
            { label: 'PROTEIN', val: totals.protein, target: macroTargets.protein },
            { label: 'CARBS', val: totals.carbs, target: macroTargets.carbs },
            { label: 'FAT', val: totals.fat, target: macroTargets.fat },
          ].map(m => (
            <div key={m.label} style={{ flex: 1 }}>
              <p style={lbl}>{m.label}</p>
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--fg)', fontSize: '0.875rem' }}>
                {Math.round(m.val)}g
                <span style={{ color: 'var(--fg-dim)', fontSize: '0.65rem' }}> /{m.target}g</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── SEARCH MODE ── */}
      {mode === 'search' && (
        <div style={{ padding: '1rem' }}>

          {/* Selected food card */}
          {selected ? (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ border: '2px solid var(--fg)', padding: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--fg)', fontSize: '0.875rem', lineHeight: 1.3 }}>{selected.name}</p>
                    {selected.brand && <p style={{ ...lbl, marginTop: '0.2rem' }}>{selected.brand}</p>}
                  </div>
                  <button
                    onClick={clearSelected}
                    style={{ background: 'none', border: 'none', color: 'var(--fg-dim)', cursor: 'pointer', fontSize: '1rem', fontFamily: MONO, padding: '0 0 0 0.5rem' }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  {[
                    { label: 'per 100g', val: `${selected.cal100} kcal` },
                    { label: 'P', val: `${selected.protein100}g` },
                    { label: 'C', val: `${selected.carbs100}g` },
                    { label: 'F', val: `${selected.fat100}g` },
                  ].map(m => (
                    <div key={m.label}>
                      <p style={lbl}>{m.label}</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--fg-muted)' }}>{m.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quantity input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <p style={{ ...lbl, marginBottom: '0.25rem' }}>AMOUNT (GRAMS)</p>
                  <input
                    type="number"
                    value={grams}
                    onChange={e => setGrams(e.target.value)}
                    min="1"
                    placeholder="100"
                    style={inputStyle}
                    autoFocus
                  />
                </div>

                {/* Live macro preview */}
                {g > 0 && (
                  <div style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', padding: '0.75rem', display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <p style={lbl}>KCAL</p>
                      <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--fg)' }}>{calcCal}</p>
                    </div>
                    {[
                      { label: 'PROTEIN', val: calcProtein },
                      { label: 'CARBS', val: calcCarbs },
                      { label: 'FAT', val: calcFat },
                    ].map(m => (
                      <div key={m.label} style={{ flex: 1, textAlign: 'center' }}>
                        <p style={lbl}>{m.label}</p>
                        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--fg)' }}>{m.val}g</p>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <p style={{ ...lbl, marginBottom: '0.25rem' }}>MEAL</p>
                  <select value={mealType} onChange={e => setMealType(e.target.value as MealType)} style={inputStyle}>
                    <option value="breakfast">BREAKFAST</option>
                    <option value="lunch">LUNCH</option>
                    <option value="dinner">DINNER</option>
                    <option value="snack">SNACK</option>
                  </select>
                </div>

                <button
                  onClick={handleLog}
                  disabled={saving || g <= 0}
                  style={{
                    width: '100%', padding: '0.875rem', fontSize: '0.875rem', fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    background: saving ? 'var(--fg-dim)' : 'var(--fg)',
                    color: 'var(--bg)', border: border2,
                    cursor: saving ? 'not-allowed' : 'pointer', fontFamily: MONO,
                  }}
                >
                  {saving ? 'SAVING...' : `LOG ${calcCal} KCAL`}
                </button>
              </div>
            </div>
          ) : (
            /* Search input + results */
            <div>
              <p style={{ ...lbl, marginBottom: '0.5rem' }}>SEARCH FOOD</p>
              <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="TYPE TO SEARCH E.G. CHICKEN BREAST"
                  style={{ ...inputStyle, paddingRight: searching ? '2.5rem' : '0.75rem' }}
                  autoFocus
                />
                {searching && (
                  <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)', fontSize: '0.65rem', letterSpacing: '0.1em' }}>
                    ···
                  </span>
                )}
              </div>

              {searchError && (
                <p style={{ color: 'var(--fg-muted)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{searchError}</p>
              )}

              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => selectFood(r)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    width: '100%', padding: '0.75rem 0',
                    borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                    borderBottom: `1px solid var(--bg-dark)`,
                    background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: MONO,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--fg)', fontSize: '0.8rem', lineHeight: 1.3 }}>{r.name}</p>
                    {r.brand && <p style={{ ...lbl, marginTop: '0.15rem' }}>{r.brand}</p>}
                  </div>
                  <div style={{ textAlign: 'right', paddingLeft: '0.5rem' }}>
                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--fg)', fontSize: '0.875rem' }}>{r.cal100}</p>
                    <p style={lbl}>KCAL/100G</p>
                  </div>
                </button>
              ))}

              {!searching && !searchError && results.length === 0 && query.length >= 2 && (
                <p style={{ color: 'var(--fg-dim)', fontSize: '0.75rem', marginTop: '0.5rem' }}>SEARCHING...</p>
              )}

              {/* Manual fallback */}
              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--bg-dark)' }}>
                <p style={{ ...lbl, marginBottom: '0.5rem', color: 'var(--fg-dim)' }}>CAN&apos;T FIND IT?</p>
                <button
                  onClick={() => {
                    haptic(8);
                    setSelected({ name: query || 'CUSTOM FOOD', brand: '', cal100: 0, protein100: 0, carbs100: 0, fat100: 0 });
                  }}
                  style={{
                    fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
                    padding: '0.5rem 0.75rem', border: '2px solid var(--border-color)',
                    background: 'var(--bg)', color: 'var(--fg-muted)', cursor: 'pointer', fontFamily: MONO,
                  }}
                >
                  + ENTER MANUALLY
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LOG MODE ── */}
      {mode === 'log' && (
        <>
          <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--bg-dark)' }}>
            <span style={lbl}>TODAY&apos;S LOG</span>
          </div>
          {logs.length === 0 ? (
            <div style={{ padding: '2rem 1rem', color: 'var(--fg-dim)', fontSize: '0.75rem' }}>
              NOTHING LOGGED YET. TAP + ADD TO SEARCH FOOD.
            </div>
          ) : logs.map(log => {
            if (!log.food) return null;
            const r = log.quantity / log.food.serving_size;
            const cal = Math.round(log.food.calories * r);
            return (
              <div key={log.id} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: `1px solid var(--bg-dark)` }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: 'var(--fg)', fontSize: '0.875rem' }}>{log.food.name}</p>
                  <p style={{ ...lbl, marginTop: '0.2rem' }}>
                    {log.meal_type.toUpperCase()} · {log.quantity}G · {cal} KCAL
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(log.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--fg-dim)', cursor: 'pointer', fontSize: '1rem', fontFamily: MONO, padding: '0.25rem' }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

export default function NutritionPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: '#444', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' }}>LOADING...</div>}>
      <NutritionContent />
    </Suspense>
  );
}
