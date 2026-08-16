'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getMealLogs, addFoodItem, addMealLog, deleteMealLog, getProfile, todayISO, type FoodItem, type MealLog } from '@/lib/db';
import { haptic } from '@/lib/haptic';

const MONO = "'IBM Plex Mono', monospace";
const lbl = { fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: '#666', margin: 0 };
const border2 = '2px solid #2a2a2a';
const inputStyle = { width: '100%', fontFamily: MONO, fontSize: '0.875rem', background: '#080808', color: '#fff', border: '2px solid #2a2a2a', padding: '0.65rem 0.875rem', outline: 'none', boxSizing: 'border-box' as const };

interface MealLogWithFood extends MealLog { food: FoodItem | null; }
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type Mode = 'log' | 'search' | 'manual';

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

interface FoodResult {
  id: string;
  name: string;
  brand: string;
  type: string;
  isGeneric: boolean;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: number;
  serving_unit: string;
}

function getMealTypeByTime(): MealType {
  const h = new Date().getHours();
  if (h >= 5 && h < 10) return 'breakfast';
  if (h >= 10 && h < 14) return 'lunch';
  if (h >= 17 && h < 21) return 'dinner';
  return 'snack';
}

async function searchFood(query: string): Promise<FoodResult[]> {
  const res = await fetch(`/api/food-search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return data.foods ?? [];
}

function NutritionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(searchParams.get('action') === 'add' ? 'search' : 'log');
  const [logs, setLogs] = useState<MealLogWithFood[]>([]);
  const [calorieTarget, setCalorieTarget] = useState(2000);
  const [macroTargets, setMacroTargets] = useState({ protein: 150, carbs: 200, fat: 65 });

  // Search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selected, setSelected] = useState<FoodResult | null>(null);
  const [quantity, setQuantity] = useState('100');
  const [mealType, setMealType] = useState<MealType>(getMealTypeByTime());

  // Manual
  const [addName, setAddName] = useState('');
  const [addBrand, setAddBrand] = useState('');
  const [addCalories, setAddCalories] = useState('');
  const [addProtein, setAddProtein] = useState('');
  const [addCarbs, setAddCarbs] = useState('');
  const [addFat, setAddFat] = useState('');
  const [addServing, setAddServing] = useState('100');
  const [addServingUnit, setAddServingUnit] = useState('g');
  const [addQuantity, setAddQuantity] = useState('100');
  const [addMealType, setAddMealType] = useState<MealType>(getMealTypeByTime());
  const [addError, setAddError] = useState('');

  const loadData = useCallback(async () => {
    const [rawLogs, profile] = await Promise.all([getMealLogs(todayISO()), getProfile()]);
    setLogs(rawLogs);
    if (profile) { setCalorieTarget(profile.calorie_target); setMacroTargets(profile.macro_targets); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true); setSearchError(''); setResults([]); setSelected(null);
    try {
      const r = await searchFood(query.trim());
      if (r.length === 0) setSearchError('NO RESULTS. TRY A DIFFERENT NAME OR ENTER MANUALLY.');
      setResults(r);
    } catch {
      setSearchError('SEARCH FAILED. CHECK CONNECTION.');
    } finally {
      setSearching(false);
    }
  };

  const logSelected = async () => {
    if (!selected) return;
    haptic('medium');
    const qty = parseFloat(quantity) || 100;
    await addFoodItem({
      external_id: null, name: selected.name, brand: selected.brand || null,
      barcode: null, serving_unit: selected.serving_unit,
      serving_size: selected.serving_size,
      calories: selected.calories, protein: selected.protein,
      carbs: selected.carbs, fat: selected.fat, is_favorite: false,
    }).then(foodId => addMealLog({
      date: todayISO(), meal_type: mealType, food_item_id: foodId,
      quantity: qty, logged_at: new Date().toISOString(), source: 'search',
    }));
    setSelected(null); setQuery(''); setResults([]); setQuantity('100');
    await loadData();
    setMode('log');
    router.replace('/nutrition');
  };

  const handleAdd = async () => {
    setAddError('');
    if (!addName.trim()) { setAddError('NAME REQUIRED'); return; }
    if (!addCalories) { setAddError('CALORIES REQUIRED'); return; }
    haptic('medium');
    try {
      const foodId = await addFoodItem({
        external_id: null, name: addName.trim(), brand: addBrand.trim() || null,
        barcode: null, serving_unit: addServingUnit, serving_size: parseFloat(addServing) || 100,
        calories: parseFloat(addCalories) || 0, protein: parseFloat(addProtein) || 0,
        carbs: parseFloat(addCarbs) || 0, fat: parseFloat(addFat) || 0, is_favorite: false,
      });
      await addMealLog({
        date: todayISO(), meal_type: addMealType, food_item_id: foodId,
        quantity: parseFloat(addQuantity) || 100, logged_at: new Date().toISOString(), source: 'manual',
      });
      setAddName(''); setAddBrand(''); setAddCalories(''); setAddProtein('');
      setAddCarbs(''); setAddFat(''); setAddServing('100'); setAddQuantity('100');
      await loadData(); setMode('log'); router.replace('/nutrition');
    } catch { setAddError('FAILED TO SAVE. TRY AGAIN.'); }
  };

  const handleDelete = async (id: number) => { haptic('light'); await deleteMealLog(id); await loadData(); };

  const totals = logs.reduce((acc, l) => {
    if (!l.food) return acc;
    const r = l.quantity / l.food.serving_size;
    return { calories: acc.calories + l.food.calories * r, protein: acc.protein + l.food.protein * r, carbs: acc.carbs + l.food.carbs * r, fat: acc.fat + l.food.fat * r };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const calPct = Math.min((totals.calories / calorieTarget) * 100, 100);

  // Live macro preview — correctly scaled by serving_size
  const qty = parseFloat(quantity) || 100;
  const ratio = selected ? qty / selected.serving_size : 0;
  const previewCal = selected ? Math.round(selected.calories * ratio) : 0;
  const previewProtein = selected ? Math.round(selected.protein * ratio * 10) / 10 : 0;
  const previewCarbs = selected ? Math.round(selected.carbs * ratio * 10) / 10 : 0;
  const previewFat = selected ? Math.round(selected.fat * ratio * 10) / 10 : 0;

  // Group logs by meal type
  const logsByMeal = MEAL_ORDER.reduce((acc, meal) => {
    acc[meal] = logs.filter(l => l.meal_type === meal);
    return acc;
  }, {} as Record<MealType, MealLogWithFood[]>);

  const mealTotals = (mealLogs: MealLogWithFood[]) =>
    mealLogs.reduce((acc, l) => {
      if (!l.food) return acc;
      const r = l.quantity / l.food.serving_size;
      return { cal: acc.cal + l.food.calories * r, p: acc.p + l.food.protein * r };
    }, { cal: 0, p: 0 });

  return (
    <div style={{ fontFamily: MONO, paddingTop: '4rem' }}>

      {/* Header */}
      <div style={{ padding: '1.25rem', borderBottom: border2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ ...lbl, marginBottom: '0.3rem' }}>NUTRITION</p>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>EAT</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {mode !== 'log' ? (
            <button onClick={() => { setMode('log'); setSelected(null); setResults([]); router.replace('/nutrition'); }}
              style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', padding: '0.5rem 0.875rem', border: border2, background: '#fff', color: '#000', cursor: 'pointer', fontFamily: MONO }}>
              ← BACK
            </button>
          ) : (
            <>
              <button onClick={() => { haptic('light'); setMode('search'); }}
                style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', padding: '0.5rem 0.875rem', border: border2, background: '#000', color: '#fff', cursor: 'pointer', fontFamily: MONO }}>
                SEARCH
              </button>
              <button onClick={() => { haptic('light'); setMode('manual'); }}
                style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', padding: '0.5rem 0.875rem', border: '2px solid #1a1a1a', background: '#000', color: '#444', cursor: 'pointer', fontFamily: MONO }}>
                MANUAL
              </button>
            </>
          )}
        </div>
      </div>

      {/* Totals */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: border2, background: '#060606' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
          <span style={lbl}>TODAY</span>
          <span style={{ fontSize: '0.65rem', color: '#333' }}>/ {calorieTarget.toLocaleString()} KCAL</span>
        </div>
        <div style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff', marginBottom: '0.5rem' }}>
          {Math.round(totals.calories)}
        </div>
        <div style={{ height: 3, background: '#111', marginBottom: '0.875rem' }}>
          <div style={{ height: '100%', background: '#fff', width: `${calPct}%`, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {[{ label: 'PROTEIN', val: totals.protein, target: macroTargets.protein },
            { label: 'CARBS',   val: totals.carbs,   target: macroTargets.carbs },
            { label: 'FAT',     val: totals.fat,      target: macroTargets.fat }].map(m => (
            <div key={m.label} style={{ flex: 1 }}>
              <p style={lbl}>{m.label}</p>
              <p style={{ margin: '0.2rem 0 0', fontWeight: 700, color: '#fff', fontSize: '0.875rem' }}>
                {Math.round(m.val)}g
                <span style={{ color: '#333', fontSize: '0.6rem' }}> /{m.target}g</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── SEARCH MODE ── */}
      {mode === 'search' && (
        <div>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1a1a1a' }}>
            <p style={{ ...lbl, marginBottom: '0.5rem' }}>SEARCH FOOD</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="E.G. CHICKEN BREAST, APPLE..."
                style={{ ...inputStyle, flex: 1 }}
                autoFocus
              />
              <button
                onClick={doSearch}
                disabled={searching}
                style={{ padding: '0.65rem 1rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', background: '#fff', color: '#000', border: border2, cursor: 'pointer', fontFamily: MONO, whiteSpace: 'nowrap' }}
              >
                {searching ? '...' : 'GO'}
              </button>
            </div>
            {searchError && <p style={{ ...lbl, marginTop: '0.5rem', color: '#555' }}>{searchError}</p>}
          </div>

          {/* Results */}
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => { haptic('light'); setSelected(r); setQuery(r.name); setResults([]); }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0.875rem 1.25rem', background: '#000', border: 'none', borderBottom: '1px solid #111', cursor: 'pointer', textAlign: 'left', fontFamily: MONO }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '0.875rem' }}>{r.name}</p>
                <p style={{ ...lbl, marginTop: '0.1rem', color: '#333' }}>{r.serving_size}{r.serving_unit} · {r.protein}g P · {r.carbs}g C · {r.fat}g F</p>
              </div>
              <p style={{ margin: 0, fontWeight: 700, color: '#F5A623', fontSize: '0.875rem', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                {r.calories} kcal
              </p>
            </button>
          ))}

          {/* Can't find it */}
          {!searching && (results.length > 0 || searchError) && (
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #111' }}>
              <p style={{ ...lbl, marginBottom: '0.5rem', color: '#333' }}>CAN&apos;T FIND IT?</p>
              <button onClick={() => setMode('manual')}
                style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', padding: '0.5rem 0.875rem', border: border2, background: '#000', color: '#666', cursor: 'pointer', fontFamily: MONO }}>
                + ENTER MANUALLY
              </button>
            </div>
          )}

          {/* Selected food — log it */}
          {selected && (
            <div style={{ padding: '1.25rem', borderTop: border2, background: '#060606' }}>
              <p style={{ ...lbl, marginBottom: '0.75rem' }}>LOG: {selected.name.toUpperCase()}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div>
                  <p style={{ ...lbl, marginBottom: '0.35rem' }}>QUANTITY ({selected.serving_unit})</p>
                  <input
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <p style={{ ...lbl, marginBottom: '0.35rem' }}>MEAL TYPE</p>
                  <select value={mealType} onChange={e => setMealType(e.target.value as MealType)} style={inputStyle}>
                    <option value="breakfast">BREAKFAST</option>
                    <option value="lunch">LUNCH</option>
                    <option value="dinner">DINNER</option>
                    <option value="snack">SNACK</option>
                  </select>
                </div>
              </div>
              {/* Live macro preview */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.875rem', padding: '0.75rem', background: '#111', border: '1px solid #1a1a1a' }}>
                <div><p style={lbl}>KCAL</p><p style={{ margin: 0, fontWeight: 700, color: '#F5A623' }}>{previewCal}</p></div>
                <div><p style={lbl}>PROTEIN</p><p style={{ margin: 0, fontWeight: 700, color: '#fff' }}>{previewProtein}g</p></div>
                <div><p style={lbl}>CARBS</p><p style={{ margin: 0, fontWeight: 700, color: '#fff' }}>{previewCarbs}g</p></div>
                <div><p style={lbl}>FAT</p><p style={{ margin: 0, fontWeight: 700, color: '#fff' }}>{previewFat}g</p></div>
              </div>
              <button onClick={logSelected}
                style={{ width: '100%', padding: '0.875rem', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', background: '#fff', color: '#000', border: border2, cursor: 'pointer', fontFamily: MONO }}>
                LOG THIS →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MANUAL MODE ── */}
      {mode === 'manual' && (
        <div style={{ padding: '1.25rem' }}>
          <p style={{ ...lbl, marginBottom: '1rem' }}>ADD MANUALLY</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {addError && <p style={{ margin: 0, color: '#fff', background: '#111', border: '1px solid #333', padding: '0.5rem', fontSize: '0.75rem' }}>⚠ {addError}</p>}
            <div><p style={{ ...lbl, marginBottom: '0.35rem' }}>NAME *</p><input value={addName} onChange={e => setAddName(e.target.value)} placeholder="E.G. CHICKEN BREAST" style={inputStyle} /></div>
            <div><p style={{ ...lbl, marginBottom: '0.35rem' }}>BRAND (OPTIONAL)</p><input value={addBrand} onChange={e => setAddBrand(e.target.value)} placeholder="E.G. WOOLWORTHS" style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div><p style={{ ...lbl, marginBottom: '0.35rem' }}>SERVING SIZE</p><input type="number" value={addServing} onChange={e => setAddServing(e.target.value)} style={inputStyle} /></div>
              <div><p style={{ ...lbl, marginBottom: '0.35rem' }}>UNIT</p>
                <select value={addServingUnit} onChange={e => setAddServingUnit(e.target.value)} style={inputStyle}>
                  <option value="g">g</option><option value="ml">ml</option><option value="oz">oz</option><option value="cup">cup</option><option value="piece">piece</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div><p style={{ ...lbl, marginBottom: '0.35rem' }}>CALORIES *</p><input type="number" value={addCalories} onChange={e => setAddCalories(e.target.value)} placeholder="0" style={inputStyle} /></div>
              <div><p style={{ ...lbl, marginBottom: '0.35rem' }}>PROTEIN (G)</p><input type="number" value={addProtein} onChange={e => setAddProtein(e.target.value)} placeholder="0" style={inputStyle} /></div>
              <div><p style={{ ...lbl, marginBottom: '0.35rem' }}>CARBS (G)</p><input type="number" value={addCarbs} onChange={e => setAddCarbs(e.target.value)} placeholder="0" style={inputStyle} /></div>
              <div><p style={{ ...lbl, marginBottom: '0.35rem' }}>FAT (G)</p><input type="number" value={addFat} onChange={e => setAddFat(e.target.value)} placeholder="0" style={inputStyle} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div><p style={{ ...lbl, marginBottom: '0.35rem' }}>QUANTITY</p><input type="number" value={addQuantity} onChange={e => setAddQuantity(e.target.value)} min="0.1" step="0.1" style={inputStyle} /></div>
              <div><p style={{ ...lbl, marginBottom: '0.35rem' }}>MEAL TYPE</p>
                <select value={addMealType} onChange={e => setAddMealType(e.target.value as MealType)} style={inputStyle}>
                  <option value="breakfast">BREAKFAST</option><option value="lunch">LUNCH</option><option value="dinner">DINNER</option><option value="snack">SNACK</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button onClick={handleAdd} style={{ flex: 1, padding: '0.875rem', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', background: '#fff', color: '#000', border: border2, cursor: 'pointer', fontFamily: MONO }}>SAVE & LOG</button>
              <button onClick={() => setMode('log')} style={{ flex: 1, padding: '0.875rem', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', background: '#000', color: '#444', border: '2px solid #1a1a1a', cursor: 'pointer', fontFamily: MONO }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOG MODE — grouped by meal ── */}
      {mode === 'log' && (
        <>
          {logs.length === 0 ? (
            <div style={{ padding: '2.5rem 1.25rem' }}>
              <p style={{ ...lbl, color: '#222', marginBottom: '0.5rem' }}>NOTHING LOGGED YET</p>
              <button onClick={() => setMode('search')} style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', color: '#555', background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, textDecoration: 'underline' }}>
                SEARCH FOR FOOD →
              </button>
            </div>
          ) : MEAL_ORDER.map(meal => {
            const mealLogs = logsByMeal[meal];
            if (mealLogs.length === 0) return null;
            const { cal, p } = mealTotals(mealLogs);
            return (
              <div key={meal}>
                {/* Meal section header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.6rem 1.25rem', background: '#060606', borderBottom: '1px solid #1a1a1a', borderTop: border2 }}>
                  <span style={{ ...lbl, color: '#fff' }}>{meal.toUpperCase()}</span>
                  <span style={{ fontSize: '0.6rem', color: '#333', fontFamily: MONO }}>{Math.round(cal)} KCAL · {Math.round(p)}G P</span>
                </div>
                {mealLogs.map(log => {
                  if (!log.food) return null;
                  const r = log.quantity / log.food.serving_size;
                  const cal = Math.round(log.food.calories * r);
                  return (
                    <div key={log.id} style={{ display: 'flex', alignItems: 'center', padding: '0.875rem 1.25rem', borderBottom: '1px solid #111' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '0.875rem' }}>{log.food.name}</p>
                        <p style={{ ...lbl, marginTop: '0.2rem' }}>{log.quantity}{log.food.serving_unit} · <span style={{ color: '#F5A623' }}>{cal} KCAL</span> · {Math.round(log.food.protein * r * 10) / 10}G P</p>
                      </div>
                      <button onClick={() => handleDelete(log.id)} style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: '1rem', fontFamily: MONO, padding: '0.25rem' }}>✕</button>
                    </div>
                  );
                })}
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
