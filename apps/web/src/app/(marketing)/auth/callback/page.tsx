'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthResponse } from '@odalyan/shared';
import { apiFetch, setToken } from '@/lib/api';
import { useAuth } from '@/lib/store';

export default function AuthCallbackPage() {
  const router = useRouter();
  const setAuth = useAuth((s) => s.setAuth);
  const [error, setError] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const at = hash.get('at');
    const rt = hash.get('rt');
    if (!at || !rt) {
      setError(true);
      return;
    }
    // Stocke le token puis récupère le profil
    setToken(at);
    apiFetch<AuthResponse['user']>('/auth/me')
      .then((user) => {
        setAuth({ user, tokens: { accessToken: at, refreshToken: rt } });
        // Nettoie le fragment puis redirige
        window.history.replaceState(null, '', window.location.pathname);
        router.replace('/dashboard');
      })
      .catch(() => setError(true));
  }, [router, setAuth]);

  return (
    <main className="grid min-h-[60vh] place-items-center px-6 text-center">
      {error ? (
        <div>
          <p className="text-muted">La connexion a échoué.</p>
          <a href="/login" className="btn-primary mt-4 inline-block">Retour à la connexion</a>
        </div>
      ) : (
        <div>
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-border border-t-brand-magenta" />
          <p className="mt-4 text-muted">Connexion en cours…</p>
        </div>
      )}
    </main>
  );
}
