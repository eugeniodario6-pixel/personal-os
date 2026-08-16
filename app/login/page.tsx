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
    if (!email.trim() || !password.trim()) { setError('EMAIL AND PASSWORD REQUIRED'); return; }
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) { setError(err.message.toUpperCase()); return; }
        setMessage('CHECK YOUR EMAIL TO CONFIRM YOUR ACCOUNT, THEN LOG IN.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) { setError(err.message.toUpperCase()); return; }
        router.push('/');
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: 'var(--font-mono)', minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem 1.5rem', background: 'var(--bg)' }}>
      <div style={{ marginBottom: '2rem' }}>
        <p className="label" style={{ marginBottom: '0.5rem' }}>PERSONAL OS</p>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: 'var(--text)' }}>
          {mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 400 }}>
        {error && (
          <p style={{ margin: 0, color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--text-muted)', padding: '0.75rem', fontSize: '0.75rem' }}>
            ⚠ {error}
          </p>
        )}
        {message && (
          <p style={{ margin: 0, color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '0.75rem', fontSize: '0.75rem' }}>
            ✓ {message}
          </p>
        )}

        <div>
          <p className="label" style={{ marginBottom: '0.25rem' }}>EMAIL</p>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="YOU@EXAMPLE.COM"
            autoComplete="email"
          />
        </div>

        <div>
          <p className="label" style={{ marginBottom: '0.25rem' }}>PASSWORD</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="••••••••"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`btn btn-primary btn-block${loading ? ' disabled' : ''}`}
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'LOADING...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
        </button>

        <button
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage(''); }}
          className="btn btn-ghost btn-block"
        >
          {mode === 'login' ? 'NO ACCOUNT? SIGN UP →' : 'HAVE AN ACCOUNT? SIGN IN →'}
        </button>
      </div>
    </div>
  );
}
