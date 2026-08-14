import styles from './WaffleGrid.module.css';

interface DayData {
  date: string;
  calories: number;
  target: number;
  isFuture: boolean;
}

interface WaffleGridProps {
  days: DayData[];
}

export default function WaffleGrid({ days }: WaffleGridProps) {
  return (
    <div>
      <div className={styles.grid}>
        {days.map((d) => {
          let cellClass = styles.cell;

          if (d.isFuture) {
            cellClass = `${styles.cell} ${styles.future}`;
          } else if (d.calories > 0 && d.calories <= d.target) {
            cellClass = `${styles.cell} ${styles.hit}`;
          } else if (d.calories > d.target) {
            cellClass = `${styles.cell} ${styles.over}`;
          } else {
            cellClass = `${styles.cell} ${styles.missed}`;
          }

          return (
            <div
              key={d.date}
              className={cellClass}
              title={d.isFuture ? d.date : `${d.date}: ${d.calories} kcal`}
            />
          );
        })}
      </div>
      <div className={styles.legend}>
        <span className={`${styles.dot} ${styles.hitDot}`} />
        <span className={styles.legendLabel}>hit</span>
        <span className={`${styles.dot} ${styles.overDot}`} />
        <span className={styles.legendLabel}>logged</span>
        <span className={`${styles.dot} ${styles.missedDot}`} />
        <span className={styles.legendLabel}>missed</span>
      </div>
    </div>
  );
}
