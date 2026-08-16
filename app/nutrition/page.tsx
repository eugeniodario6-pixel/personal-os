'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  getMealLogs, addFoodItem, addMealLog, deleteMealLog,
  getProfile, getRecentFoods,
  computeDailyScore, getDailyScore, getDailyScores,
  getGroceryItems, addGroceryItem, toggleGroceryItem, clearPurchasedGroceries,
  currentWeekOf, todayISO,
  type FoodItem, type MealLog, type DailyScore, type GroceryItem, type Profile,
} from '@/lib/db';
import { haptic } from '@/lib/haptic';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MealLogWithFood extends MealLog { food: FoodItem | null; }
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type MainTab = 'log' | 'trends' | 'grocery';
type LogMode = 'recents' | 'search';
type TrendsTab = 'day' | 'week' | 'year';

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

function scoreColor(score: number): string {
  if (score >= 75) return 'var(--accent)';
  if (score >= 50) return 'var(--text-muted)';
  return 'var(--negative)';
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
}

// ─── MacroRow ─────────────────────────────────────────────────────────────────
function MacroRow({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = Math.min((value / (target || 1)) * 100, 100);
  const over = value > target;
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        <span className="label">{label}</span>
        <span className="label" style={{ color: over ? 'var(--negative)' : 'var(--text-muted)' }}>
          {Math.round(value * 10) / 10}g / {target}g
        </span>
      </div>
      <div className="progress">
        <div
          className="progress-fill t-medium"
          style={{ width: `${pct}%`, background: over ? 'var(--negative)' : 'var(--accent)' }}
        />
      </div>
    </div>
  );
}

