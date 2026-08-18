'use client';

import { useEffect, useState } from 'react';
import { AMAZON_MARKETPLACES } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/store';

interface Watch {
  id: string;
  label: string;
  marketplace: string;
  category: string;
  topN: number;
  active: boolean;
  lastRunAt: string | null;
  lastCount: number | null;
  lastError: string | null;
}

/**
 * Rayons Amazon surveillés automatiquement, réservé à l'administrateur.
 *
 * Remplace la saisie d'ASIN un par un : on déclare un rayon, et la plateforme
 * y reprend chaque nuit le haut du classement des meilleures ventes.
 */
export function TrendWatches() {
  const { user } = useAuth();
  const [watches, setWatches] = useState<Watch[] | null>(null);
  // Sans clé Keepa, un rayon se lance et rapporte zéro produit sans rien dire.
  // Le silence est le pire des retours : on affiche la cause.
  const [keepaReady, setKeepaReady] = useState<boolean | null>(null);
  const [form, setForm] = useState({
    label: '',
    marketplace: AMAZON_MARKETPLACES[0]?.domain ?? '',
    category: '',
    topN: 10,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = () =>
    apiFetch<Watch[]>('/viral-amazone/watches')
      .then(setWatches)
      .catch(() => setWatches([]));

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    load();
    apiFetch<{ keepa: boolean }>('/viral-amazone/status')
      .then((s) => setKeepaReady(s.keepa))
      .catch(() => setKeepaReady(null));
  }, [user?.role]);

  // Réservé à l'administrateur : un vendeur n'a pas à voir ce bloc, et l'API
  // lui refuserait de toute façon la requête.
  if (user?.role !== 'ADMIN' || watches === null) return null;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(null);
    }
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    return run('add', async () => {
      await apiFetch('/viral-amazone/watches', { method: 'POST', body: JSON.stringify(form) });
      setForm({ ...form, label: '', category: '' });
    });
  };

  return (
    <div className="card p-5">
      <h2 className="mb-1 font-bold">🎯 Rayons surveillés</h2>
      <p className="mb-4 text-xs text-muted">
        La plateforme reprend chaque nuit le haut du classement des meilleures ventes de chaque rayon.
        Indiquez un identifiant de catégorie Amazon, ou un nom de groupe comme{' '}
        <code className="text-content">beauty</code>, <code className="text-content">electronics</code>{' '}
        ou <code className="text-content">fashion</code> — ces noms fonctionnent sur tous les pays.
      </p>

      {keepaReady === false && (
        <p className="mb-3 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-500">
          ⚠️ Clé Keepa absente : les rayons se lanceront mais ne rapporteront aucun produit.
          Renseignez <code>KEEPA_API_KEY</code> dans les variables du service API.
        </p>
      )}

      {error && <p className="mb-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}

      <form onSubmit={add} className="mb-4 grid gap-2 sm:grid-cols-5">
        <input
          className="input py-1.5 text-sm sm:col-span-2"
          placeholder="Nom du rayon (ex. Beauté France)"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          required
        />
        <select
          className="input py-1.5 text-sm"
          value={form.marketplace}
          onChange={(e) => setForm({ ...form, marketplace: e.target.value })}
        >
          {AMAZON_MARKETPLACES.map((m) => (
            <option key={m.domain} value={m.domain}>
              {m.code}
            </option>
          ))}
        </select>
        <input
          className="input py-1.5 text-sm"
          placeholder="Catégorie"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          required
        />
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            max={50}
            className="input py-1.5 text-sm"
            value={form.topN}
            onChange={(e) => setForm({ ...form, topN: Number(e.target.value) })}
            title="Nombre de produits repris en tête de classement"
          />
          <button className="btn-primary text-sm disabled:opacity-40" disabled={busy === 'add'}>
            {busy === 'add' ? '…' : '+'}
          </button>
        </div>
      </form>

      {watches.length === 0 ? (
        <p className="text-sm text-muted">Aucun rayon surveillé pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {watches.map((w) => (
            <div
              key={w.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold">
                  {w.label}{' '}
                  {!w.active && <span className="text-xs font-normal text-faint">· en pause</span>}
                </p>
                <p className="text-xs text-faint">
                  {w.marketplace} · <code>{w.category}</code> · top {w.topN}
                  {w.lastRunAt && ` · ${new Date(w.lastRunAt).toLocaleDateString('fr-FR')}`}
                  {w.lastCount != null && ` · ${w.lastCount} produits`}
                </p>
                {w.lastError && <p className="mt-1 text-xs text-red-400">⚠️ {w.lastError}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    run(w.id, () => apiFetch(`/viral-amazone/watches/${w.id}/run`, { method: 'POST' }))
                  }
                  disabled={busy === w.id}
                  className="btn-ghost text-sm disabled:opacity-40"
                >
                  {busy === w.id ? '…' : 'Lancer'}
                </button>
                <button
                  onClick={() =>
                    run(w.id, () =>
                      apiFetch(`/viral-amazone/watches/${w.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ active: !w.active }),
                      }),
                    )
                  }
                  className="text-sm text-muted hover:text-content"
                >
                  {w.active ? 'Pause' : 'Activer'}
                </button>
                <button
                  onClick={() => {
                    if (!window.confirm(`Retirer le rayon « ${w.label} » ?`)) return;
                    return run(w.id, () =>
                      apiFetch(`/viral-amazone/watches/${w.id}`, { method: 'DELETE' }),
                    );
                  }}
                  className="text-sm text-muted hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
