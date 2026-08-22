'use client';

// ── ScoreRing ─────────────────────────────────────────────────────────────────
// Circular score indicator. Drop into any page header.
// Props:
//   score   0–100
//   label   optional text under the number (default: auto from score)
//   size    px diameter (default 56)

const LABELS = [
  [90, 'Elite'],
  [75, 'Strong'],
  [55, 'Solid'],
  [35, 'Building'],
  [0,  "Let's go"],
] as const;

function autoLabel(score: number) {
  for (const [min, lbl] of LABELS) if (score >= min) return lbl;
  return "Let's go";
}

export function ScoreRing({
  score,
  label,
  size = 56,
}: {
  score: number;
  label?: string;
  size?: number;
}) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const dash = (pct / 100) * circ;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* track */}
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={3}
          />
          {/* progress */}
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={pct >= 80 ? '#DAFF01' : pct >= 55 ? 'rgba(218,255,1,0.65)' : 'rgba(218,255,1,0.35)'}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 0.5s cubic-bezier(0.4,0,0.2,1)' }}
          />
        </svg>
        {/* number */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: size < 52 ? '0.7rem' : '0.875rem',
            fontWeight: 510,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            lineHeight: 1,
          }}>
            {Math.round(pct)}
          </span>
        </div>
      </div>
      <span style={{
        fontSize: '0.5rem',
        letterSpacing: '0.06em',
        color: 'var(--text-5)',
        fontFamily: 'var(--font-mono)',
        textAlign: 'center',
      }}>
        {label ?? autoLabel(score)}
      </span>
    </div>
  );
}
