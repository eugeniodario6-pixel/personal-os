'use client';

import { useEffect, useState } from 'react';

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Start fade after 1.5s
    const fadeTimer = setTimeout(() => setFading(true), 1500);
    // Remove from DOM after fade completes
    const removeTimer = setTimeout(() => setVisible(false), 2200);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: '#080909',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.7s cubic-bezier(0.4,0,0.2,1)',
      pointerEvents: fading ? 'none' : 'all',
    }}>
      {/* Batman logo */}
      <img
        src="/batman-splash.png"
        alt=""
        style={{
          width: 140,
          height: 140,
          objectFit: 'contain',
          opacity: fading ? 0 : 1,
          transform: fading ? 'scale(0.95)' : 'scale(1)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
        }}
      />

      {/* Wordmark */}
      <p style={{
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 10,
        letterSpacing: '0.25em',
        color: 'rgba(216,234,255,0.25)',
        margin: 0,
        textTransform: 'uppercase',
      }}>
        Personal OS
      </p>
    </div>
  );
}
