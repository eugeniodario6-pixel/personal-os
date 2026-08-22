'use client';

// ScoreSilhouette.tsx
// Human silhouette that fills from feet up with #DAFF01 as score increases.
// 0 = empty (dark outline), 100 = fully filled lime.

interface Props {
  score: number; // 0–100
  height?: number;
}

export default function ScoreSilhouette({ score, height = 160 }: Props) {
  const pct = Math.max(0, Math.min(100, score));
  const fillId = 'sf-fill';
  const clipId = 'sf-clip';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, userSelect: 'none' }}>
      <svg
        width={height * 0.55}
        height={height}
        viewBox="0 0 110 200"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Rising fill rect — fills from bottom (y increases downward) */}
          <clipPath id={clipId}>
            <rect
              x="0"
              y={200 - (pct / 100) * 200}
              width="110"
              height={(pct / 100) * 200}
              style={{ transition: 'y 1s cubic-bezier(0.4,0,0.2,1), height 1s cubic-bezier(0.4,0,0.2,1)' }}
            />
          </clipPath>

          {/* Glow filter */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Dark base silhouette (always visible) */}
        <path
          d={SILHOUETTE}
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="0.5"
        />

        {/* Lime filled silhouette clipped by rising rect */}
        <g clipPath={`url(#${clipId})`}>
          <path
            d={SILHOUETTE}
            fill="#DAFF01"
            filter={pct > 10 ? `url(#glow)` : undefined}
            style={{ transition: 'opacity 0.5s' }}
          />
        </g>

        {/* Fill level waterline — subtle */}
        {pct > 2 && pct < 98 && (
          <line
            x1="0" y1={200 - (pct / 100) * 200}
            x2="110" y2={200 - (pct / 100) * 200}
            stroke="#DAFF01"
            strokeWidth="0.5"
            strokeOpacity="0.4"
          />
        )}
      </svg>

      {/* Score label below silhouette */}
      <span style={{
        fontSize: 11,
        fontWeight: 510,
        letterSpacing: '0.06em',
        color: pct >= 75 ? '#DAFF01' : 'rgba(255,255,255,0.3)',
        fontFamily: 'var(--font-mono)',
        transition: 'color 0.5s',
      }}>
        {pct}/100
      </span>
    </div>
  );
}

// Human silhouette path — fits in 110×200 viewBox
// Standing figure, arms slightly out, viewed from front
const SILHOUETTE = `
M55,2
C49,2 44,7 44,14
C44,21 49,26 55,26
C61,26 66,21 66,14
C66,7 61,2 55,2 Z

M38,30
C32,31 27,35 26,42
L22,68
C21,72 24,75 27,75
L30,75
L28,110
L24,170
C24,173 26,175 29,175
L36,175
C39,175 41,173 41,170
L44,130
L55,128
L66,130
L69,170
C69,173 71,175 74,175
L81,175
C84,175 86,173 86,170
L82,110
L80,75
L83,75
C86,75 89,72 88,68
L84,42
C83,35 78,31 72,30
L65,28
C62,33 59,36 55,36
C51,36 48,33 45,28
Z

M26,42
L10,55
C7,57 7,61 10,63
L20,68
L22,68

M84,42
L100,55
C103,57 103,61 100,63
L90,68
L88,68
`;
