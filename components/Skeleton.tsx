'use client';

export function Skeleton({ width = '100%', height = 16, radius = 4, style = {} }: {
  width?: string | number;
  height?: number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'var(--color-graphite)',
      position: 'relative', overflow: 'hidden',
      ...style,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
        animation: 'shimmer 1.4s infinite',
      }} />
      <style>{`
        @keyframes shimmer {
          from { transform: translateX(-100%); }
          to   { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '5rem', paddingBottom: '5rem' }}>
      {/* Hero */}
      <div style={{ padding: '0 16px 32px', borderBottom: '1px solid var(--border)' }}>
        <Skeleton width={120} height={11} radius={3} style={{ marginBottom: 24 }} />
        <Skeleton width={180} height={80} radius={6} style={{ marginBottom: 16 }} />
        <Skeleton width={100} height={12} radius={3} style={{ marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
          {[0,1,2,3].map(i => (
            <div key={i}>
              <Skeleton height={3} radius={999} style={{ marginBottom: 6 }} />
              <Skeleton width={32} height={10} radius={2} />
            </div>
          ))}
        </div>
      </div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--border)' }}>
        {[0,1].map(i => (
          <div key={i} style={{ padding: '20px 16px', borderRight: i === 0 ? '1px solid var(--border)' : 'none' }}>
            <Skeleton width={60} height={11} radius={3} style={{ marginBottom: 10 }} />
            <Skeleton width={100} height={32} radius={4} style={{ marginBottom: 8 }} />
            <Skeleton width={60} height={11} radius={3} style={{ marginBottom: 12 }} />
            <Skeleton height={3} radius={999} />
          </div>
        ))}
      </div>
      {/* Habits */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
        <Skeleton width={48} height={12} radius={3} />
        <Skeleton width={60} height={12} radius={3} />
      </div>
      {[0,1,2].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <Skeleton width={20} height={20} radius={4} style={{ flexShrink: 0 }} />
          <Skeleton height={14} radius={3} />
        </div>
      ))}
    </div>
  );
}
