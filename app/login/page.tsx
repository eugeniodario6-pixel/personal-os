'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const MONO = "'IBM Plex Mono', monospace";
const border2 = '2px solid #444';
const inputStyle = {
  width: '100%', fontFamily: MONO, fontSize: '0.875rem',
  background: '#000', color: '#fff', border: border2,
  padding: '0.5rem 0.75rem', outline: 'none', boxSizing: 'border-box' as const,
};
const lbl = { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#888', margin: 0 };

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
    <div style={{ fontFamily: MONO, minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem 1.5rem', background: '#000' }}>
      <div style={{ marginBottom: '2rem' }}>
        <p style={{ ...lbl, marginBottom: '0.5rem' }}>PERSONAL OS</p>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: '#fff' }}>
          {mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 400 }}>
        {error && (
          <p style={{ margin: 0, color: '#fff', background: '#111', border: '1px solid #888', padding: '0.75rem', fontSize: '0.75rem' }}>
            ⚠ {error}
          </p>
        )}
        {message && (
          <p style={{ margin: 0, color: '#fff', background: '#111', border: '1px solid #444', padding: '0.75rem', fontSize: '0.75rem' }}>
            ✓ {message}
          </p>
        )}

        <div>
          <p style={{ ...lbl, marginBottom: '0.25rem' }}>EMAIL</p>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="YOU@EXAMPLE.COM"
            style={inputStyle}
            autoComplete="email"
          />
        </div>

        <div>
          <p style={{ ...lbl, marginBottom: '0.25rem' }}>PASSWORD</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="••••••••"
            style={inputStyle}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: loading ? '#444' : '#fff', color: '#000', border: border2, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: MONO }}
        >
          {loading ? 'LOADING...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
        </button>

        <button
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage(''); }}
          style={{ padding: '0.5rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'none', color: '#888', border: 'none', cursor: 'pointer', fontFamily: MONO }}
        >
          {mode === 'login' ? 'NO ACCOUNT? SIGN UP →' : 'HAVE AN ACCOUNT? SIGN IN →'}
        </button>
      </div>
    </div>
  );
}
