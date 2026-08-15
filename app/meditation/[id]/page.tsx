'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db, type MeditationSession } from '@/lib/db';
import MeditationTimer from '@/components/MeditationTimer';

export default function MeditationSessionPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [session, setSession] = useState<MeditationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id || isNaN(id)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    db.meditation_session.get(id).then((s) => {
      if (!s) {
        setNotFound(true);
      } else {
        setSession(s);
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          fontFamily: "'IBM Plex Mono', monospace",
          color: '#444',
          fontSize: '0.75rem',
        }}
      >
        LOADING...
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div style={{ padding: '2rem 1rem', fontFamily: "'IBM Plex Mono', monospace" }}>
        <p className="label" style={{ marginBottom: '1rem' }}>SESSION NOT FOUND</p>
        <button className="btn" onClick={() => router.push('/meditation')}>
          ← BACK TO LIBRARY
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Back nav */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '2px solid #444',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <button
          className="btn btn-ghost"
          onClick={() => router.push('/meditation')}
          style={{ fontSize: '0.6rem', padding: '0.4rem 0.75rem' }}
        >
          ← BACK
        </button>
        <span className="label">{session.category.toUpperCase()}</span>
      </div>

      {/* Timer */}
      <MeditationTimer session={session} />
    </div>
  );
}
