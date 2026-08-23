'use client';

// ScoreDonut.tsx
// SVG donut chart showing score pillar breakdown
// No external deps — pure React + SVG

interface Pillar {
  name: string;
  score: number;
  maxScore: number;
  reason: string;
}

interface Props {
  pillars: Pillar[];
  total: number;
}

const COLORS = [
  '#1f58f2', // Nutrition — cobalt
  '#4a7fff', // Training — lighter cobalt
  '#78dc64', // Morning — lime
  '#6478ff', // Evening — violet
  '#ff9500', // Streak — amber
];

const SIZE = 200;
const STROKE = 18;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const CX = SIZE / 2;
const CY = SIZE / 2;

export default function ScoreDonut({ pillars, total }: Props) {
  const maxTotal = pillars.reduce((s, p) => s + p.maxScore, 0);

  // Build arc segments
  let offset = 0;
  const GAP = 3; // gap between segments in px along circumference
  const segments = pillars.map((p, i) => {
    const proportion = p.maxScore / maxTotal;
    const totalArcLen = proportion * CIRC - GAP;
    const fillLen = p.maxScore > 0 ? (p.score / p.maxScore) * totalArcLen : 0;
    const seg = { ...p, proportion, totalArcLen, fillLen, offset, color: COLORS[i] };
    offset += proportion * CIRC;
    return seg;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>

      {/* Donut */}
      <div style={{ position: 'relative', flexShrink: 0, width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
          {segments.map((seg, i) => (
            <g key={i}>
              {/* Track arc */}
              <circle
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke="rgba(216,234,255,0.06)"
                strokeWidth={STROKE}
                strokeDasharray={`${seg.totalArcLen} ${CIRC - seg.totalArcLen}`}
                strokeDashoffset={-seg.offset}
                strokeLinecap="round"
              />
              {/* Fill arc */}
              {seg.fillLen > 0 && (
                <circle
                  cx={CX} cy={CY} r={R}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${seg.fillLen} ${CIRC - seg.fillLen}`}
                  strokeDashoffset={-seg.offset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)' }}
                />
              )}
            </g>
          ))}
        </svg>

        {/* Centre label */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            color: 'var(--color-electric-cobalt)',
          }}>
            {total}
          </span>
          <span style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.15em',
            color: 'rgba(216,234,255,0.30)',
            textTransform: 'uppercase',
            marginTop: 4,
          }}>
            / {maxTotal}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Colour dot */}
            <div style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: seg.score > 0 ? seg.color : 'rgba(216,234,255,0.12)',
            }} />
            {/* Label + score */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  color: seg.score > 0 ? 'rgba(216,234,255,0.55)' : 'rgba(216,234,255,0.25)',
                }}>
                  {seg.name}
                </span>
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: seg.score === seg.maxScore
                    ? seg.color
                    : seg.score > 0
                    ? 'rgba(216,234,255,0.85)'
                    : 'rgba(216,234,255,0.25)',
                }}>
                  {seg.score}
                  <span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(216,234,255,0.25)' }}>
                    /{seg.maxScore}
                  </span>
                </span>
              </div>
              {/* Mini progress bar */}
              <div style={{
                height: 2,
                background: 'rgba(216,234,255,0.06)',
                borderRadius: 99,
                overflow: 'hidden',
                marginTop: 4,
              }}>
                <div style={{
                  height: '100%',
                  width: `${seg.maxScore > 0 ? (seg.score / seg.maxScore) * 100 : 0}%`,
                  background: seg.color,
                  borderRadius: 99,
                  transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
                }} />
              </div>
              <span style={{
                fontSize: 10,
                color: 'rgba(216,234,255,0.28)',
                display: 'block',
                marginTop: 3,
                letterSpacing: '0.02em',
              }}>
                {seg.reason}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
