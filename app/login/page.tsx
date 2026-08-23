'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode]         = useState<'login' | 'signup'>('login');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [message, setMessage]   = useState('');

  const submit = async () => {
    setError(''); setMessage('');
    if (!email.trim() || !password.trim()) { setError('Email and password required'); return; }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) { setError(err.message); return; }
        setMessage('Check your email to confirm, then sign in.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) { setError(err.message); return; }
        router.push('/'); router.refresh();
      }
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem var(--page-pad)', background: 'var(--bg)' }}>

      <div style={{ marginBottom: '2.5rem' }}>
        <p className="label" style={{ color: 'var(--text-ghost)', marginBottom: '0.5rem' }}>PERSONAL OS</p>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em' }}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 360 }}>
        {error   && <p className="label" style={{ color: 'var(--negative)', padding: '0.75rem', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>{error}</p>}
        {message && <p className="label" style={{ color: 'var(--positive)', padding: '0.75rem', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>{message}</p>}

        <div>
          <p className="label" style={{ marginBottom: '0.4rem' }}>Email</p>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="you@example.com" autoComplete="email" />
        </div>

        <div>
          <p className="label" style={{ marginBottom: '0.4rem' }}>Password</p>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </div>

        <button className="btn btn-primary btn-block" onClick={submit} disabled={loading}>
          {loading ? 'Loading…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <button className="btn btn-ghost btn-block" onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(''); setMessage(''); }}>
          {mode === 'login' ? 'No account? Sign up' : 'Have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
