'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  getMealLogs, addFoodItem, addMealLog, deleteMealLog,
  getProfile, getRecentFoods, todayISO,
  type FoodItem, type MealLog,
} from '@/lib/db';
import { haptic } from '@/lib/haptic';

// ─── Design tokens ────────────────────────────────────────────────────────────
const MONO = "'IBM Plex Mono', monospace";
const lbl = {
  fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em',
  textTransform: 'uppercase' as const, color: '#555', margin: 0,
};
const B2 = '2px solid #222';
const B1 = '1px solid #161616';
const BG = '#000';
const SURFACE = '#070707';
const ACCENT = { cal: '#fff', protein: '#e8ff00', carbs: '#4af', fat: '#f70' };

const inputStyle = {
  width: '100%', fontFamily: MONO, fontSize: '0.875rem',
  background: '#0a0a0a', color: '#fff', border: B2,
  padding: '0.65rem 0.875rem', outline: 'none', boxSizing: 'border-box' as const,
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface MealLogWithFood extends MealLog { food: FoodItem | null; }
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type Mode = 'log' | 'search' | 'manual';

interface FoodResult {
  id: string; name: string; brand: string; isGeneric: boolean;
  calories: number; protein: number; carbs: number; fat: number;
  serving_size: number; serving_unit: string;
}

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'BREAKFAST', lunch: 'LUNCH', dinner: 'DINNER', snack: 'SNACKS',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function searchFood(query: string): Promise<FoodResult[]> {
  const res = await fetch(`/api/food-search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return data.foods ?? [];
}

function calcTotals(logs: MealLogWithFood[]) {
  return logs.reduce((acc, l) => {
    if (!l.food) return acc;
    const r = l.quantity / l.food.serving_size;
    return {
      calories: acc.calories + l.food.calories * r,
      protein:  acc.protein  + l.food.protein  * r,
      carbs:    acc.carbs    + l.food.carbs    * r,
      fat:      acc.fat      + l.food.fat      * r,
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// ─── MacroBar ─────────────────────────────────────────────────────────────────
function MacroBar({ label, value, target, color }: {
  label: string; value: number; target: number; color: string;
}) {
  const pct = Math.min((value / target) * 100, 100);
  const over = value > target;
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
        <span style={{ ...lbl, color: '#444' }}>{label}</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, fontFamily: MONO, color: over ? '#f44' : '#fff' }}>
          {Math.round(value)}<span style={{ color: '#333', fontWeight: 400 }}>/{target}g</span>
        </span>
      </div>
      <div style={{ height: 2, background: '#111', position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${pct}%`, background: over ? '#f44' : color,
          transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  );
}

// ─── MealGroup ────────────────────────────────────────────────────────────────
function MealGroup({ type, logs, onDelete, onAdd }: {
  type: MealType; logs: MealLogWithFood[];
  onDelete: (id: number) => void; onAdd: (type: MealType) => void;
}) {
  const totals = calcTotals(logs);
  const cal = Math.round(totals.calories);

  return (
    <div style={{ borderBottom: B2 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.6rem 1.25rem', background: SURFACE,
        borderBottom: logs.length > 0 ? B1 : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ ...lbl, color: '#444' }}>{MEAL_LABELS[type]}</span>
          {cal > 0 && (
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#fff', fontFamily: MONO }}>
              {cal} kcal
            </span>
          )}
        </div>
        <button onClick={() => onAdd(type)} style={{
          background: 'none', border: '1px solid #222', color: '#444',
          fontFamily: MONO, fontSize: '0.6rem', fontWeight: 700,
          letterSpacing: '0.1em', padding: '0.25rem 0.5rem', cursor: 'pointer',
        }}>+ ADD</button>
      </div>

      {logs.map(log => {
        if (!log.food) return null;
        const r = log.quantity / log.food.serving_size;
        const logCal = Math.round(log.food.calories * r);
        const logProt = Math.round(log.food.protein * r * 10) / 10;
        return (
          <div key={log.id} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1.25rem', borderBottom: B1 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0, fontWeight: 700, color: '#fff', fontSize: '0.8rem', fontFamily: MONO,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{log.food.name}</p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.2rem' }}>
                <span style={{ ...lbl, color: ACCENT.cal }}>{logCal} kcal</span>
                <span style={{ ...lbl, color: ACCENT.protein }}>P {logProt}g</span>
                <span style={lbl}>{log.quantity}{log.food.serving_unit}</span>
              </div>
            </div>
            <button onClick={() => { haptic('light'); onDelete(log.id); }}
              style={{ background: 'none', border: 'none', color: '#2a2a2a', cursor: 'pointer', fontSize: '0.9rem', fontFamily: MONO, padding: '0.25rem 0.25rem 0.25rem 0.75rem' }}>
              ✕
            </button>
          </div>
        );
      })}

      {logs.length === 0 && (
        <div style={{ padding: '0.6rem 1.25rem' }}>
          <span style={{ ...lbl, color: '#1a1a1a' }}>— NOTHING LOGGED</span>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function NutritionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>(searchParams.get('action') === 'add' ? 'search' : 'log');
  const [activeMealType, setActiveMealType] = useState<MealType>('lunch');
  const [logs, setLogs] = useState<MealLogWithFood[]>([]);
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]);
  const [calorieTarget, setCalorieTarget] = useState(2000);
  const [macroTargets, setMacroTargets] = useState({ protein: 150, carbs: 200, fat: 65 });

  // Search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selected, setSelected] = useState<FoodResult | null>(null);
  const [quantity, setQuantity] = useState('100');
  const [mealType, setMealType] = useState<MealType>('lunch');

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
  const [addMealType, setAddMealType] = useState<MealType>('lunch');
  const [addError, setAddError] = useState('');

  const load = useCallback(async () => {
    const [rawLogs, profile, recents] = await Promise.all([
      getMealLogs(todayISO()),
      getProfile(),
      getRecentFoods(8),
    ]);
    setLogs(rawLogs);
    setRecentFoods(recents);
    if (profile) {
      setCalorieTarget(profile.calorie_target);
      setMacroTargets(profile.macro_targets);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = MEAL_ORDER.reduce((acc, mt) => {
    acc[mt] = logs.filter(l => l.meal_type === mt);
    return acc;
  }, {} as Record<MealType, MealLogWithFood[]>);

  const totals = calcTotals(logs);
  const remaining = Math.round(calorieTarget - totals.calories);
  const isOver = remaining < 0;
  const isClose = !isOver && remaining < calorieTarget * 0.1;
  const heroColor = isOver ? '#f44' : isClose ? '#f70' : '#fff';
  const calPct = Math.min((totals.calories / calorieTarget) * 100, 100);

  const openAdd = (mt: MealType) => {
    setActiveMealType(mt);
    setMealType(mt);
    setAddMealType(mt);
    setMode('search');
    setSelected(null);
    setResults([]);
    setQuery('');
  };

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true); setSearchError(''); setResults([]); setSelected(null);
    try {
      const r = await searchFood(query.trim());
      if (r.length === 0) setSearchError('NO RESULTS. TRY A DIFFERENT NAME OR ADD MANUALLY.');
      setResults(r);
    } catch { setSearchError('SEARCH FAILED. CHECK CONNECTION.'); }
    finally { setSearching(false); }
  };

  const logFoodItem = async (food: FoodItem, qty: number, mt: MealType) => {
    haptic('medium');
    await addMealLog({
      date: todayISO(), meal_type: mt, food_item_id: food.id,
      quantity: qty, logged_at: new Date().toISOString(), source: 'search',
    });
    await load(); setMode('log'); router.replace('/nutrition');
  };

  const logFoodResult = async (food: FoodResult, qty: number, mt: MealType) => {
    haptic('medium');
    const foodId = await addFoodItem({
      external_id: null, name: food.name, brand: food.brand || null,
      barcode: null, serving_unit: food.serving_unit, serving_size: food.serving_size,
      calories: food.calories, protein: food.protein,
      carbs: food.carbs, fat: food.fat, is_favorite: false,
    });
    await addMealLog({
      date: todayISO(), meal_type: mt, food_item_id: foodId,
      quantity: qty, logged_at: new Date().toISOString(), source: 'search',
    });
    setSelected(null); setQuery(''); setResults([]); setQuantity('100');
    await load(); setMode('log'); router.replace('/nutrition');
  };

  const handleManualAdd = async () => {
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
      await load(); setMode('log'); router.replace('/nutrition');
    } catch { setAddError('FAILED TO SAVE.'); }
  };

  const qty = parseFloat(quantity) || 100;
  const previewCal  = selected ? Math.round(selected.calories * qty / selected.serving_size) : 0;
  const previewProt = selected ? Math.round(selected.protein  * qty / selected.serving_size * 10) / 10 : 0;
  const previewCarb = selected ? Math.round(selected.carbs    * qty / selected.serving_size * 10) / 10 : 0;
  const previewFat  = selected ? Math.round(selected.fat      * qty / selected.serving_size * 10) / 10 : 0;

  const btnBase = {
    fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em',
    padding: '0.5rem 0.875rem', cursor: 'pointer', fontFamily: MONO,
  };

  return (
    <div style={{ fontFamily: MONO, paddingTop: '4rem', background: BG, minHeight: '100vh' }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '1.25rem', borderBottom: B2, background: SURFACE }}>

        {/* Title + actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <p style={{ ...lbl, marginBottom: '0.3rem', color: '#333' }}>NUTRITION</p>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>FUEL</h1>
          </div>
          {mode !== 'log' ? (
            <button onClick={() => { setMode('log'); setSelected(null); setResults([]); router.replace('/nutrition'); }}
              style={{ ...btnBase, border: B2, background: '#fff', color: '#000' }}>
              ← BACK
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { haptic('light'); openAdd('lunch'); }}
                style={{ ...btnBase, border: B2, background: BG, color: '#fff' }}>
                + SEARCH
              </button>
              <button onClick={() => { haptic('light'); setMode('manual'); }}
                style={{ ...btnBase, border: '2px solid #161616', background: BG, color: '#333' }}>
                MANUAL
              </button>
            </div>
          )}
        </div>

        {/* Hero: remaining calories */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <span style={{ fontSize: '3rem', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: heroColor, transition: 'color 0.4s ease' }}>
              {Math.abs(remaining)}
            </span>
            <span style={{ ...lbl, color: heroColor, fontSize: '0.65rem' }}>
              KCAL {isOver ? 'OVER' : 'REMAINING'}
            </span>
          </div>
          <div style={{ height: 3, background: '#111', marginBottom: '0.5rem', position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${calPct}%`, background: heroColor,
              transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ ...lbl, color: '#444' }}>{Math.round(totals.calories)} consumed</span>
            <span style={{ ...lbl, color: '#333' }}>{calorieTarget} target</span>
          </div>
        </div>

        {/* Macro bars */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <MacroBar label="PROTEIN" value={totals.protein} target={macroTargets.protein} color={ACCENT.protein} />
          <MacroBar label="CARBS"   value={totals.carbs}   target={macroTargets.carbs}   color={ACCENT.carbs} />
          <MacroBar label="FAT"     value={totals.fat}     target={macroTargets.fat}      color={ACCENT.fat} />
        </div>
      </div>

      {/* ── SEARCH MODE ────────────────────────────────────────────────────── */}
      {mode === 'search' && (
        <div>
          {/* Meal type tabs */}
          <div style={{ display: 'flex', borderBottom: B2 }}>
            {MEAL_ORDER.map(mt => (
              <button key={mt} onClick={() => { setMealType(mt); setActiveMealType(mt); setAddMealType(mt); }}
                style={{
                  flex: 1, padding: '0.5rem 0.25rem', fontSize: '0.55rem', fontWeight: 700,
                  letterSpacing: '0.12em', textTransform: 'uppercase' as const,
                  border: 'none', background: BG, cursor: 'pointer', fontFamily: MONO,
                  color: mealType === mt ? '#fff' : '#333',
                  borderBottom: `2px solid ${mealType === mt ? '#fff' : 'transparent'}`,
                }}>
                {MEAL_LABELS[mt].slice(0, 5)}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: B2 }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="SEARCH FOOD..."
                style={{ ...inputStyle, flex: 1 }}
                autoFocus
              />
              <button onClick={doSearch} disabled={searching}
                style={{ padding: '0.65rem 1rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', background: '#fff', color: '#000', border: B2, cursor: 'pointer', fontFamily: MONO, whiteSpace: 'nowrap' as const }}>
                {searching ? '···' : 'GO'}
              </button>
            </div>
            {searchError && <p style={{ ...lbl, marginTop: '0.5rem', color: '#444' }}>{searchError}</p>}
          </div>

          {/* Recent foods */}
          {results.length === 0 && !selected && recentFoods.length > 0 && (
            <div>
              <div style={{ padding: '0.6rem 1.25rem', borderBottom: B1, background: SURFACE }}>
                <span style={{ ...lbl, color: '#333' }}>RECENT</span>
              </div>
              {recentFoods.map(food => (
                <button key={food.id} onClick={() => logFoodItem(food, food.serving_size, activeMealType)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    width: '100%', padding: '0.75rem 1.25rem', background: BG,
                    border: 'none', borderBottom: B1, cursor: 'pointer', textAlign: 'left' as const, fontFamily: MONO,
                  }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '0.8rem' }}>{food.name}</p>
                    <p style={{ ...lbl, marginTop: '0.15rem', color: '#333' }}>
                      {food.calories} kcal · {food.serving_size}{food.serving_unit}
                    </p>
                  </div>
                  <span style={{ color: '#333', fontSize: '1rem' }}>+</span>
                </button>
              ))}
            </div>
          )}

          {/* Search results */}
          {results.map((r, i) => (
            <button key={i} onClick={() => { haptic('light'); setSelected(r); setResults([]); }}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '0.875rem 1.25rem', background: BG,
                border: 'none', borderBottom: B1, cursor: 'pointer', textAlign: 'left' as const, fontFamily: MONO,
              }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.1rem' }}>
                  <p style={{ margin: 0, fontWeight: 700, color: r.isGeneric ? '#fff' : '#888', fontSize: '0.8rem' }}>{r.name}</p>
                  {r.isGeneric && <span style={{ fontSize: '0.45rem', fontWeight: 700, letterSpacing: '0.15em', color: ACCENT.protein, border: `1px solid ${ACCENT.protein}`, padding: '0.1rem 0.3rem' }}>WHOLE</span>}
                </div>
                {r.brand && <p style={{ ...lbl, color: '#2a2a2a' }}>{r.brand}</p>}
              </div>
              <p style={{ margin: 0, fontWeight: 700, color: r.isGeneric ? ACCENT.cal : '#555', fontSize: '0.875rem', whiteSpace: 'nowrap' as const, marginLeft: '1rem' }}>
                {r.calories} kcal
              </p>
            </button>
          ))}

          {!searching && (results.length > 0 || searchError) && !selected && (
            <div style={{ padding: '1rem 1.25rem' }}>
              <button onClick={() => setMode('manual')}
                style={{ ...btnBase, border: B2, background: BG, color: '#444' }}>
                + ENTER MANUALLY
              </button>
            </div>
          )}

          {/* Selected food — log panel */}
          {selected && (
            <div style={{ padding: '1.25rem', background: SURFACE, borderTop: B2 }}>
              <p style={{ ...lbl, marginBottom: '0.75rem' }}>LOG: {selected.name.toUpperCase()}</p>

              {/* Quick quantity presets */}
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
                {['50', '100', '150', '200'].map(q => (
                  <button key={q} onClick={() => setQuantity(q)}
                    style={{
                      flex: 1, padding: '0.4rem', fontSize: '0.6rem', fontWeight: 700,
                      letterSpacing: '0.1em', fontFamily: MONO, cursor: 'pointer',
                      border: B2, background: quantity === q ? '#fff' : BG,
                      color: quantity === q ? '#000' : '#444',
                    }}>
                    {q}g
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div>
                  <p style={{ ...lbl, marginBottom: '0.35rem' }}>QUANTITY (G)</p>
                  <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <p style={{ ...lbl, marginBottom: '0.35rem' }}>MEAL</p>
                  <select value={mealType} onChange={e => setMealType(e.target.value as MealType)} style={inputStyle}>
                    {MEAL_ORDER.map(mt => <option key={mt} value={mt}>{MEAL_LABELS[mt]}</option>)}
                  </select>
                </div>
              </div>

              {/* Macro preview */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.875rem', padding: '0.75rem', background: '#0d0d0d', border: '1px solid #161616' }}>
                <div><p style={lbl}>KCAL</p><p style={{ margin: 0, fontWeight: 700, color: ACCENT.cal }}>{previewCal}</p></div>
                <div><p style={lbl}>PROTEIN</p><p style={{ margin: 0, fontWeight: 700, color: ACCENT.protein }}>{previewProt}g</p></div>
                <div><p style={lbl}>CARBS</p><p style={{ margin: 0, fontWeight: 700, color: ACCENT.carbs }}>{previewCarb}g</p></div>
                <div><p style={lbl}>FAT</p><p style={{ margin: 0, fontWeight: 700, color: ACCENT.fat }}>{previewFat}g</p></div>
              </div>

              <button onClick={() => logFoodResult(selected, qty, mealType)}
                style={{ width: '100%', padding: '0.875rem', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', background: '#fff', color: '#000', border: B2, cursor: 'pointer', fontFamily: MONO }}>
                LOG →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MANUAL MODE ────────────────────────────────────────────────────── */}
      {mode === 'manual' && (
        <div style={{ padding: '1.25rem' }}>
          <p style={{ ...lbl, marginBottom: '1rem' }}>ADD MANUALLY</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {addError && <p style={{ margin: 0, color: '#fff', background: '#111', border: '1px solid #333', padding: '0.5rem', fontSize: '0.75rem' }}>⚠ {addError}</p>}
            <div><p style={{ ...lbl, marginBottom: '0.35rem' }}>NAME *</p><input value={addName} onChange={e => setAddName(e.target.value)} placeholder="E.G. BOEREWORS" style={inputStyle} /></div>
            <div><p style={{ ...lbl, marginBottom: '0.35rem' }}>BRAND (OPTIONAL)</p><input value={addBrand} onChange={e => setAddBrand(e.target.value)} placeholder="E.G. WOOLWORTHS" style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div><p style={{ ...lbl, marginBottom: '0.35rem' }}>SERVING SIZE</p><input type="number" value={addServing} onChange={e => setAddServing(e.target.value)} style={inputStyle} /></div>
              <div><p style={{ ...lbl, marginBottom: '0.35rem' }}>UNIT</p>
                <select value={addServingUnit} onChange={e => setAddServingUnit(e.target.value)} style={inputStyle}>
                  <option value="g">g</option><option value="ml">ml</option><option value="oz">oz</option>
                  <option value="cup">cup</option><option value="piece">piece</option>
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
              <div><p style={{ ...lbl, marginBottom: '0.35rem' }}>MEAL</p>
                <select value={addMealType} onChange={e => setAddMealType(e.target.value as MealType)} style={inputStyle}>
                  {MEAL_ORDER.map(mt => <option key={mt} value={mt}>{MEAL_LABELS[mt]}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button onClick={handleManualAdd} style={{ flex: 1, padding: '0.875rem', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', background: '#fff', color: '#000', border: B2, cursor: 'pointer', fontFamily: MONO }}>SAVE & LOG</button>
              <button onClick={() => setMode('log')} style={{ flex: 1, padding: '0.875rem', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', background: BG, color: '#333', border: '2px solid #161616', cursor: 'pointer', fontFamily: MONO }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOG MODE: meal groups ───────────────────────────────────────────── */}
      {mode === 'log' && (
        <div>
          {logs.length === 0 && (
            <div style={{ padding: '2.5rem 1.25rem', textAlign: 'center' as const }}>
              <p style={{ ...lbl, color: '#1e1e1e', marginBottom: '1rem' }}>NOTHING LOGGED TODAY</p>
              <button onClick={() => openAdd('breakfast')}
                style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', color: '#444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, textDecoration: 'underline' }}>
                LOG FIRST MEAL →
              </button>
            </div>
          )}
          {MEAL_ORDER.map(mt => (
            <MealGroup key={mt} type={mt} logs={grouped[mt]} onDelete={async (id) => { haptic('light'); await deleteMealLog(id); await load(); }} onAdd={openAdd} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NutritionPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: '#333', fontFamily: MONO, fontSize: '0.75rem' }}>LOADING...</div>}>
      <NutritionContent />
    </Suspense>
  );
}
