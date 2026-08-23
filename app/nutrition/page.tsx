'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  getMealLogs, addFoodItem, addMealLog, deleteMealLog,
  getProfile, getRecentFoods,
  computeDailyScore, getDailyScore,
  todayISO,
  type FoodItem, type MealLog, type DailyScore, type Profile,
} from '@/lib/db';
import { haptic } from '@/lib/haptic';
import { toast } from '@/components/Toast';
import { scoreFoodQuality, qualityLabel, type FoodQualityBreakdown } from '@/lib/foodQuality';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MealLogWithFood extends MealLog { food: FoodItem | null; }
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface FoodResult {
  id: string; name: string; brand: string; isGeneric: boolean;
  calories: number; protein: number; carbs: number; fat: number;
  serving_size: number; serving_unit: string;
}

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks',
};
const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '☀️', lunch: '◑', dinner: '🌙', snack: '◎',
};

function currentMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 19) return 'dinner';
  return 'snack';
}

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

// ─── Quality breakdown panel ──────────────────────────────────────────────────
function QualityBreakdown({ breakdown }: { breakdown: FoodQualityBreakdown }) {
  const { proteinDensityScore, macroBalanceScore, wholeFoodScore, primaryDriver } = breakdown;
  const rows = [
    { label: 'Protein density', value: proteinDensityScore, max: 40 },
    { label: 'Macro balance',   value: macroBalanceScore,   max: 30 },
    { label: 'Food type',       value: wholeFoodScore,      max: 30 },
  ];
  return (
    <div style={{ margin: '8px 0 4px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
      {rows.map(row => {
        const pct = row.value / row.max;
        const color = pct >= 0.75 ? '#78dc64' : pct >= 0.4 ? 'rgba(255,255,255,0.50)' : '#ff6b6b';
        return (
          <div key={row.label} style={{ marginBottom: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', width: 90, flexShrink: 0 }}>{row.label}</span>
              <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(row.value / row.max) * 100}%`, background: color, borderRadius: 99 }} />
              </div>
              <span style={{ fontSize: 10, color, fontWeight: 600, width: 28, textAlign: 'right' }}>{row.value}/{row.max}</span>
            </div>
          </div>
        );
      })}
      <p style={{ margin: '4px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', lineHeight: 1.4 }}>{primaryDriver}</p>
    </div>
  );
}

// ─── Log entry row ────────────────────────────────────────────────────────────
function LogEntry({ log, onDelete, expanded, onToggleExpand }: {
  log: MealLogWithFood;
  onDelete: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  if (!log.food) return null;
  const r = log.quantity / log.food.serving_size;
  const cal = Math.round(log.food.calories * r);
  const prot = Math.round(log.food.protein * r * 10) / 10;
  const breakdown = scoreFoodQuality(log.food);
  const { label: qLabel, color: qColor } = qualityLabel(breakdown.score);
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, letterSpacing: '-0.011em', color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {log.food.name}
            </p>
            <button
              onClick={() => { haptic('light'); onToggleExpand(); }}
              style={{
                flexShrink: 0, fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
                color: qColor, background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${qColor}`, borderRadius: 4,
                padding: '1px 5px', lineHeight: 1.6, cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {qLabel.toUpperCase()}
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.01em' }}>
            {log.quantity}{log.food.serving_unit} · {prot}g protein
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>{cal}</span>
          <button onClick={() => { haptic('light'); onDelete(); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 14, padding: '4px', lineHeight: 1 }}>✕</button>
        </div>
      </div>
      {expanded && <QualityBreakdown breakdown={breakdown} />}
    </div>
  );
}

// ─── Food picker row ──────────────────────────────────────────────────────────
function FoodRow({ food, onSelect }: { food: FoodItem | FoodResult; onSelect: () => void }) {
  return (
    <button onClick={() => { haptic('light'); onSelect(); }} style={{
      display: 'flex', width: '100%', alignItems: 'center',
      padding: '14px 0', background: 'transparent', border: 'none',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 500, letterSpacing: '-0.011em', color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {food.name}
        </p>
        {'brand' in food && (food as FoodResult).brand && (
          <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{(food as FoodResult).brand}</p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, flexShrink: 0, marginLeft: 12 }}>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>{food.calories}</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em' }}>kcal</span>
      </div>
    </button>
  );
}

// ─── Log panel ────────────────────────────────────────────────────────────────
function FoodLogPanel({ selected, onLog, onCancel }: {
  selected: FoodResult | FoodItem;
  onLog: (qty: number, mt: MealType) => void;
  onCancel: () => void;
}) {
  const [quantity, setQuantity] = useState('100');
  const [mealType, setMealType] = useState<MealType>(currentMealType());

  const qty = parseFloat(quantity) || 0;
  const ss = (selected as FoodItem).serving_size ?? 100;
  const r = qty / ss;
  const pCal  = Math.round(selected.calories * r);
  const pProt = Math.round(selected.protein  * r * 10) / 10;
  const pCarb = Math.round(selected.carbs    * r * 10) / 10;
  const pFat  = Math.round(selected.fat      * r * 10) / 10;

  return (
    <div style={{ background: '#111113', borderRadius: 20, padding: 20, margin: '0 16px 16px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em', color: '#fff', flex: 1, marginRight: 12, lineHeight: 1.3 }}>
          {selected.name}
        </p>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.40)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>✕</button>
      </div>

      {/* Meal type */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 16 }}>
        {MEAL_ORDER.map(mt => (
          <button key={mt} onClick={() => setMealType(mt)} style={{
            padding: '8px 4px', borderRadius: 10, border: 'none',
            background: mealType === mt ? '#fff' : 'rgba(255,255,255,0.06)',
            color: mealType === mt ? '#000' : 'rgba(255,255,255,0.40)',
            fontSize: 11, fontWeight: mealType === mt ? 700 : 500, cursor: 'pointer',
          }}>
            {MEAL_LABELS[mt].slice(0,5)}
          </button>
        ))}
      </div>

      {/* Qty */}
      <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)' }}>Amount</p>
      <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 12, padding: '14px 16px',
          color: '#fff', fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em',
          textAlign: 'center', outline: 'none', boxSizing: 'border-box', marginBottom: 10,
        }}
        autoFocus
      />

      {/* Quick qty */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 18 }}>
        {['50','100','150','200'].map(q => (
          <button key={q} onClick={() => setQuantity(q)} style={{
            padding: '8px 0', borderRadius: 10, border: 'none',
            background: quantity === q ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
            color: quantity === q ? '#fff' : 'rgba(255,255,255,0.40)',
            fontSize: 12, fontWeight: quantity === q ? 700 : 500, cursor: 'pointer',
          }}>{q}g</button>
        ))}
      </div>

      {/* Macro preview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 18, background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14 }}>
        {[['kcal', pCal],['pro', `${pProt}g`],['carb', `${pCarb}g`],['fat', `${pFat}g`]].map(([l, v]) => (
          <div key={l} style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontSize: 9, letterSpacing: '0.10em', color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase' }}>{l}</p>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1 }}>{v}</p>
          </div>
        ))}
      </div>

      <button onClick={() => onLog(qty, mealType)} style={{
        width: '100%', background: '#fff', color: '#000', border: 'none',
        borderRadius: 99, padding: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}>
        Log to {MEAL_LABELS[mealType]}
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function NutritionContent() {
  const [logs, setLogs]               = useState<MealLogWithFood[]>([]);
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]);
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [selectedFood, setSelectedFood] = useState<FoodResult | FoodItem | null>(null);
  const [mode, setMode]               = useState<'idle' | 'recents' | 'search' | 'manual'>('idle');
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  // Manual entry
  const [addName, setAddName]         = useState('');
  const [addCalories, setAddCalories] = useState('');
  const [addProtein, setAddProtein]   = useState('');
  const [addCarbs, setAddCarbs]       = useState('');
  const [addFat, setAddFat]           = useState('');
  const [addServing, setAddServing]   = useState('100');
  const [addServingUnit, setAddServingUnit] = useState('g');
  const [addQuantity, setAddQuantity] = useState('100');
  const [addMealType, setAddMealType] = useState<MealType>('lunch');
  const [addError, setAddError]       = useState('');

  // Search
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const load = useCallback(async () => {
    const [rawLogs, prof, recents] = await Promise.all([
      getMealLogs(todayISO()), getProfile(), getRecentFoods(20),
    ]);
    setLogs(rawLogs); setProfile(prof); setRecentFoods(recents);
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = MEAL_ORDER.reduce((acc, mt) => {
    acc[mt] = logs.filter(l => l.meal_type === mt);
    return acc;
  }, {} as Record<MealType, MealLogWithFood[]>);

  const reloadAndScore = async () => {
    await load();
    await computeDailyScore(todayISO());
  };

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true); setSearchError(''); setResults([]);
    try {
      const r = await searchFood(query.trim());
      if (r.length === 0) setSearchError('No results');
      setResults(r);
    } catch { setSearchError('Search failed'); }
    finally { setSearching(false); }
  };

  const handleManualAdd = async () => {
    setAddError('');
    if (!addName.trim()) { setAddError('Name is required'); return; }
    if (!addCalories) { setAddError('Calories are required'); return; }
    haptic('medium');
    try {
      const foodId = await addFoodItem({
        external_id: null, name: addName.trim(), brand: null, barcode: null,
        serving_unit: addServingUnit, serving_size: parseFloat(addServing) || 100,
        calories: parseFloat(addCalories) || 0,
        protein: parseFloat(addProtein) || 0,
        carbs: parseFloat(addCarbs) || 0,
        fat: parseFloat(addFat) || 0,
        is_favorite: false,
      });
      await addMealLog({
        date: todayISO(), meal_type: addMealType, food_item_id: foodId,
        quantity: parseFloat(addQuantity) || 100,
        logged_at: new Date().toISOString(), source: 'manual',
      });
      fetch('/api/food-contribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addName.trim(), calories: parseFloat(addCalories), protein: parseFloat(addProtein) || 0, carbs: parseFloat(addCarbs) || 0, fat: parseFloat(addFat) || 0, serving_size: parseFloat(addServing) || 100, serving_unit: addServingUnit }),
      }).catch(() => {});
      setAddName(''); setAddCalories(''); setAddProtein(''); setAddCarbs(''); setAddFat('');
      setAddServing('100'); setAddQuantity('100');
      toast(`${addName.trim()} logged ✓`);
      setMode('idle');
      await reloadAndScore();
    } catch { setAddError('Failed to save — try again'); }
  };

  const handleLog = async (qty: number, mt: MealType) => {
    if (!selectedFood) return;
    haptic('medium');
    const asItem = selectedFood as FoodItem;
    if (typeof asItem.id === 'number' && !('isGeneric' in selectedFood)) {
      await addMealLog({ date: todayISO(), meal_type: mt, food_item_id: asItem.id, quantity: qty, logged_at: new Date().toISOString(), source: 'manual' });
    } else {
      const food = selectedFood as FoodResult;
      const foodId = await addFoodItem({
        external_id: null, name: food.name, brand: food.brand || null, barcode: null,
        serving_unit: food.serving_unit, serving_size: food.serving_size,
        calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, is_favorite: false,
      });
      await addMealLog({ date: todayISO(), meal_type: mt, food_item_id: foodId, quantity: qty, logged_at: new Date().toISOString(), source: 'search' });
    }
    toast(`${selectedFood.name} logged ✓`);
    setSelectedFood(null); setResults([]); setQuery(''); setMode('idle');
    await reloadAndScore();
  };

  const totals = calcTotals(logs);
  const target = profile?.calorie_target ?? 2000;
  const proteinTarget = profile?.macro_targets?.protein ?? 150;
  const carbTarget = profile?.macro_targets?.carbs ?? 200;
  const fatTarget = profile?.macro_targets?.fat ?? 65;
  const remaining = Math.max(target - Math.round(totals.calories), 0);
  const calPct = target > 0 ? Math.min((totals.calories / target) * 100, 100) : 0;
  const dateStr = new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short' });

  const PAD = 16;
  const GAP = 10;

  return (
    <div style={{ minHeight: '100dvh', background: '#000', paddingTop: '4.5rem', paddingBottom: '130px' }}>

      {/* ── Header ── */}
      <div style={{ padding: `0 ${PAD}px 20px` }}>
        <p style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 10, marginTop: 4 }}>
          {dateStr}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff', margin: 0 }}>Nutrition</h1>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', margin: '0 0 4px' }}>Remaining</p>
            <p style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: remaining > 0 ? '#fff' : '#78dc64', margin: 0 }}>
              {remaining > 0 ? remaining.toLocaleString() : '✓'}
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: `0 ${PAD}px`, display: 'flex', flexDirection: 'column', gap: GAP }}>

        {/* ── Macro bento row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP }}>
          {/* Calories — big card */}
          <div style={{ background: '#111113', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', padding: 18 }}>
            <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', margin: '0 0 10px' }}>Calories</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 'clamp(36px,10vw,48px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1, color: '#fff' }}>
                {Math.round(totals.calories).toLocaleString()}
              </span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)' }}>kcal</span>
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '0 0 14px' }}>of {target.toLocaleString()}</p>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${calPct}%`, background: '#fff', borderRadius: 99, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
            </div>
          </div>

          {/* Protein */}
          <div style={{ background: '#111113', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', padding: 18 }}>
            <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', margin: '0 0 10px' }}>Protein</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 'clamp(36px,10vw,48px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1, color: '#fff' }}>
                {Math.round(totals.protein)}
              </span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)' }}>g</span>
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '0 0 14px' }}>of {proteinTarget}g</p>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min((totals.protein / proteinTarget) * 100, 100)}%`, background: totals.protein >= proteinTarget * 0.9 ? '#78dc64' : '#fff', borderRadius: 99, transition: 'width 0.8s' }} />
            </div>
          </div>
        </div>

        {/* ── Carbs + Fat strip ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP }}>
          {[
            { label: 'Carbs', val: Math.round(totals.carbs), target: carbTarget, unit: 'g' },
            { label: 'Fat', val: Math.round(totals.fat), target: fatTarget, unit: 'g' },
          ].map(({ label, val, target: t, unit }) => (
            <div key={label} style={{ background: '#111113', borderRadius: 18, border: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px' }}>
              <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', margin: '0 0 8px' }}>{label}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff' }}>{val}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)' }}>{unit}</span>
              </div>
              <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden', marginTop: 10 }}>
                <div style={{ height: '100%', width: `${t > 0 ? Math.min((val / t) * 100, 100) : 0}%`, background: 'rgba(255,255,255,0.45)', borderRadius: 99 }} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Action buttons ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: GAP }}>
          {[
            { label: '+ Log', mode: 'recents' as const },
            { label: 'Search', mode: 'search' as const },
            { label: 'Manual', mode: 'manual' as const },
          ].map(btn => (
            <button
              key={btn.mode}
              onClick={() => { setMode(mode === btn.mode ? 'idle' : btn.mode); setSelectedFood(null); setResults([]); setAddError(''); }}
              style={{
                background: mode === btn.mode ? '#fff' : '#111113',
                color: mode === btn.mode ? '#000' : 'rgba(255,255,255,0.60)',
                border: mode === btn.mode ? 'none' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: 14, padding: '14px 10px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* ── Food log panel ── */}
        {selectedFood && (
          <FoodLogPanel selected={selectedFood} onLog={handleLog} onCancel={() => setSelectedFood(null)} />
        )}

        {/* ── Recents drawer ── */}
        {mode === 'recents' && !selectedFood && (
          <div style={{ background: '#111113', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', padding: '0 18px' }}>
            {recentFoods.length === 0 ? (
              <p style={{ padding: '24px 0', textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>No recent foods — use Search to add</p>
            ) : recentFoods.map(food => (
              <FoodRow key={food.id} food={food} onSelect={() => setSelectedFood(food)} />
            ))}
          </div>
        )}

        {/* ── Search drawer ── */}
        {mode === 'search' && !selectedFood && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="Search food…" autoFocus
                style={{
                  flex: 1, background: '#111113', border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 14, padding: '14px 16px',
                  color: '#fff', fontSize: 15, outline: 'none',
                }}
              />
              <button onClick={doSearch} disabled={searching} style={{
                flexShrink: 0, padding: '14px 20px', borderRadius: 14,
                background: '#fff', color: '#000', border: 'none',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: searching ? 0.5 : 1,
              }}>
                {searching ? '…' : 'Go'}
              </button>
            </div>
            {searchError && <p style={{ fontSize: 13, color: '#ff6b6b', margin: 0 }}>{searchError}</p>}
            {results.length > 0 && (
              <div style={{ background: '#111113', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', padding: '0 18px' }}>
                {results.map((r, i) => <FoodRow key={i} food={r} onSelect={() => setSelectedFood(r)} />)}
              </div>
            )}
          </div>
        )}

        {/* ── Manual entry ── */}
        {mode === 'manual' && (
          <div style={{ background: '#111113', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', padding: 20 }}>
            <p style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', margin: '0 0 18px' }}>Add manually</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {addError && (
                <div style={{ background: 'rgba(235,87,87,0.08)', border: '1px solid rgba(235,87,87,0.2)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#ff6b6b' }}>
                  {addError}
                </div>
              )}
              <div>
                <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginBottom: 8 }}>Name *</p>
                <input value={addName} onChange={e => setAddName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleManualAdd()} placeholder="e.g. Chicken breast" autoFocus
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: '14px 16px', color: '#fff', fontSize: 15, width: '100%' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginBottom: 8 }}>Serving size</p>
                  <input type="number" value={addServing} onChange={e => setAddServing(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: '12px 14px', color: '#fff', fontSize: 15, width: '100%' }} />
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginBottom: 8 }}>Unit</p>
                  <select value={addServingUnit} onChange={e => setAddServingUnit(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: '12px 14px', color: '#fff', fontSize: 15, width: '100%' }}>
                    <option value="g">g</option><option value="ml">ml</option><option value="oz">oz</option>
                    <option value="cup">cup</option><option value="piece">piece</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Calories *', val: addCalories, set: setAddCalories },
                  { label: 'Protein (g)', val: addProtein, set: setAddProtein },
                  { label: 'Carbs (g)', val: addCarbs, set: setAddCarbs },
                  { label: 'Fat (g)', val: addFat, set: setAddFat },
                ].map(f => (
                  <div key={f.label}>
                    <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginBottom: 8 }}>{f.label}</p>
                    <input type="number" value={f.val} onChange={e => f.set(e.target.value)} placeholder="0"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: '12px 14px', color: '#fff', fontSize: 15, width: '100%' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginBottom: 8 }}>Quantity</p>
                  <input type="number" value={addQuantity} onChange={e => setAddQuantity(e.target.value)} min="0.1" step="0.1"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: '12px 14px', color: '#fff', fontSize: 15, width: '100%' }} />
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginBottom: 8 }}>Meal</p>
                  <select value={addMealType} onChange={e => setAddMealType(e.target.value as MealType)}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: '12px 14px', color: '#fff', fontSize: 15, width: '100%' }}>
                    {MEAL_ORDER.map(mt => <option key={mt} value={mt}>{MEAL_LABELS[mt]}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={handleManualAdd} style={{ flex: 1, background: '#fff', color: '#000', border: 'none', borderRadius: 99, padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Save & Log</button>
                <button onClick={() => { setMode('idle'); setAddError(''); }} style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', borderRadius: 99, padding: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Meal sections ── */}
        {MEAL_ORDER.map(mt => {
          const mealLogs = grouped[mt];
          const mealTotals = calcTotals(mealLogs);
          const mealCal = Math.round(mealTotals.calories);
          return (
            <div key={mt} style={{ background: '#111113', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              {/* Meal header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: mealLogs.length > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{MEAL_ICONS[mt]}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.011em', color: '#fff' }}>{MEAL_LABELS[mt]}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {mealCal > 0 && (
                    <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.60)' }}>{mealCal}</span>
                  )}
                  <button
                    onClick={() => { setMode('recents'); setSelectedFood(null); }}
                    style={{
                      background: 'rgba(255,255,255,0.08)', border: 'none',
                      borderRadius: 99, padding: '6px 12px',
                      fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.60)',
                      cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Log entries */}
              {mealLogs.length > 0 && (
                <div style={{ padding: '0 18px' }}>
                  {mealLogs.map(log => (
                    <LogEntry
                      key={log.id}
                      log={log}
                      expanded={expandedLogs.has(log.id)}
                      onToggleExpand={() => {
                        setExpandedLogs(prev => {
                          const next = new Set(prev);
                          if (next.has(log.id)) next.delete(log.id);
                          else next.add(log.id);
                          return next;
                        });
                      }}
                      onDelete={async () => {
                        await deleteMealLog(log.id);
                        toast('Removed', 'info');
                        await reloadAndScore();
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function NutritionPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)' }}>Loading…</p>
      </div>
    }>
      <NutritionContent />
    </Suspense>
  );
}
