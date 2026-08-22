'use client';

// ScoreSilhouette.tsx
// Vitruvian Man — fills from feet up with #1F58F2 as score increases
// Geometric circle + square framing, arms extended

interface Props {
  score: number; // 0–100
  height?: number;
}

export default function ScoreSilhouette({ score, height = 160 }: Props) {
  const pct = Math.max(0, Math.min(100, score));
  const uid = Math.random().toString(36).slice(2, 7);
  const clipId = `vit-clip-${uid}`;
  const glowId = `vit-glow-${uid}`;

  // Body spans from y=8 (top of head) to y=192 (feet)
  const bodyTop = 8;
  const bodyBot = 192;
  const bodyH   = bodyBot - bodyTop;
  const fillY   = bodyBot - (pct / 100) * bodyH;

  return (
    <div style={{ flexShrink: 0 }}>
      <svg
        width={height * 0.72}
        height={height}
        viewBox="0 0 144 200"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          {/* Rising fill clip */}
          <clipPath id={clipId}>
            <rect x="0" y={fillY} width="144" height={bodyBot - fillY} />
          </clipPath>

          {/* Cobalt glow */}
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Geometric framing — circle + square ── */}
        {/* Outer circle */}
        <circle
          cx="72" cy="96" r="68"
          fill="none"
          stroke="rgba(216,234,255,0.07)"
          strokeWidth="0.5"
        />
        {/* Inner square */}
        <rect
          x="20" y="44" width="104" height="104"
          fill="none"
          stroke="rgba(216,234,255,0.07)"
          strokeWidth="0.5"
        />

        {/* ── Dim base figure ── */}
        <path d={VITRUVIAN} fill="rgba(216,234,255,0.07)" stroke="rgba(216,234,255,0.10)" strokeWidth="0.4" />

        {/* ── Cobalt filled figure (clipped to rising rect) ── */}
        <g clipPath={`url(#${clipId})`}>
          <path
            d={VITRUVIAN}
            fill="#1F58F2"
            filter={pct > 5 ? `url(#${glowId})` : undefined}
          />
        </g>

        {/* ── Waterline ── */}
        {pct > 2 && pct < 98 && (
          <line
            x1="20" y1={fillY}
            x2="124" y2={fillY}
            stroke="#1F58F2"
            strokeWidth="0.6"
            strokeOpacity="0.5"
            strokeDasharray="3 3"
          />
        )}

        {/* ── Framing dots at circle/square intersections ── */}
        {[
          [72, 28], [72, 164],  // top/bottom of circle
          [20, 96], [124, 96],  // left/right of square
        ].map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r="1.5"
            fill={pct > (i * 25) ? '#1F58F2' : 'rgba(216,234,255,0.15)'}
          />
        ))}
      </svg>
    </div>
  );
}

// Vitruvian man path — 144×200 viewBox
// Head centered at (72,20), arms extended wide, legs in A-stance
// Classic da Vinci proportions
const VITRUVIAN = `
  M72,8
  C67,8 63,12 63,18
  C63,24 67,28 72,28
  C77,28 81,24 81,18
  C81,12 77,8 72,8 Z

  M40,32
  C34,33 30,38 29,44
  L4,80
  C3,84 5,87 8,86
  L28,78
  L32,96
  L8,130
  C6,133 8,136 11,136
  L36,128
  L44,160
  L48,192
  C48,194 50,196 52,196
  L62,196
  C64,196 66,194 66,192
  L68,148
  L72,146
  L76,148
  L78,192
  C78,194 80,196 82,196
  L92,196
  C94,196 96,194 96,192
  L100,160
  L108,128
  L133,136
  C136,136 138,133 136,130
  L112,96
  L116,78
  L136,86
  C139,87 141,84 140,80
  L115,44
  C114,38 110,33 104,32
  L92,30
  C88,36 81,40 72,40
  C63,40 56,36 52,30
  Z

  M29,44
  L4,80

  M115,44
  L140,80
`.trim();
