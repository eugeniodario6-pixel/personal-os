'use client';

// ScoreSilhouette.tsx
// Human silhouette fills from feet up with #1F58F2 as score increases.

interface Props {
  score: number; // 0–100
  height?: number;
}

export default function ScoreSilhouette({ score, height = 148 }: Props) {
  const pct = Math.max(0, Math.min(100, score));
  const clipId = `sf-clip-${Math.random().toString(36).slice(2, 7)}`;

  // viewBox is 100×220
  const fillY = 220 - (pct / 100) * 220;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <svg
        width={height * 0.5}
        height={height}
        viewBox="0 0 100 220"
        style={{ overflow: 'visible', display: 'block' }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x="0"
              y={fillY}
              width="100"
              height={220 - fillY}
            />
          </clipPath>
          <filter id="cobalt-glow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Dim base */}
        <path d={BODY} fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />

        {/* Filled portion */}
        <g clipPath={`url(#${clipId})`}>
          <path
            d={BODY}
            fill="#1F58F2"
            filter={pct > 5 ? 'url(#cobalt-glow)' : undefined}
            style={{ transition: 'filter 0.5s' }}
          />
        </g>

        {/* Waterline */}
        {pct > 3 && pct < 97 && (
          <line
            x1="10" y1={fillY}
            x2="90" y2={fillY}
            stroke="#1F58F2"
            strokeWidth="0.8"
            strokeOpacity="0.5"
            strokeDasharray="2 2"
          />
        )}
      </svg>

      <span style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.05em',
        color: pct >= 50 ? '#1F58F2' : 'rgba(255,255,255,0.25)',
        fontFamily: 'var(--font-mono, monospace)',
        transition: 'color 0.5s',
      }}>
        {pct}
      </span>
    </div>
  );
}

// Clean human silhouette — head, torso, arms, legs — fits 100×220 viewBox
const BODY = `
  M50,2
  C43,2 37,8 37,16
  C37,24 43,30 50,30
  C57,30 63,24 63,16
  C63,8 57,2 50,2 Z

  M33,34
  C24,36 18,43 17,52
  L12,82
  C11,87 14,90 18,89
  L20,89
  L18,130
  L14,188
  C14,192 17,194 20,194
  L30,194
  C33,194 36,192 36,188
  L40,148
  L50,146
  L60,148
  L64,188
  C64,192 67,194 70,194
  L80,194
  C83,194 86,192 86,188
  L82,130
  L80,89
  L82,89
  C86,90 89,87 88,82
  L83,52
  C82,43 76,36 67,34
  L61,32
  C58,37 54,40 50,40
  C46,40 42,37 39,32
  Z

  M17,52
  L4,66
  C1,69 2,74 5,76
  L17,82
  L20,89

  M83,52
  L96,66
  C99,69 98,74 95,76
  L83,82
  L80,89
`.trim();
