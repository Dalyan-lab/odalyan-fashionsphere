'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AuthResponse } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { SocialAuthButtons } from '@/components/social-auth-buttons';
import { PasswordInput } from '@/components/password-input';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuth((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email, password }),
      });
      setAuth(res);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-md flex-col px-6 py-20">
      <h1 className="font-display text-4xl font-bold">Connexion</h1>
      <p className="mt-2 text-muted">Heureux de vous revoir sur Odalyan FashionSphere.</p>

      <form onSubmit={submit} className="card mt-8 space-y-4 p-6">
        {error && <p className="rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-200">{error}</p>}
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label">Mot de passe</label>
            <Link href="/forgot-password" className="mb-1 text-xs text-brand-violet hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" required />
        </div>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? '…' : 'Se connecter'}
        </button>
        <SocialAuthButtons />
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Pas encore de compte ?{' '}
        <Link href="/register" className="text-brand-coral hover:underline">
          Créer ma boutique
        </Link>
      </p>
      <p className="mt-4 text-center text-xs text-faint">
        Démo : vendeur@odalyan.ai / password123
      </p>
    </main>
  );
}
