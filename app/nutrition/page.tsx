'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  getMealLogs, addFoodItem, addMealLog, deleteMealLog,
  getProfile, getRecentFoods, todayISO,
  type FoodItem, type MealLog,
} from '@/lib/db';
import { haptic } from '@/lib/haptic';

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
        <span className="label">{label}</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: over ? 'var(--red)' : 'var(--text-primary)' }}>
          {Math.round(value)}<span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>/{target}g</span>
        </span>
      </div>
      <div className="progress">
        <div
          className="progress-fill"
          style={{ width: `${pct}%`, background: over ? 'var(--red)' : color }}
        />
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
    <div style={{ borderBottom: '2px solid var(--border-2)' }}>
      {/* Group header */}
      <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="label" style={{ color: 'var(--text-secondary)' }}>{MEAL_LABELS[type]}</span>
          {cal > 0 && (
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {cal} kcal
            </span>
          )}
        </div>
        <button className="btn btn-sm btn-ghost" onClick={() => onAdd(type)}>
          + ADD
        </button>
      </div>

      {/* Food rows */}
      {logs.map(log => {
        if (!log.food) return null;
        const r = log.quantity / log.food.serving_size;
        const logCal  = Math.round(log.food.calories * r);
        const logProt = Math.round(log.food.protein  * r * 10) / 10;
        return (
          <div key={log.id} className="row" style={{ cursor: 'default' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0, fontWeight: 700, color: 'var(--text-primary)',
                fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{log.food.name}</p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', alignItems: 'center' }}>
                <span className="label" style={{ color: 'var(--amber)' }}>{logCal} kcal</span>
                <span className="label" style={{ color: 'var(--amber)' }}>P {logProt}g</span>
                <span className="label">{log.quantity}{log.food.serving_unit}</span>
              </div>
            </div>
            <button
              onClick={() => { haptic('light'); onDelete(log.id); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-ghost)', cursor: 'pointer', fontSize: '0.9rem', padding: '0.25rem 0.25rem 0.25rem 0.75rem' }}
            >✕</button>
          </div>
        );
      })}

      {logs.length === 0 && (
        <div style={{ padding: '0.6rem var(--page-pad)' }}>
          <span className="label" style={{ color: 'var(--text-ghost)' }}>— NOTHING LOGGED</span>
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
  const heroColor = isOver ? 'var(--red)' : isClose ? 'var(--yellow)' : 'var(--amber)';
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
      const name = addName.trim();
      const calories = parseFloat(addCalories) || 0;
      const protein  = parseFloat(addProtein)  || 0;
      const carbs    = parseFloat(addCarbs)    || 0;
      const fat      = parseFloat(addFat)      || 0;
      const serving  = parseFloat(addServing)  || 100;

      const foodId = await addFoodItem({
        external_id: null, name, brand: addBrand.trim() || null,
        barcode: null, serving_unit: addServingUnit, serving_size: serving,
        calories, protein, carbs, fat, is_favorite: false,
      });
      await addMealLog({
        date: todayISO(), meal_type: addMealType, food_item_id: foodId,
        quantity: parseFloat(addQuantity) || 100, logged_at: new Date().toISOString(), source: 'manual',
      });

      // Sync to shared sa_foods DB in the background — fire and forget
      fetch('/api/food-contribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, calories, protein, carbs, fat, serving_size: serving, serving_unit: addServingUnit }),
      }).catch(() => {}); // silent — local log always succeeds regardless

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

  return (
    <div className="page" style={{ paddingTop: '4rem' }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="page-header">
        {/* Title + actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <p className="label" style={{ marginBottom: '0.3rem' }}>NUTRITION</p>
            <h1 className="page-title">FUEL</h1>
          </div>
          {mode !== 'log' ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setMode('log'); setSelected(null); setResults([]); router.replace('/nutrition'); }}
            >
              ← BACK
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary btn-sm" onClick={() => { haptic('light'); openAdd('lunch'); }}>
                + SEARCH
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { haptic('light'); setMode('manual'); }}>
                MANUAL
              </button>
            </div>
          )}
        </div>

        {/* Hero: remaining calories */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p className="label" style={{ marginBottom: '0.5rem' }}>
            KCAL {isOver ? 'OVER' : 'REMAINING'}
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span
              className="num-hero"
              style={{ color: heroColor, transition: 'color 0.4s ease' }}
            >
              {Math.abs(remaining)}
            </span>
          </div>
          {/* Calorie progress bar */}
          <div className="progress-thick" style={{ marginBottom: '0.5rem' }}>
            <div
              className="progress-fill"
              style={{ width: `${calPct}%`, background: heroColor }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="label" style={{ color: 'var(--text-secondary)' }}>{Math.round(totals.calories)} consumed</span>
            <span className="label">{calorieTarget} target</span>
          </div>
        </div>

        {/* Macro bars */}
        <div style={{ display: 'flex', gap: '1.25rem' }}>
          <MacroBar label="PROTEIN" value={totals.protein} target={macroTargets.protein} color="var(--amber)" />
          <MacroBar label="CARBS"   value={totals.carbs}   target={macroTargets.carbs}   color="var(--blue)" />
          <MacroBar label="FAT"     value={totals.fat}     target={macroTargets.fat}      color="#f70" />
        </div>
      </div>

      {/* ── SEARCH MODE ────────────────────────────────────────────────────── */}
      {mode === 'search' && (
        <div>
          {/* Meal type tabs */}
          <div className="tab-bar">
            {MEAL_ORDER.map(mt => (
              <button
                key={mt}
                className={`tab ${mealType === mt ? 'active' : ''}`}
                onClick={() => { setMealType(mt); setActiveMealType(mt); setAddMealType(mt); }}
              >
                {MEAL_LABELS[mt].slice(0, 5)}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="section" style={{ borderBottom: '1px solid var(--border-2)' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="SEARCH FOOD..."
                autoFocus
              />
              <button
                className="btn btn-primary"
                onClick={doSearch}
                disabled={searching}
                style={{ whiteSpace: 'nowrap' }}
              >
                {searching ? '···' : 'GO'}
              </button>
            </div>
            {searchError && (
              <p className="label" style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                {searchError}
              </p>
            )}
          </div>

          {/* Recent foods */}
          {results.length === 0 && !selected && recentFoods.length > 0 && (
            <div>
              <div className="section-label">
                <span className="label">RECENT</span>
              </div>
              {recentFoods.map(food => (
                <button
                  key={food.id}
                  className="row"
                  onClick={() => logFoodItem(food, food.serving_size, activeMealType)}
                  style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.8rem' }}>{food.name}</p>
                    <p className="label" style={{ marginTop: '0.15rem', color: 'var(--text-secondary)' }}>
                      {food.calories} kcal · {food.serving_size}{food.serving_unit}
                    </p>
                  </div>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '1rem' }}>+</span>
                </button>
              ))}
            </div>
          )}

          {/* Search results */}
          {results.map((r, i) => (
            <button
              key={i}
              className="row"
              onClick={() => { haptic('light'); setSelected(r); setResults([]); }}
              style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.1rem' }}>
                  <p style={{ margin: 0, fontWeight: 700, color: r.isGeneric ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {r.name}
                  </p>
                  {r.isGeneric && (
                    <span className="badge" style={{ color: 'var(--amber)' }}>WHOLE</span>
                  )}
                </div>
                {r.brand && <p className="label" style={{ color: 'var(--text-ghost)' }}>{r.brand}</p>}
              </div>
              <p style={{ margin: 0, fontWeight: 700, color: r.isGeneric ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.875rem', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                {r.calories} kcal
              </p>
            </button>
          ))}

          {!searching && (results.length > 0 || searchError) && !selected && (
            <div className="section">
              <button className="btn btn-ghost btn-sm" onClick={() => setMode('manual')}>
                + ENTER MANUALLY
              </button>
            </div>
          )}

          {/* Selected food — log panel */}
          {selected && (
            <div className="card-dark" style={{ margin: 'var(--page-pad)', borderTop: '1px solid var(--border-2)' }}>
              <p className="label" style={{ marginBottom: '1rem' }}>LOG: {selected.name.toUpperCase()}</p>

              {/* Quick quantity presets */}
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.875rem' }}>
                {['50', '100', '150', '200'].map(q => (
                  <button
                    key={q}
                    className={`btn btn-sm ${quantity === q ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1 }}
                    onClick={() => setQuantity(q)}
                  >
                    {q}g
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.875rem' }}>
                <div>
                  <p className="label" style={{ marginBottom: '0.35rem' }}>QUANTITY (G)</p>
                  <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} />
                </div>
                <div>
                  <p className="label" style={{ marginBottom: '0.35rem' }}>MEAL</p>
                  <select value={mealType} onChange={e => setMealType(e.target.value as MealType)}>
                    {MEAL_ORDER.map(mt => <option key={mt} value={mt}>{MEAL_LABELS[mt]}</option>)}
                  </select>
                </div>
              </div>

              {/* Macro preview */}
              <div className="card" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', padding: '0.875rem' }}>
                <div>
                  <p className="label" style={{ marginBottom: '0.2rem' }}>KCAL</p>
                  <p className="num-md" style={{ color: 'var(--amber)' }}>{previewCal}</p>
                </div>
                <div>
                  <p className="label" style={{ marginBottom: '0.2rem' }}>PROTEIN</p>
                  <p className="num-md" style={{ color: 'var(--amber)' }}>{previewProt}g</p>
                </div>
                <div>
                  <p className="label" style={{ marginBottom: '0.2rem' }}>CARBS</p>
                  <p className="num-md" style={{ color: 'var(--blue)' }}>{previewCarb}g</p>
                </div>
                <div>
                  <p className="label" style={{ marginBottom: '0.2rem' }}>FAT</p>
                  <p className="num-md" style={{ color: '#f70' }}>{previewFat}g</p>
                </div>
              </div>

              <button className="btn btn-primary btn-block" onClick={() => logFoodResult(selected, qty, mealType)}>
                LOG →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MANUAL MODE ────────────────────────────────────────────────────── */}
      {mode === 'manual' && (
        <div style={{ padding: 'var(--page-pad)' }}>
          <p className="section-title" style={{ marginBottom: '1.25rem' }}>ADD MANUALLY</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {addError && (
              <p style={{ margin: 0, color: 'var(--text-primary)', background: 'var(--surface-1)', border: '1px solid var(--border-3)', padding: '0.5rem', fontSize: '0.75rem' }}>
                ⚠ {addError}
              </p>
            )}
            <div>
              <p className="label" style={{ marginBottom: '0.35rem' }}>NAME *</p>
              <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="E.G. BOEREWORS" />
            </div>
            <div>
              <p className="label" style={{ marginBottom: '0.35rem' }}>BRAND (OPTIONAL)</p>
              <input value={addBrand} onChange={e => setAddBrand(e.target.value)} placeholder="E.G. WOOLWORTHS" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <p className="label" style={{ marginBottom: '0.35rem' }}>SERVING SIZE</p>
                <input type="number" value={addServing} onChange={e => setAddServing(e.target.value)} />
              </div>
              <div>
                <p className="label" style={{ marginBottom: '0.35rem' }}>UNIT</p>
                <select value={addServingUnit} onChange={e => setAddServingUnit(e.target.value)}>
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="oz">oz</option>
                  <option value="cup">cup</option>
                  <option value="piece">piece</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <p className="label" style={{ marginBottom: '0.35rem' }}>CALORIES *</p>
                <input type="number" value={addCalories} onChange={e => setAddCalories(e.target.value)} placeholder="0" />
              </div>
              <div>
                <p className="label" style={{ marginBottom: '0.35rem' }}>PROTEIN (G)</p>
                <input type="number" value={addProtein} onChange={e => setAddProtein(e.target.value)} placeholder="0" />
              </div>
              <div>
                <p className="label" style={{ marginBottom: '0.35rem' }}>CARBS (G)</p>
                <input type="number" value={addCarbs} onChange={e => setAddCarbs(e.target.value)} placeholder="0" />
              </div>
              <div>
                <p className="label" style={{ marginBottom: '0.35rem' }}>FAT (G)</p>
                <input type="number" value={addFat} onChange={e => setAddFat(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <p className="label" style={{ marginBottom: '0.35rem' }}>QUANTITY</p>
                <input type="number" value={addQuantity} onChange={e => setAddQuantity(e.target.value)} min="0.1" step="0.1" />
              </div>
              <div>
                <p className="label" style={{ marginBottom: '0.35rem' }}>MEAL</p>
                <select value={addMealType} onChange={e => setAddMealType(e.target.value as MealType)}>
                  {MEAL_ORDER.map(mt => <option key={mt} value={mt}>{MEAL_LABELS[mt]}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button className="btn btn-primary btn-block" style={{ flex: 1 }} onClick={handleManualAdd}>
                SAVE & LOG
              </button>
              <button className="btn btn-ghost btn-block" style={{ flex: 1 }} onClick={() => setMode('log')}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOG MODE: meal groups ───────────────────────────────────────────── */}
      {mode === 'log' && (
        <div>
          {logs.length === 0 && (
            <div style={{ padding: '3rem var(--page-pad)', textAlign: 'center' }}>
              <p className="label" style={{ color: 'var(--text-ghost)', marginBottom: '1.25rem' }}>NOTHING LOGGED TODAY</p>
              <button
                className="btn btn-ghost"
                onClick={() => openAdd('breakfast')}
              >
                LOG FIRST MEAL →
              </button>
            </div>
          )}
          {MEAL_ORDER.map(mt => (
            <MealGroup
              key={mt}
              type={mt}
              logs={grouped[mt]}
              onDelete={async (id) => { haptic('light'); await deleteMealLog(id); await load(); }}
              onAdd={openAdd}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NutritionPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: '2rem', color: 'var(--text-ghost)', fontSize: '0.75rem' }}>
        LOADING...
      </div>
    }>
      <NutritionContent />
    </Suspense>
  );
}
