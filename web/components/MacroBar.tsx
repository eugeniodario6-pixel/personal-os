import styles from './MacroBar.module.css';

interface MacroBarProps {
  label: string;
  value: number;
  target: number;
  unit: string;
}

export default function MacroBar({ label, value, target, unit }: MacroBarProps) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;

  let valueColor: string;
  if (value >= target) {
    valueColor = 'var(--positive)';
  } else if (value >= target * 0.8) {
    valueColor = 'var(--neutral-fill)';
  } else {
    valueColor = 'var(--text-primary)';
  }

  let barColor: string;
  if (value > target) {
    barColor = 'var(--negative)';
  } else if (value >= target * 0.8) {
    barColor = 'var(--positive)';
  } else {
    barColor = 'var(--neutral-fill)';
  }

  return (
    <div className={styles.macro}>
      <div className={styles.row}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value} style={{ color: valueColor }}>
          {Math.round(value)}{unit}
        </span>
        <span className={styles.target}>/ {target}{unit}</span>
      </div>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}
