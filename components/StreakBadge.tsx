import React from 'react';

interface StreakBadgeProps {
  streak: number;
}

export default function StreakBadge({ streak }: StreakBadgeProps) {
  if (streak === 0) {
    return (
      <span style={{ fontWeight: 700, color: '#444' }}>[ — ]</span>
    );
  }

  if (streak >= 90) {
    return (
      <span style={{
        fontWeight: 700,
        fontSize: '1.1rem',
        textShadow: '0 0 12px rgba(255,180,0,0.8)',
      }}>
        🔥🔥🔥 {streak}
      </span>
    );
  }

  if (streak >= 30) {
    return (
      <span style={{
        fontWeight: 700,
        fontSize: '1.05rem',
        textShadow: '0 0 12px rgba(255,180,0,0.8)',
      }}>
        🔥🔥 {streak}
      </span>
    );
  }

  if (streak >= 7) {
    return (
      <span style={{
        fontWeight: 700,
        textShadow: '0 0 12px rgba(255,180,0,0.8)',
      }}>
        🔥 {streak}
      </span>
    );
  }

  // 1–6
  return (
    <span style={{ fontWeight: 700 }}>
      🔥 {streak}
    </span>
  );
}
