'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
      setTimeout(() => router.push('/login'), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="card mt-8 p-6 text-center text-muted">
        Lien invalide.{' '}
        <Link href="/forgot-password" className="text-brand-violet hover:underline">Refaire une demande</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card mt-8 p-6 text-center">
        <div className="text-5xl">✅</div>
        <p className="mt-3 text-emerald-500">Mot de passe réinitialisé !</p>
        <p className="mt-1 text-sm text-muted">Redirection vers la connexion…</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card mt-8 space-y-4 p-6">
      {error && <p className="rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-400">{error}</p>}
      <div>
        <label className="label">Nouveau mot de passe</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
      </div>
      <div>
        <label className="label">Confirmer</label>
        <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
      </div>
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? '…' : 'Réinitialiser'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col px-6 py-20">
      <h1 className="font-display text-4xl font-bold">Nouveau mot de passe</h1>
      <p className="mt-2 text-muted">Choisissez un nouveau mot de passe pour votre compte.</p>
      <Suspense fallback={<p className="mt-8 text-muted">Chargement…</p>}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
