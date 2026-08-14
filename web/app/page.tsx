'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import WaffleGrid from '@/components/WaffleGrid';
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

interface DayData {
  date: string;
  calories: number;
  target: number;
  isFuture: boolean;
}

const TARGETS = {
  calories: 1800,
  protein_g: 185,
  carbs_g: 45,
  fat_g: 98,
};

function formatDate(d: Date): string {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem('theme', next);
  } catch (_) {}
}

export default function TodayPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [waffleData, setWaffleData] = useState<DayData[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const todayStr = toISODate(today);

  const fetchMeals = useCallback(async () => {
    try {
      const res = await fetch(`/api/meals?date=${todayStr}`);
      if (res.ok) {
        const data = await res.json();
        setMeals(data);
      }
    } catch (_) {}
    setLoading(false);
  }, [todayStr]);

  const fetchWaffleData = useCallback(async () => {
    try {
      const res = await fetch(`/api/meals/history?days=30`);
      if (res.ok) {
        const data = await res.json();
        setWaffleData(data);
      }
    } catch (_) {
      // Build 30 days of empty data as fallback
      const days: DayData[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push({
          date: toISODate(d),
          calories: 0,
          target: TARGETS.calories,
          isFuture: false,
        });
      }
      setWaffleData(days);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    if (stored === 'light' || stored === 'dark') setTheme(stored);
    else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
    fetchMeals();
    fetchWaffleData();
  }, [fetchMeals, fetchWaffleData]);

  const totalCalories = meals.reduce((s, m) => s + m.calories, 0);
  const totalProtein = meals.reduce((s, m) => s + m.protein_g, 0);
  const totalCarbs = meals.reduce((s, m) => s + m.carbs_g, 0);
  const totalFat = meals.reduce((s, m) => s + m.fat_g, 0);

  const calPct = Math.min(100, (totalCalories / TARGETS.calories) * 100);
  const remaining = TARGETS.calories - totalCalories;
  const isOver = totalCalories > TARGETS.calories;
  const isOnTrack = totalCalories >= TARGETS.calories * 0.9;

  let calColor = 'var(--text-primary)';
  if (totalCalories > TARGETS.calories) calColor = 'var(--negative)';
  else if (isOnTrack) calColor = 'var(--positive)';

  const barColor = isOver ? 'var(--negative)' : 'var(--positive)';

  const handleToggleTheme = () => {
    toggleTheme();
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  return (
    <main className={styles.main}>
      {/* Theme toggle */}
      <button className={styles.themeToggle} onClick={handleToggleTheme} aria-label="Toggle theme">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerLabel}>today</span>
        <span className={styles.headerDate}>{formatDate(today)}</span>
      </div>

      {/* Calorie hero card */}
      <div className={`${styles.card} ${styles.cardMargin}`}>
        <div className={styles.cardTopRow}>
          <span className={styles.cardLabel}>calories</span>
          <span className={styles.pill}>fat loss · phase 1</span>
        </div>
        <div className={styles.heroRow}>
          <span className={styles.heroValue} style={{ color: calColor }}>
            {totalCalories}
          </span>
          <span className={styles.heroTarget}>/ {TARGETS.calories}</span>
        </div>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{ width: `${calPct}%`, background: barColor }}
          />
        </div>
        <div className={styles.remaining} style={{ color: isOver ? 'var(--negative)' : 'var(--text-secondary)' }}>
          {isOver
            ? `+ ${Math.abs(remaining)} kcal over`
            : `– ${remaining} kcal remaining`}
        </div>
      </div>

      {/* Macro row */}
      <div className={styles.macroRow}>
        {[
          { label: 'protein', value: totalProtein, target: TARGETS.protein_g },
          { label: 'carbs', value: totalCarbs, target: TARGETS.carbs_g },
          { label: 'fat', value: totalFat, target: TARGETS.fat_g },
        ].map((m) => {
          let vc = 'var(--text-primary)';
          if (m.value >= m.target) vc = 'var(--positive)';
          else if (m.value >= m.target * 0.8) vc = 'var(--neutral-fill)';
          return (
            <div key={m.label} className={styles.macroCard}>
              <span className={styles.macroLabel}>{m.label}</span>
              <span className={styles.macroValue} style={{ color: vc }}>
                {Math.round(m.value)}g
              </span>
              <span className={styles.macroTarget}>/ {m.target}g</span>
            </div>
          );
        })}
      </div>

      {/* Waffle grid card */}
      <div className={`${styles.card} ${styles.cardMargin}`}>
        <div className={`${styles.cardLabel} ${styles.waffleLabel}`}>
          adherence — last 30 days
        </div>
        <WaffleGrid days={waffleData} />
      </div>

      {/* Today's meals preview */}
      <div className={styles.card}>
        <div className={styles.mealsHeader}>
          <span className={styles.cardLabel}>meals today</span>
          <Link href="/meals" className={styles.addLink}>add +</Link>
        </div>
        {loading ? (
          <div className={styles.emptyMeals}>loading…</div>
        ) : meals.length === 0 ? (
          <div className={styles.emptyMeals}>no meals logged yet</div>
        ) : (
          <ul className={styles.mealList}>
            {meals.map((meal, idx) => (
              <li
                key={meal.id}
                className={styles.mealRow}
                style={{ borderBottom: idx < meals.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <span className={styles.mealName}>{meal.name}</span>
                <span className={styles.mealCal}>{meal.calories} kcal</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
