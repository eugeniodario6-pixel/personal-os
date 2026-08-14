'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import styles from './page.module.css';

interface Meal {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  date: string;
}

interface FoodResult {
  food_id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_description: string;
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDate(d: Date): string {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

export default function MealsPage() {
  const today = new Date();
  const todayStr = toISODate(today);

  const [meals, setMeals] = useState<Meal[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodResult[]>([]);
  const [selected, setSelected] = useState<FoodResult | null>(null);
  const [servings, setServings] = useState('1.0');
  const [formName, setFormName] = useState('');
  const [formCal, setFormCal] = useState('');
  const [formProtein, setFormProtein] = useState('');
  const [formCarbs, setFormCarbs] = useState('');
  const [formFat, setFormFat] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMeals = useCallback(async () => {
    try {
      const res = await fetch(`/api/meals?date=${todayStr}`);
      if (res.ok) setMeals(await res.json());
    } catch (_) {}
  }, [todayStr]);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/food-search?q=${encodeURIComponent(query)}`);
        if (res.ok) setResults(await res.json());
      } catch (_) {}
      setSearching(false);
    }, 400);
  }, [query]);

  const selectFood = (food: FoodResult) => {
    setSelected(food);
    setServings('1.0');
    setFormName(food.name);
    setFormCal(String(food.calories));
    setFormProtein(String(food.protein_g));
    setFormCarbs(String(food.carbs_g));
    setFormFat(String(food.fat_g));
    setResults([]);
    setQuery('');
  };

  const handleServingsChange = (val: string) => {
    setServings(val);
    if (!selected) return;
    const mult = parseFloat(val) || 1;
    setFormCal(String(Math.round(selected.calories * mult)));
    setFormProtein(String(Math.round(selected.protein_g * mult * 10) / 10));
    setFormCarbs(String(Math.round(selected.carbs_g * mult * 10) / 10));
    setFormFat(String(Math.round(selected.fat_g * mult * 10) / 10));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formCal) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          calories: parseInt(formCal) || 0,
          protein_g: parseFloat(formProtein) || 0,
          carbs_g: parseFloat(formCarbs) || 0,
          fat_g: parseFloat(formFat) || 0,
          date: todayStr,
        }),
      });
      if (res.ok) {
        setSelected(null);
        setFormName('');
        setFormCal('');
        setFormProtein('');
        setFormCarbs('');
        setFormFat('');
        setServings('1.0');
        setQuery('');
        await fetchMeals();
      }
    } catch (_) {}
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/meals?id=${id}`, { method: 'DELETE' });
      await fetchMeals();
    } catch (_) {}
  };

  const totalCal = meals.reduce((s, m) => s + m.calories, 0);
  const totalProtein = meals.reduce((s, m) => s + m.protein_g, 0);

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>meals</span>
        <span className={styles.headerDate}>{formatDate(today)}</span>
      </div>

      {/* Food search */}
      <div className={`${styles.card} ${styles.cardMargin}`}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="search foods…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {searching && (
          <div className={styles.searchStatus}>searching…</div>
        )}

        {results.length > 0 && (
          <ul className={styles.resultsList}>
            {results.map((food) => (
              <li
                key={food.food_id}
                className={styles.resultRow}
                onClick={() => selectFood(food)}
              >
                <span className={styles.resultName}>{food.name}</span>
                <span className={styles.resultCal}>{food.calories} kcal</span>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <form className={styles.logForm} onSubmit={handleSubmit}>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>name</label>
              <input
                className={styles.formInput}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>servings</label>
              <input
                className={styles.formInput}
                type="number"
                step="0.1"
                min="0.1"
                value={servings}
                onChange={(e) => handleServingsChange(e.target.value)}
              />
            </div>
            <div className={styles.formGrid}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>kcal</label>
                <input
                  className={styles.formInput}
                  type="number"
                  value={formCal}
                  onChange={(e) => setFormCal(e.target.value)}
                />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>protein</label>
                <input
                  className={styles.formInput}
                  type="number"
                  step="0.1"
                  value={formProtein}
                  onChange={(e) => setFormProtein(e.target.value)}
                />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>carbs</label>
                <input
                  className={styles.formInput}
                  type="number"
                  step="0.1"
                  value={formCarbs}
                  onChange={(e) => setFormCarbs(e.target.value)}
                />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>fat</label>
                <input
                  className={styles.formInput}
                  type="number"
                  step="0.1"
                  value={formFat}
                  onChange={(e) => setFormFat(e.target.value)}
                />
              </div>
            </div>
            <button className={styles.logBtn} type="submit" disabled={submitting}>
              {submitting ? 'logging…' : 'log meal'}
            </button>
          </form>
        )}

        {!selected && !results.length && !searching && query === '' && (
          <div className={styles.searchHint}>type to search the food database</div>
        )}
      </div>

      {/* Today's meals */}
      <div className={styles.card}>
        <div className={styles.cardLabel}>meals today</div>
        {meals.length === 0 ? (
          <div className={styles.emptyMeals}>no meals logged yet</div>
        ) : (
          <>
            <ul className={styles.mealList}>
              {meals.map((meal, idx) => (
                <li
                  key={meal.id}
                  className={styles.mealRow}
                  style={{
                    borderBottom: idx < meals.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <span className={styles.mealName}>{meal.name}</span>
                  <span className={styles.mealCal}>{meal.calories}</span>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(meal.id)}
                    aria-label={`Delete ${meal.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className={styles.total}>
              total: {totalCal} kcal · {Math.round(totalProtein)}g protein
            </div>
          </>
        )}
      </div>
    </main>
  );
}
