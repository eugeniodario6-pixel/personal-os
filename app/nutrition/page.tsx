'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db, todayISO, type FoodItem, type MealLog, type Profile } from '@/lib/db';

interface MealLogWithFood extends MealLog {
  food: FoodItem | undefined;
}

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type Mode = 'log' | 'search' | 'add';

interface ApiFood {
  external_id: string;
  name: string;
  brand: string | null;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function NutritionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initAction = searchParams.get('action');

  const [mode, setMode] = useState<Mode>(initAction === 'add' ? 'add' : 'log');
  const [logs, setLogs] = useState<MealLogWithFood[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [apiResults, setApiResults] = useState<ApiFood[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<ApiFood | null>(null);
  const [logQuantity, setLogQuantity] = useState('1');
  const [logMealType, setLogMealType] = useState<MealType>('lunch');

  // Manual add state
  const [addName, setAddName] = useState('');
  const [addBrand, setAddBrand] = useState('');
  const [addCalories, setAddCalories] = useState('');
  const [addProtein, setAddProtein] = useState('');
  const [addCarbs, setAddCarbs] = useState('');
  const [addFat, setAddFat] = useState('');
  const [addServing, setAddServing] = useState('100');
  const [addServingUnit, setAddServingUnit] = useState('g');
  const [addQuantity, setAddQuantity] = useState('1');
  const [addMealType, setAddMealType] = useState<MealType>('lunch');
  const [addError, setAddError] = useState('');

  const loadData = useCallback(async () => {
    const today = todayISO();
    const [rawLogs, prof] = await Promise.all([
      db.meal_log.where('date').equals(today).reverse().sortBy('logged_at'),
      db.profile.get(1),
    ]);
    const enriched = await Promise.all(
      rawLogs.map(async (l) => ({ ...l, food: await db.food_item.get(l.food_item_id) }))
    );
    setLogs(enriched);
    setProfile(prof ?? null);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Debounced FatSecret search
  useEffect(() => {
    if (searchQuery.trim().length < 2) { setApiResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/food-search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setApiResults(data.foods ?? []);
      } catch { setApiResults([]); }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleLogFood = async () => {
    if (!selectedFood) return;
    const foodId = await db.food_item.add({
      id: undefined as unknown as number,
      external_id: selectedFood.external_id,
      name: selectedFood.name,
      brand: selectedFood.brand,
      barcode: null,
      serving_unit: selectedFood.serving_unit,
      serving_size: selectedFood.serving_size,
      calories: selectedFood.calories,
      protein: selectedFood.protein,
      carbs: selectedFood.carbs,
      fat: selectedFood.fat,
      is_favorite: false,
    });
    await db.meal_log.add({
      id: undefined as unknown as number,
      date: todayISO(),
      meal_type: logMealType,
      food_item_id: foodId as number,
      quantity: parseFloat(logQuantity) || 1,
      logged_at: new Date().toISOString(),
      source: 'search',
    });
    setSelectedFood(null);
    setSearchQuery('');
    setLogQuantity('1');
    await loadData();
    setMode('log');
  };

  const handleAddFood = async () => {
    setAddError('');
    if (!addName.trim()) { setAddError('NAME REQUIRED'); return; }
    if (!addCalories) { setAddError('CALORIES REQUIRED'); return; }
    const foodId = await db.food_item.add({
      id: undefined as unknown as number,
      external_id: null,
      name: addName.trim(),
      brand: addBrand.trim() || null,
      barcode: null,
      serving_unit: addServingUnit,
      serving_size: parseFloat(addServing) || 100,
      calories: parseFloat(addCalories) || 0,
      protein: parseFloat(addProtein) || 0,
      carbs: parseFloat(addCarbs) || 0,
      fat: parseFloat(addFat) || 0,
      is_favorite: false,
    });
    await db.meal_log.add({
      id: undefined as unknown as number,
      date: todayISO(),
      meal_type: addMealType,
      food_item_id: foodId as number,
      quantity: parseFloat(addQuantity) || 1,
      logged_at: new Date().toISOString(),
      source: 'manual',
    });
    setAddName(''); setAddBrand(''); setAddCalories(''); setAddProtein('');
    setAddCarbs(''); setAddFat(''); setAddServing('100'); setAddServingUnit('g'); setAddQuantity('1');
    await loadData();
    setMode('log');
  };

  const handleDeleteLog = async (logId: number) => {
    await db.meal_log.delete(logId);
    await loadData();
  };

  const totals = logs.reduce(
    (acc, l) => {
      if (!l.food) return acc;
      const r = l.quantity / l.food.serving_size;
      acc.calories += l.food.calories * r;
      acc.protein += l.food.protein * r;
      acc.carbs += l.food.carbs * r;
      acc.fat += l.food.fat * r;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const calorieTarget = profile?.calorie_target ?? 2000;
  const calPct = Math.min(totals.calories / calorieTarget, 1);

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: '2px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <p className="label" style={{ marginBottom: '0.25rem' }}>NUTRITION</p>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', fontFamily: "'IBM Plex Mono', monospace" }}>EAT</h1>
        </div>
        {mode === 'log' && (
          <button className="btn" onClick={() => setMode('add')} style={{ fontSize: '0.6rem', padding: '0.5rem 0.75rem' }}>
            + MANUAL
          </button>
        )}
        {(mode === 'search' || mode === 'add') && (
          <button className="btn" onClick={() => { setMode('log'); setSearchQuery(''); setSelectedFood(null); router.replace('/nutrition'); }} style={{ fontSize: '0.6rem', padding: '0.5rem 0.75rem' }}>
            ← BACK
          </button>
        )}
      </div>

      {/* Totals bar — always visible */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '2px solid #444', background: '#111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
          <span className="label">TODAY&apos;S TOTAL</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem', color: '#888' }}>/ {calorieTarget} KCAL</span>
        </div>
        <div className="number-large" style={{ color: '#fff', marginBottom: '0.5rem' }}>{Math.round(totals.calories)}</div>
        <div style={{ height: '4px', background: '#000', border: '1px solid #444', marginBottom: '0.75rem' }}>
          <div style={{ height: '100%', background: '#fff', width: `${calPct * 100}%` }} />
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {[
            { label: 'PROTEIN', val: totals.protein, target: profile?.macro_targets?.protein },
            { label: 'CARBS', val: totals.carbs, target: profile?.macro_targets?.carbs },
            { label: 'FAT', val: totals.fat, target: profile?.macro_targets?.fat },
          ].map((m) => (
            <div key={m.label} style={{ flex: 1 }}>
              <p className="label">{m.label}</p>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: '#fff', fontSize: '0.875rem' }}>
                {Math.round(m.val)}g
                {m.target ? <span style={{ color: '#444', fontSize: '0.65rem' }}> /{m.target}g</span> : null}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* LOG mode — search bar + today's log */}
      {mode === 'log' && (
        <>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '2px solid #444' }}>
            <input
              type="text"
              placeholder="LOG FOOD..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value.trim().length >= 2) setMode('search'); }}
              style={{ width: '100%', textTransform: 'uppercase' }}
            />
          </div>
          <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #111' }}>
            <span className="label">TODAY&apos;S LOG</span>
          </div>
          {logs.length === 0 ? (
            <div style={{ padding: '2rem 1rem', color: '#444', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' }}>
              NOTHING LOGGED YET TODAY.
            </div>
          ) : (
            logs.map((log) => {
              if (!log.food) return null;
              const r = log.quantity / log.food.serving_size;
              const cal = Math.round(log.food.calories * r);
              return (
                <div key={log.id} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.875rem', color: '#fff', fontWeight: 700 }}>{log.food.name}</p>
                    <p className="label">{log.meal_type.toUpperCase()} · {log.quantity}{log.food.serving_unit} · {cal} KCAL</p>
                  </div>
                  <button onClick={() => handleDeleteLog(log.id)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '1rem', fontFamily: "'IBM Plex Mono', monospace", padding: '0.25rem' }}>✕</button>
                </div>
              );
            })
          )}
        </>
      )}

      {/* SEARCH mode — results from FatSecret */}
      {mode === 'search' && (
        <>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '2px solid #444' }}>
            <input
              type="text"
              placeholder="LOG FOOD..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value.trim().length < 2) setMode('log'); }}
              autoFocus
              style={{ width: '100%', textTransform: 'uppercase' }}
            />
          </div>

          {!selectedFood && (
            <>
              {searching && (
                <div style={{ padding: '1rem', color: '#444', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' }}>SEARCHING...</div>
              )}
              {!searching && apiResults.map((food, idx) => (
                <button
                  key={food.external_id ?? idx}
                  onClick={() => setSelectedFood(food)}
                  style={{ display: 'flex', width: '100%', padding: '0.875rem 1rem', background: '#000', border: 'none', borderBottom: '1px solid #111', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", textAlign: 'left', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.875rem' }}>{food.name}</p>
                    <p className="label">{food.brand ? `${food.brand} · ` : ''}{food.calories} KCAL / {food.serving_size}{food.serving_unit}</p>
                  </div>
                  <span style={{ color: '#444' }}>+</span>
                </button>
              ))}
              {!searching && apiResults.length === 0 && searchQuery.trim().length >= 2 && (
                <div style={{ padding: '1.5rem 1rem', color: '#444', fontSize: '0.75rem', fontFamily: "'IBM Plex Mono', monospace" }}>
                  NO RESULTS. TRY DIFFERENT TERMS OR USE + MANUAL.
                </div>
              )}
            </>
          )}

          {selectedFood && (
            <div style={{ padding: '1rem' }}>
              <p className="label" style={{ marginBottom: '0.5rem' }}>LOG: {selectedFood.name.toUpperCase()}</p>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem', color: '#888', marginBottom: '1rem' }}>
                {selectedFood.calories} KCAL · {selectedFood.protein}g PRO · {selectedFood.carbs}g CARB · {selectedFood.fat}g FAT per {selectedFood.serving_size}{selectedFood.serving_unit}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <p className="label" style={{ marginBottom: '0.25rem' }}>QUANTITY ({selectedFood.serving_unit})</p>
                  <input type="number" value={logQuantity} onChange={(e) => setLogQuantity(e.target.value)} min="0.1" step="0.1" />
                </div>
                <div>
                  <p className="label" style={{ marginBottom: '0.25rem' }}>MEAL TYPE</p>
                  <select value={logMealType} onChange={(e) => setLogMealType(e.target.value as MealType)}>
                    <option value="breakfast">BREAKFAST</option>
                    <option value="lunch">LUNCH</option>
                    <option value="dinner">DINNER</option>
                    <option value="snack">SNACK</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-primary btn" onClick={handleLogFood} style={{ flex: 1 }}>LOG IT</button>
                  <button className="btn btn-ghost" onClick={() => setSelectedFood(null)} style={{ flex: 1 }}>CANCEL</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ADD mode — manual entry */}
      {mode === 'add' && (
        <div style={{ padding: '1rem' }}>
          <p className="label" style={{ marginBottom: '1rem' }}>ADD FOOD MANUALLY</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {addError && (
              <p style={{ color: '#fff', background: '#111', border: '1px solid #888', padding: '0.5rem', fontSize: '0.75rem', fontFamily: "'IBM Plex Mono', monospace" }}>⚠ {addError}</p>
            )}
            <div>
              <p className="label" style={{ marginBottom: '0.25rem' }}>NAME *</p>
              <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="E.G. CHICKEN BREAST" />
            </div>
            <div>
              <p className="label" style={{ marginBottom: '0.25rem' }}>BRAND (OPTIONAL)</p>
              <input value={addBrand} onChange={(e) => setAddBrand(e.target.value)} placeholder="E.G. WOOLWORTHS" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <p className="label" style={{ marginBottom: '0.25rem' }}>SERVING SIZE</p>
                <input type="number" value={addServing} onChange={(e) => setAddServing(e.target.value)} min="1" />
              </div>
              <div>
                <p className="label" style={{ marginBottom: '0.25rem' }}>UNIT</p>
                <select value={addServingUnit} onChange={(e) => setAddServingUnit(e.target.value)}>
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
                <p className="label" style={{ marginBottom: '0.25rem' }}>CALORIES *</p>
                <input type="number" value={addCalories} onChange={(e) => setAddCalories(e.target.value)} placeholder="0" min="0" />
              </div>
              <div>
                <p className="label" style={{ marginBottom: '0.25rem' }}>PROTEIN (g)</p>
                <input type="number" value={addProtein} onChange={(e) => setAddProtein(e.target.value)} placeholder="0" min="0" />
              </div>
              <div>
                <p className="label" style={{ marginBottom: '0.25rem' }}>CARBS (g)</p>
                <input type="number" value={addCarbs} onChange={(e) => setAddCarbs(e.target.value)} placeholder="0" min="0" />
              </div>
              <div>
                <p className="label" style={{ marginBottom: '0.25rem' }}>FAT (g)</p>
                <input type="number" value={addFat} onChange={(e) => setAddFat(e.target.value)} placeholder="0" min="0" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <p className="label" style={{ marginBottom: '0.25rem' }}>QUANTITY</p>
                <input type="number" value={addQuantity} onChange={(e) => setAddQuantity(e.target.value)} min="0.1" step="0.1" />
              </div>
              <div>
                <p className="label" style={{ marginBottom: '0.25rem' }}>MEAL TYPE</p>
                <select value={addMealType} onChange={(e) => setAddMealType(e.target.value as MealType)}>
                  <option value="breakfast">BREAKFAST</option>
                  <option value="lunch">LUNCH</option>
                  <option value="dinner">DINNER</option>
                  <option value="snack">SNACK</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button className="btn-primary btn" onClick={handleAddFood} style={{ flex: 1 }}>SAVE & LOG</button>
              <button className="btn btn-ghost" onClick={() => { setMode('log'); router.replace('/nutrition'); }} style={{ flex: 1 }}>CANCEL</button>
            </div>
          </div>
        </div>
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
