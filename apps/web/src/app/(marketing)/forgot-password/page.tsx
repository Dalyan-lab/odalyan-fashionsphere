'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ForgotPasswordResponse } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<ForgotPasswordResponse | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<ForgotPasswordResponse>('/auth/forgot-password', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email }),
      });
      setDone(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-md flex-col px-6 py-20">
      <h1 className="font-display text-4xl font-bold">Mot de passe oublié</h1>
      <p className="mt-2 text-muted">Entrez votre email pour recevoir un lien de réinitialisation.</p>

      {done ? (
        <div className="card mt-8 space-y-4 p-6">
          <p className="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">{done.message}</p>
          {done.resetUrl && (
            <div>
              <p className="mb-2 text-xs text-faint">
                Mode développement (aucun email configuré) — utilisez ce lien :
              </p>
              <Link href={done.resetUrl.replace(/^https?:\/\/[^/]+/, '')} className="btn-primary w-full">
                Réinitialiser mon mot de passe
              </Link>
            </div>
          )}
          <Link href="/login" className="block text-center text-sm text-brand-violet hover:underline">
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="card mt-8 space-y-4 p-6">
          {error && <p className="rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-400">{error}</p>}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? '…' : 'Envoyer le lien'}
          </button>
          <Link href="/login" className="block text-center text-sm text-muted hover:text-content">
            Retour à la connexion
          </Link>
        </form>
      )}
    </main>
  );
}
