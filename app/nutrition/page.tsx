'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db, todayISO, type FoodItem, type MealLog, type Profile } from '@/lib/db';

const MONO = "'IBM Plex Mono', monospace";
const lbl = { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#888', margin: 0 };
const border2 = '2px solid #444';

interface MealLogWithFood extends MealLog { food: FoodItem | undefined; }
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type Mode = 'log' | 'add';

function NutritionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(searchParams.get('action') === 'add' ? 'add' : 'log');
  const [logs, setLogs] = useState<MealLogWithFood[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Add form
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
    const enriched = await Promise.all(rawLogs.map(async l => ({ ...l, food: await db.food_item.get(l.food_item_id) })));
    setLogs(enriched);
    setProfile(prof ?? null);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = async () => {
    setAddError('');
    if (!addName.trim()) { setAddError('NAME REQUIRED'); return; }
    if (!addCalories) { setAddError('CALORIES REQUIRED'); return; }
    const foodId = await db.food_item.add({
      id: undefined as unknown as number,
      external_id: null, name: addName.trim(), brand: addBrand.trim() || null,
      barcode: null, serving_unit: addServingUnit, serving_size: parseFloat(addServing) || 100,
      calories: parseFloat(addCalories) || 0, protein: parseFloat(addProtein) || 0,
      carbs: parseFloat(addCarbs) || 0, fat: parseFloat(addFat) || 0, is_favorite: false,
    });
    await db.meal_log.add({
      id: undefined as unknown as number, date: todayISO(), meal_type: addMealType,
      food_item_id: foodId as number, quantity: parseFloat(addQuantity) || 1,
      logged_at: new Date().toISOString(), source: 'manual',
    });
    setAddName(''); setAddBrand(''); setAddCalories(''); setAddProtein('');
    setAddCarbs(''); setAddFat(''); setAddServing('100'); setAddQuantity('1');
    await loadData();
    setMode('log');
    router.replace('/nutrition');
  };

  const handleDelete = async (id: number) => { await db.meal_log.delete(id); await loadData(); };

  const totals = logs.reduce((acc, l) => {
    if (!l.food) return acc;
    const r = l.quantity / l.food.serving_size;
    return { calories: acc.calories + l.food.calories * r, protein: acc.protein + l.food.protein * r, carbs: acc.carbs + l.food.carbs * r, fat: acc.fat + l.food.fat * r };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const calTarget = profile?.calorie_target ?? 2000;
  const calPct = Math.min((totals.calories / calTarget) * 100, 100);

  const inputStyle = { width: '100%', fontFamily: MONO, fontSize: '0.875rem', background: '#000', color: '#fff', border: '2px solid #444', padding: '0.5rem 0.75rem', outline: 'none', boxSizing: 'border-box' as const };

  return (
    <div style={{ fontFamily: MONO }}>
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: border2, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <p style={{ ...lbl, marginBottom: '0.25rem' }}>NUTRITION</p>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>EAT</h1>
        </div>
        <button onClick={() => { setMode(mode === 'add' ? 'log' : 'add'); router.replace('/nutrition'); }}
          style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.5rem 0.75rem', border: border2, background: mode === 'add' ? '#fff' : '#000', color: mode === 'add' ? '#000' : '#fff', cursor: 'pointer' }}>
          {mode === 'add' ? '← BACK' : '+ ADD'}
        </button>
      </div>

      {/* Totals bar */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: border2, background: '#111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
          <span style={lbl}>TODAY&apos;S TOTAL</span>
          <span style={{ fontSize: '0.75rem', color: '#888' }}>/ {calTarget} KCAL</span>
        </div>
        <div style={{ fontSize: '3rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff', marginBottom: '0.5rem' }}>{Math.round(totals.calories)}</div>
        <div style={{ height: 4, background: '#000', border: '1px solid #444', marginBottom: '0.75rem' }}>
          <div style={{ height: '100%', background: '#fff', width: `${calPct}%` }} />
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {[{ label: 'PROTEIN', val: totals.protein, target: profile?.macro_targets?.protein },
            { label: 'CARBS', val: totals.carbs, target: profile?.macro_targets?.carbs },
            { label: 'FAT', val: totals.fat, target: profile?.macro_targets?.fat }].map(m => (
            <div key={m.label} style={{ flex: 1 }}>
              <p style={lbl}>{m.label}</p>
              <p style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '0.875rem' }}>
                {Math.round(m.val)}g{m.target ? <span style={{ color: '#444', fontSize: '0.65rem' }}> /{m.target}g</span> : null}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ADD mode */}
      {mode === 'add' && (
        <div style={{ padding: '1rem' }}>
          <p style={{ ...lbl, marginBottom: '1rem' }}>ADD FOOD MANUALLY</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {addError && <p style={{ margin: 0, color: '#fff', background: '#111', border: '1px solid #888', padding: '0.5rem', fontSize: '0.75rem' }}>⚠ {addError}</p>}
            <div><p style={{ ...lbl, marginBottom: '0.25rem' }}>NAME *</p><input value={addName} onChange={e => setAddName(e.target.value)} placeholder="E.G. CHICKEN BREAST" style={inputStyle} /></div>
            <div><p style={{ ...lbl, marginBottom: '0.25rem' }}>BRAND (OPTIONAL)</p><input value={addBrand} onChange={e => setAddBrand(e.target.value)} placeholder="E.G. WOOLWORTHS" style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div><p style={{ ...lbl, marginBottom: '0.25rem' }}>SERVING SIZE</p><input type="number" value={addServing} onChange={e => setAddServing(e.target.value)} style={inputStyle} /></div>
              <div><p style={{ ...lbl, marginBottom: '0.25rem' }}>UNIT</p>
                <select value={addServingUnit} onChange={e => setAddServingUnit(e.target.value)} style={inputStyle}>
                  <option value="g">g</option><option value="ml">ml</option><option value="oz">oz</option><option value="cup">cup</option><option value="piece">piece</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div><p style={{ ...lbl, marginBottom: '0.25rem' }}>CALORIES *</p><input type="number" value={addCalories} onChange={e => setAddCalories(e.target.value)} placeholder="0" style={inputStyle} /></div>
              <div><p style={{ ...lbl, marginBottom: '0.25rem' }}>PROTEIN (G)</p><input type="number" value={addProtein} onChange={e => setAddProtein(e.target.value)} placeholder="0" style={inputStyle} /></div>
              <div><p style={{ ...lbl, marginBottom: '0.25rem' }}>CARBS (G)</p><input type="number" value={addCarbs} onChange={e => setAddCarbs(e.target.value)} placeholder="0" style={inputStyle} /></div>
              <div><p style={{ ...lbl, marginBottom: '0.25rem' }}>FAT (G)</p><input type="number" value={addFat} onChange={e => setAddFat(e.target.value)} placeholder="0" style={inputStyle} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div><p style={{ ...lbl, marginBottom: '0.25rem' }}>QUANTITY</p><input type="number" value={addQuantity} onChange={e => setAddQuantity(e.target.value)} min="0.1" step="0.1" style={inputStyle} /></div>
              <div><p style={{ ...lbl, marginBottom: '0.25rem' }}>MEAL TYPE</p>
                <select value={addMealType} onChange={e => setAddMealType(e.target.value as MealType)} style={inputStyle}>
                  <option value="breakfast">BREAKFAST</option><option value="lunch">LUNCH</option><option value="dinner">DINNER</option><option value="snack">SNACK</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button onClick={handleAdd} style={{ flex: 1, padding: '0.6rem 1rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: '#fff', color: '#000', border: border2, cursor: 'pointer', fontFamily: MONO }}>SAVE & LOG</button>
              <button onClick={() => { setMode('log'); router.replace('/nutrition'); }} style={{ flex: 1, padding: '0.6rem 1rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: '#000', color: '#888', border: '2px solid #444', cursor: 'pointer', fontFamily: MONO }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* LOG mode */}
      {mode === 'log' && (
        <>
          <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #111' }}><span style={lbl}>TODAY&apos;S LOG</span></div>
          {logs.length === 0 ? (
            <div style={{ padding: '2rem 1rem', color: '#444', fontSize: '0.75rem' }}>NOTHING LOGGED YET TODAY. TAP + ADD TO LOG FOOD.</div>
          ) : logs.map(log => {
            if (!log.food) return null;
            const r = log.quantity / log.food.serving_size;
            const cal = Math.round(log.food.calories * r);
            return (
              <div key={log.id} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '0.875rem' }}>{log.food.name}</p>
                  <p style={{ ...lbl, marginTop: '0.2rem' }}>{log.meal_type.toUpperCase()} · {log.quantity}{log.food.serving_unit} · {cal} KCAL</p>
                </div>
                <button onClick={() => handleDelete(log.id)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '1rem', fontFamily: MONO, padding: '0.25rem' }}>✕</button>
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