// ─── ScoreStatGrid ────────────────────────────────────────────────────────────
function ScoreStatGrid({ score }: { score: DailyScore | null }) {
  const components = [
    { label: 'PROTEIN', value: score?.protein_score ?? null },
    { label: 'CALORIES', value: score?.calorie_score ?? null },
    { label: 'CARBS', value: score?.carb_score ?? null },
    { label: 'FAT', value: score?.fat_score ?? null },
  ];
  return (
    <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: '0.75rem' }}>
      {components.map(({ label, value }) => (
        <div key={label} className="stat-cell">
          <div className="label-xs" style={{ marginBottom: '0.3rem' }}>{label}</div>
          <div className="num-sm" style={{ color: value !== null ? scoreColor(value) : 'var(--text-ghost)' }}>
            {value !== null ? value : '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── FoodLogPanel ─────────────────────────────────────────────────────────────
function FoodLogPanel({
  selected, onLog, onCancel,
}: {
  selected: FoodResult | FoodItem;
  onLog: (qty: number, mt: MealType) => void;
  onCancel: () => void;
}) {
  const [quantity, setQuantity] = useState('100');
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [tweening, setTweening] = useState(false);
  const prevQty = useRef('100');

  const qty = parseFloat(quantity) || 0;
  const ss = (selected as FoodItem).serving_size ?? (selected as FoodResult).serving_size ?? 100;
  const r = qty / ss;

  const calories = selected.calories;
  const protein = selected.protein;
  const carbs = selected.carbs;
  const fat = selected.fat;

  const pCal  = Math.round(calories * r);
  const pProt = Math.round(protein  * r * 10) / 10;
  const pCarb = Math.round(carbs    * r * 10) / 10;
  const pFat  = Math.round(fat      * r * 10) / 10;

  const handleQtyChange = (val: string) => {
    if (val !== prevQty.current) {
      setTweening(true);
      setTimeout(() => setTweening(false), 150);
      prevQty.current = val;
    }
    setQuantity(val);
  };

  return (
    <div className="panel" style={{ margin: '0 var(--page-pad) var(--page-pad)', borderTop: '2px solid var(--accent)' }}>
      {/* Food name */}
      <div style={{ marginBottom: '0.875rem' }}>
        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.875rem' }}>
          {selected.name}
        </div>
        {'brand' in selected && selected.brand && (
          <div className="label-xs" style={{ marginTop: '0.15rem' }}>{selected.brand}</div>
        )}
      </div>

      {/* Quantity input + quick-select */}
      <div style={{ marginBottom: '0.875rem' }}>
        <div className="label" style={{ marginBottom: '0.4rem' }}>GRAMS</div>
        <input
          type="number"
          value={quantity}
          onChange={e => handleQtyChange(e.target.value)}
          style={{ marginBottom: '0.5rem' }}
        />
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {['50', '100', '150', '200'].map(q => (
            <button
              key={q}
              className={`btn btn-sm ${quantity === q ? 'btn-primary' : 'btn-outline'} t-fast`}
              style={{ flex: 1 }}
              onClick={() => handleQtyChange(q)}
            >
              {q}g
            </button>
          ))}
        </div>
      </div>

      {/* Meal type */}
      <div className="tab-bar" style={{ marginBottom: '0.875rem', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {MEAL_ORDER.map(mt => (
          <button
            key={mt}
            className={`tab ${mealType === mt ? 'active' : ''}`}
            onClick={() => setMealType(mt)}
          >
            {MEAL_LABELS[mt].slice(0, 5)}
          </button>
        ))}
      </div>

      {/* Live macro preview */}
      <div className="panel" style={{ marginBottom: '0.875rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
          {[
            { label: 'KCAL', val: pCal },
            { label: 'PRO', val: `${pProt}g` },
            { label: 'CARB', val: `${pCarb}g` },
            { label: 'FAT', val: `${pFat}g` },
          ].map(({ label, val }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div className="label-xs" style={{ marginBottom: '0.2rem' }}>{label}</div>
              <div
                className={`num-sm num-tween${tweening ? ' updating' : ''}`}
                style={{ color: 'var(--accent)' }}
              >
                {val}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <button
        className="btn btn-primary btn-block"
        style={{ marginBottom: '0.5rem' }}
        onClick={() => onLog(qty, mealType)}
      >
        LOG →
      </button>
      <button className="btn btn-ghost btn-block" onClick={onCancel}>
        CANCEL
      </button>
    </div>
  );
}

// ─── MealGroup ────────────────────────────────────────────────────────────────
function MealGroup({ type, logs, onDelete }: {
  type: MealType;
  logs: MealLogWithFood[];
  onDelete: (id: number) => void;
}) {
  const cal = Math.round(calcTotals(logs).calories);
  return (
    <div>
      <div className="section-label">
        <span className="label">{MEAL_LABELS[type]}</span>
        {cal > 0 && <span className="label" style={{ color: 'var(--accent)' }}>{cal} kcal</span>}
      </div>
      {logs.length === 0 ? (
        <div style={{ padding: '0.6rem var(--page-pad)' }}>
          <span className="label" style={{ color: 'var(--text-ghost)' }}>—</span>
        </div>
      ) : (
        logs.map(log => {
          if (!log.food) return null;
          const r = log.quantity / log.food.serving_size;
          const logCal = Math.round(log.food.calories * r);
          return (
            <div key={log.id} className="row" style={{ cursor: 'default' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="truncate" style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text)' }}>
                  {log.food.name}
                </div>
                <div className="label-xs" style={{ marginTop: '0.15rem' }}>
                  {log.quantity}{log.food.serving_unit} · P {Math.round(log.food.protein * r * 10) / 10}g
                </div>
              </div>
              <span className="num-sm" style={{ color: 'var(--accent)', marginRight: '0.75rem' }}>{logCal}</span>
              <span className="label-xs" style={{ color: 'var(--text-ghost)', marginRight: '0.75rem' }}>kcal</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { haptic('light'); onDelete(log.id); }}
                style={{ padding: '0.2rem 0.4rem' }}
              >
                ✕
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── TotalsSection ────────────────────────────────────────────────────────────
function TotalsSection({ logs, profile }: { logs: MealLogWithFood[]; profile: Profile | null }) {
  const totals = calcTotals(logs);
  const ct = profile?.calorie_target ?? 2000;
  const mt = profile?.macro_targets ?? { protein: 150, carbs: 200, fat: 65 };
  const calPct = Math.min((totals.calories / ct) * 100, 100);
  const over = totals.calories > ct;

  return (
    <div className="card" style={{ margin: 'var(--page-pad)', marginBottom: 0 }}>
      {/* Calorie progress */}
      <div style={{ marginBottom: '0.875rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
          <span className="label">CALORIES</span>
          <span className="label" style={{ color: over ? 'var(--negative)' : 'var(--text-muted)' }}>
            {Math.round(totals.calories)} / {ct} kcal
          </span>
        </div>
        <div className="progress" style={{ height: '4px' }}>
          <div
            className="progress-fill t-medium"
            style={{ width: `${calPct}%`, background: over ? 'var(--negative)' : 'var(--accent)' }}
          />
        </div>
      </div>
      <MacroRow label="PROTEIN" value={totals.protein} target={mt.protein} />
      <MacroRow label="CARBS"   value={totals.carbs}   target={mt.carbs} />
      <MacroRow label="FAT"     value={totals.fat}     target={mt.fat} />
    </div>
  );
}

// ─── WeekGrid ─────────────────────────────────────────────────────────────────
function WeekGrid({ scores }: { scores: DailyScore[] }) {
  const today = todayISO();
  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // Build a map of this week Mon–Sun
  const weekDays: string[] = [];
  const d = new Date();
  const dow = d.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  for (let i = 0; i < 7; i++) {
    const day = new Date(d);
    day.setDate(d.getDate() + mondayOffset + i);
    weekDays.push(day.toISOString().slice(0, 10));
  }

  const scoreMap = new Map(scores.map(s => [s.date, s.total_score]));

  return (
    <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', margin: 'var(--page-pad)' }}>
      {weekDays.map((date, i) => {
        const score = scoreMap.get(date) ?? null;
        const isToday = date === today;
        return (
          <div key={date} className={`stat-cell${isToday ? ' active' : ''}`} style={{ textAlign: 'center' }}>
            <div className="label-xs" style={{ marginBottom: '0.3rem' }}>{DAY_LABELS[i]}</div>
            <div className="num-sm" style={{ color: score !== null ? scoreColor(score) : 'var(--text-ghost)' }}>
              {score !== null ? score : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── YearGrid ─────────────────────────────────────────────────────────────────
function YearGrid({ scores }: { scores: DailyScore[] }) {
  const scoreMap = new Map(scores.map(s => [s.date, s.total_score]));

  // Compute rolling threshold
  const sortedScores = [...scores].sort((a, b) => a.date.localeCompare(b.date));
  let threshold = 80;
  if (sortedScores.length >= 14) {
    const last30 = sortedScores.slice(-30);
    const avg = last30.reduce((s, x) => s + x.total_score, 0) / last30.length;
    threshold = Math.round(avg);
  }

  // Build 52 weeks from today going back
  const today = new Date();
  const todayISO_ = today.toISOString().slice(0, 10);

  // Find Monday of 51 weeks ago
  const startDay = new Date(today);
  const dow = startDay.getDay();
  startDay.setDate(startDay.getDate() - (dow === 0 ? 6 : dow - 1) - 51 * 7);

  const weeks: string[][] = [];
  let cur = new Date(startDay);
  for (let w = 0; w < 52; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  return (
    <div style={{ padding: 'var(--page-pad)', overflowX: 'auto' }}>
      <div className="label-xs" style={{ marginBottom: '0.75rem' }}>
        PAST 52 WEEKS · THRESHOLD {threshold}
      </div>
      <div style={{ display: 'flex', gap: '2px' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {week.map(date => {
              const score = scoreMap.get(date) ?? null;
              const isFuture = date > todayISO_;
              const isAbove = score !== null && score >= threshold;
              return (
                <div
                  key={date}
                  title={score !== null ? `${date}: ${score}` : date}
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: 'var(--radius-sm)',
                    background: isFuture
                      ? 'transparent'
                      : score === null
                      ? 'var(--surface)'
                      : isAbove
                      ? 'var(--accent)'
                      : 'var(--surface-2)',
                    border: date === todayISO_ ? '1px solid var(--accent)' : '1px solid transparent',
                    minWidth: '2rem',
                    minHeight: '2rem',
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GroceryTab ───────────────────────────────────────────────────────────────
function GroceryTab() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newName, setNewName] = useState('');
  const [newGrams, setNewGrams] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const data = await getGroceryItems();
    setItems(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    haptic('light');
    await addGroceryItem(newName.trim(), newGrams ? parseFloat(newGrams) : null);
    setNewName('');
    setNewGrams('');
    await load();
    setLoading(false);
  };

  const handleToggle = async (id: number) => {
    haptic('light');
    await toggleGroceryItem(id);
    await load();
  };

  const handleClear = async () => {
    haptic('medium');
    await clearPurchasedGroceries();
    await load();
  };

  const hasPurchased = items.some(i => i.purchased);

  return (
    <div>
      {/* Add row */}
      <div className="section" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 2 }}>
          <div className="label" style={{ marginBottom: '0.3rem' }}>ITEM</div>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="CHICKEN BREAST"
          />
        </div>
        <div style={{ flex: 1 }}>
          <div className="label" style={{ marginBottom: '0.3rem' }}>GRAMS</div>
          <input
            type="number"
            value={newGrams}
            onChange={e => setNewGrams(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="500"
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={handleAdd}
          disabled={loading || !newName.trim()}
          style={{ flexShrink: 0 }}
        >
          ADD
        </button>
      </div>

      {/* Week label */}
      <div className="section-label">
        <span className="label">WEEK OF {currentWeekOf()}</span>
        <span className="label-xs">{items.length} ITEMS</span>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div style={{ padding: '2rem var(--page-pad)', textAlign: 'center' }}>
          <span className="label" style={{ color: 'var(--text-ghost)' }}>NO ITEMS THIS WEEK</span>
        </div>
      ) : (
        items.map(item => (
          <div key={item.id} className="row" style={{ cursor: 'default' }}>
            <button
              className="mono"
              onClick={() => handleToggle(item.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: item.purchased ? 'var(--positive)' : 'var(--text-ghost)',
                fontSize: '0.9rem', marginRight: '0.75rem', padding: 0,
                minWidth: '1.25rem',
              }}
            >
              {item.purchased ? '✓' : '○'}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                className="truncate"
                style={{
                  fontWeight: 600, fontSize: '0.8rem',
                  color: item.purchased ? 'var(--text-ghost)' : 'var(--text)',
                  textDecoration: item.purchased ? 'line-through' : 'none',
                  display: 'block',
                }}
              >
                {item.name}
              </span>
              {item.quantity_grams !== null && (
                <span className="label-xs">{item.quantity_grams}g</span>
              )}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                haptic('light');
                await toggleGroceryItem(item.id);
                await load();
              }}
              style={{ padding: '0.2rem 0.4rem', color: 'var(--text-ghost)' }}
            >
              ✕
            </button>
          </div>
        ))
      )}

      {/* Clear purchased */}
      {hasPurchased && (
        <div style={{ padding: 'var(--page-pad)' }}>
          <button className="btn btn-outline btn-block" onClick={handleClear}>
            CLEAR PURCHASED
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function NutritionContent() {
  useSearchParams(); // needed to satisfy Suspense boundary requirement
  const router = useRouter();

  const [mainTab, setMainTab] = useState<MainTab>('log');
  const [logMode, setLogMode] = useState<LogMode>('recents');
  const [trendsTab, setTrendsTab] = useState<TrendsTab>('week');

  const [logs, setLogs] = useState<MealLogWithFood[]>([]);
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [todayScore, setTodayScore] = useState<DailyScore | null>(null);
  const [allScores, setAllScores] = useState<DailyScore[]>([]);

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodResult | FoodItem | null>(null);

  const load = useCallback(async () => {
    const [rawLogs, prof, recents, score, scores] = await Promise.all([
      getMealLogs(todayISO()),
      getProfile(),
      getRecentFoods(8),
      getDailyScore(todayISO()),
      getDailyScores(400),
    ]);
    setLogs(rawLogs);
    setProfile(prof);
    setRecentFoods(recents);
    setTodayScore(score);
    setAllScores(scores);
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = MEAL_ORDER.reduce((acc, mt) => {
    acc[mt] = logs.filter(l => l.meal_type === mt);
    return acc;
  }, {} as Record<MealType, MealLogWithFood[]>);

  // Score recompute after log
  const reloadAndScore = async () => {
    await load();
    const score = await computeDailyScore(todayISO());
    setTodayScore(score);
  };

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true); setSearchError(''); setResults([]); setSelectedFood(null);
    try {
      const r = await searchFood(query.trim());
      if (r.length === 0) setSearchError('NO RESULTS');
      setResults(r);
    } catch { setSearchError('SEARCH FAILED'); }
    finally { setSearching(false); }
  };

  const logFoodItem = async (food: FoodItem, qty: number, mt: MealType) => {
    haptic('medium');
    await addMealLog({
      date: todayISO(), meal_type: mt, food_item_id: food.id,
      quantity: qty, logged_at: new Date().toISOString(), source: 'search',
    });
    setSelectedFood(null); setResults([]); setQuery('');
    await reloadAndScore();
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
    setSelectedFood(null); setResults([]); setQuery('');
    await reloadAndScore();
  };

  const handleLog = async (qty: number, mt: MealType) => {
    if (!selectedFood) return;
    if ('id' in selectedFood && typeof (selectedFood as FoodItem).id === 'number' && !(selectedFood as FoodResult).isGeneric !== undefined) {
      // Try as FoodItem first if it has numeric id and no isGeneric property
      const asItem = selectedFood as FoodItem;
      if (typeof asItem.id === 'number' && !('isGeneric' in selectedFood)) {
        await logFoodItem(asItem, qty, mt);
        return;
      }
    }
    // treat as search result
    await logFoodResult(selectedFood as FoodResult, qty, mt);
  };

  const totalScore = todayScore?.total_score ?? null;

  return (
    <div className="page" style={{ paddingTop: '4rem' }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: 'var(--page-pad)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div>
            <div className="label" style={{ color: 'var(--text-ghost)', marginBottom: '0.25rem' }}>
              EAT · {formatDate(new Date())}
            </div>
            <div className="page-title">FUEL</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="label-xs" style={{ marginBottom: '0.2rem' }}>TODAY</div>
            <div
              className="num-xl"
              style={{ color: totalScore !== null ? scoreColor(totalScore) : 'var(--text-ghost)' }}
            >
              {totalScore !== null ? totalScore : '—'}
            </div>
          </div>
        </div>

        {/* Score component grid */}
        <ScoreStatGrid score={todayScore} />
      </div>

      {/* ── MAIN TAB BAR ───────────────────────────────────────────────────── */}
      <div className="tab-bar">
        {(['log', 'trends', 'grocery'] as MainTab[]).map(t => (
          <button
            key={t}
            className={`tab ${mainTab === t ? 'active' : ''}`}
            onClick={() => setMainTab(t)}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: LOG
      ══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'log' && (
        <div>
          {/* Mode switcher */}
          <div className="tab-bar" style={{ borderBottom: 'none', borderTop: '1px solid var(--border)' }}>
            <button
              className={`tab ${logMode === 'recents' ? 'active' : ''}`}
              onClick={() => { setLogMode('recents'); setSelectedFood(null); }}
            >
              RECENTS
            </button>
            <button
              className={`tab ${logMode === 'search' ? 'active' : ''}`}
              onClick={() => { setLogMode('search'); setSelectedFood(null); }}
            >
              SEARCH
            </button>
          </div>

          {/* RECENTS mode */}
          {logMode === 'recents' && !selectedFood && (
            <div>
              {recentFoods.length === 0 ? (
                <div style={{ padding: '2rem var(--page-pad)', textAlign: 'center' }}>
                  <div className="label" style={{ color: 'var(--text-ghost)', marginBottom: '1rem' }}>
                    NO RECENT FOODS
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => setLogMode('search')}>
                    SEARCH FOOD →
                  </button>
                </div>
              ) : (
                recentFoods.map(food => (
                  <button
                    key={food.id}
                    className="row"
                    onClick={() => { haptic('light'); setSelectedFood(food); }}
                    style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="truncate" style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text)' }}>
                        {food.name}
                      </div>
                      {food.brand && (
                        <div className="label-xs">{food.brand}</div>
                      )}
                    </div>
                    <span className="num-sm" style={{ color: 'var(--accent)', marginRight: '0.25rem' }}>
                      {food.calories}
                    </span>
                    <span className="label-xs">kcal</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* SEARCH mode */}
          {logMode === 'search' && !selectedFood && (
            <div>
              <div className="section" style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doSearch()}
                  placeholder="SEARCH FOOD..."
                  autoFocus
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={doSearch}
                  disabled={searching}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {searching ? '···' : 'GO'}
                </button>
              </div>
              {searchError && (
                <div style={{ padding: '0.75rem var(--page-pad)' }}>
                  <span className="label" style={{ color: 'var(--text-muted)' }}>{searchError}</span>
                  {' · '}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSearchError('')}
                    style={{ display: 'inline' }}
                  >
                    TRY MANUAL
                  </button>
                </div>
              )}
              {results.map((r, i) => (
                <button
                  key={i}
                  className="row"
                  onClick={() => { haptic('light'); setSelectedFood(r); }}
                  style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.1rem' }}>
                      <span className="truncate" style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text)' }}>
                        {r.name}
                      </span>
                      {r.isGeneric && <span className="badge" style={{ color: 'var(--accent)' }}>WHOLE</span>}
                    </div>
                    {r.brand && <span className="label-xs">{r.brand}</span>}
                  </div>
                  <span className="num-sm" style={{ color: 'var(--accent)', marginRight: '0.25rem' }}>
                    {r.calories}
                  </span>
                  <span className="label-xs">kcal</span>
                </button>
              ))}
            </div>
          )}

          {/* Food log panel — shown when food selected */}
          {selectedFood && (
            <FoodLogPanel
              selected={selectedFood}
              onLog={handleLog}
              onCancel={() => setSelectedFood(null)}
            />
          )}

          {/* Today's totals + meal groups */}
          <TotalsSection logs={logs} profile={profile} />

          <div style={{ marginTop: 'var(--page-pad)' }}>
            {MEAL_ORDER.map(mt => (
              <MealGroup
                key={mt}
                type={mt}
                logs={grouped[mt]}
                onDelete={async id => { haptic('light'); await deleteMealLog(id); await reloadAndScore(); }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: TRENDS
      ══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'trends' && (
        <div>
          <div className="tab-bar">
            {(['day', 'week', 'year'] as TrendsTab[]).map(t => (
              <button
                key={t}
                className={`tab ${trendsTab === t ? 'active' : ''}`}
                onClick={() => setTrendsTab(t)}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {trendsTab === 'day' && (
            <div>
              <div style={{ padding: 'var(--page-pad)' }}>
                <div className="label" style={{ marginBottom: '0.5rem', color: 'var(--text-ghost)' }}>
                  TODAY&apos;S ACTUALS VS TARGETS
                </div>
              </div>
              <ScoreStatGrid score={todayScore} />
              <TotalsSection logs={logs} profile={profile} />
            </div>
          )}

          {trendsTab === 'week' && (
            <div>
              <div style={{ padding: 'var(--page-pad) var(--page-pad) 0' }}>
                <div className="label" style={{ color: 'var(--text-ghost)' }}>THIS WEEK</div>
              </div>
              <WeekGrid scores={allScores} />
            </div>
          )}

          {trendsTab === 'year' && (
            <div>
              <YearGrid scores={allScores} />
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: GROCERY
      ══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'grocery' && <GroceryTab />}
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
