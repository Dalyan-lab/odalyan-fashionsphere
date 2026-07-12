'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserRole, type AuthResponse } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { SocialAuthButtons } from '@/components/social-auth-buttons';
import { PasswordInput } from '@/components/password-input';

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuth((s) => s.setAuth);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: UserRole.SELLER as UserRole,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        auth: false,
        body: JSON.stringify(form),
      });
      setAuth(res);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-md flex-col px-6 py-16">
      <h1 className="font-display text-4xl font-bold">Créer mon compte</h1>
      <p className="mt-2 text-muted">Lancez votre boutique de mode propulsée par l’IA.</p>

      <form onSubmit={submit} className="card mt-8 space-y-4 p-6">
        {error && <p className="rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-200">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Prénom</label>
            <input className="input" value={form.firstName} onChange={(e) => update('firstName', e.target.value)} required />
          </div>
          <div>
            <label className="label">Nom</label>
            <input className="input" value={form.lastName} onChange={(e) => update('lastName', e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
        </div>
        <div>
          <label className="label">Mot de passe</label>
          <PasswordInput value={form.password} onChange={(v) => update('password', v)} autoComplete="new-password" required minLength={8} />
        </div>
        <div>
          <label className="label">Je suis…</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => update('role', UserRole.SELLER)}
              className={`rounded-xl border px-4 py-3 text-sm ${form.role === UserRole.SELLER ? 'border-roseGold bg-surface-2' : 'border-border'}`}
            >
              🏪 Vendeur
            </button>
            <button
              type="button"
              onClick={() => update('role', UserRole.CUSTOMER)}
              className={`rounded-xl border px-4 py-3 text-sm ${form.role === UserRole.CUSTOMER ? 'border-roseGold bg-surface-2' : 'border-border'}`}
            >
              🛍️ Client
            </button>
          </div>
        </div>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? '…' : 'Créer mon compte'}
        </button>
        <SocialAuthButtons />
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Déjà inscrit ?{' '}
        <Link href="/login" className="text-brand-coral hover:underline">
          Se connecter
        </Link>
      </p>
    </main>
  );
}
