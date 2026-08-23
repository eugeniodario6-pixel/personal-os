'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    setError(''); setMessage('');
    if (!email.trim() || !password.trim()) { setError('Email and password required'); return; }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) { setError(err.message); return; }
        setMessage('Check your email to confirm your account, then sign in.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) { setError(err.message); return; }
        router.push('/');
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '40px 24px',
      background: '#000000',
    }}>

      {/* ── Brand ── */}
      <div style={{ marginBottom: 48 }}>
        <p style={{ fontSize: 11, fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 16 }}>
          Personal OS
        </p>
        <h1 style={{ margin: 0, fontSize: 'clamp(2.5rem,12vw,4rem)', fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 0.95, color: '#ffffff' }}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 360 }}>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(235,87,87,0.08)',
            border: '1px solid rgba(235,87,87,0.2)',
            borderRadius: 12, padding: '10px 14px',
            fontSize: 13, color: 'var(--color-coral-red)',
            letterSpacing: '-0.011em',
          }}>
            {error}
          </div>
        )}

        {/* Success */}
        {message && (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            borderRadius: 12, padding: '10px 14px',
            fontSize: 13, color: 'var(--text)',
            letterSpacing: '-0.011em',
          }}>
            {message}
          </div>
        )}

        <div>
          <p className="label" style={{ marginBottom: 6 }}>Email</p>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="you@example.com"
            autoComplete="email"
            style={{ background: 'var(--surface-2)', boxShadow: 'var(--ring)', borderRadius: 14 }}
          />
        </div>

        <div>
          <p className="label" style={{ marginBottom: 6 }}>Password</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="••••••••"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            style={{ background: 'var(--surface-2)', boxShadow: 'var(--ring)', borderRadius: 14 }}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn btn-primary btn-block"
          style={{ marginTop: 8 }}
        >
          {loading ? '…' : mode === 'login' ? 'Sign in →' : 'Create account →'}
        </button>

        <button
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage(''); }}
          className="btn btn-ghost btn-block"
        >
          {mode === 'login' ? 'No account? Sign up' : 'Have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
