'use client';

// ScoreSilhouette.tsx
// Uses the exact Vitruvian Man SVG provided by Batman
// Fills from feet up with #1F58F2 as score increases (0–100)

interface Props {
  score: number; // 0–100
  height?: number;
}

export default function ScoreSilhouette({ score, height = 160 }: Props) {
  const pct = Math.max(0, Math.min(100, score));
  const clipId = `vitruvian-clip-${pct}`;

  // SVG viewBox is 0 0 361.89 362.32
  // Fill rises from bottom (362.32) to top (0)
  const fillY = 362.32 - (pct / 100) * 362.32;

  return (
    <div style={{ flexShrink: 0 }}>
      <svg
        width={height * (361.89 / 362.32)}
        height={height}
        viewBox="0 0 361.89 362.32"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          {/* Rising fill clip — grows from feet up */}
          <clipPath id={clipId}>
            <rect x="0" y={fillY} width="361.89" height={362.32 - fillY} />
          </clipPath>
        </defs>

        {/* Dim base figure */}
        <image
          href="/vitruvian.svg"
          x="0" y="0"
          width="361.89"
          height="362.32"
          style={{ opacity: 0.12 }}
        />

        {/* Cobalt filled figure, clipped to rising rect */}
        <g clipPath={`url(#${clipId})`}>
          <image
            href="/vitruvian.svg"
            x="0" y="0"
            width="361.89"
            height="362.32"
            style={{ filter: 'invert(1) sepia(1) saturate(10) hue-rotate(190deg)' }}
          />
        </g>
      </svg>
    </div>
  );
}
