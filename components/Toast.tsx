'use client';

import { useEffect, useState } from 'react';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'success' | 'error' | 'info';
}

// Global toast emitter — call from anywhere
type Listener = (msg: ToastMessage) => void;
const listeners: Listener[] = [];

export function toast(text: string, type: ToastMessage['type'] = 'success') {
  const msg: ToastMessage = { id: Math.random().toString(36).slice(2), text, type };
  listeners.forEach(l => l(msg));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (msg: ToastMessage) => {
      setToasts(prev => [...prev, msg]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== msg.id)), 2400);
    };
    listeners.push(handler);
    return () => { const i = listeners.indexOf(handler); if (i > -1) listeners.splice(i, 1); };
  }, []);

  if (!toasts.length) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 0, right: 0,
      zIndex: 500,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 8, pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === 'error'
            ? 'rgba(235,87,87,0.12)'
            : t.type === 'info'
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(228,242,34,0.10)',
          border: `1px solid ${
            t.type === 'error'
              ? 'rgba(235,87,87,0.3)'
              : t.type === 'info'
              ? 'rgba(255,255,255,0.1)'
              : 'rgba(228,242,34,0.25)'
          }`,
          borderRadius: 9999,
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 400,
          letterSpacing: '-0.011em',
          color: t.type === 'error'
            ? 'var(--color-coral-red)'
            : t.type === 'info'
            ? 'var(--color-mist)'
            : 'var(--color-acid-lime)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: 'var(--shadow-xl)',
          animation: 'toast-in 0.2s ease',
          whiteSpace: 'nowrap',
        }}>
          {t.text}
        </div>
      ))}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
