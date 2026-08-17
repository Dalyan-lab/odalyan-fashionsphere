'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface PendingPayout {
  shopId: string;
  shopName: string;
  amount: number;
  orders: number;
  payoutReady: boolean;
  method: 'MOBILE_MONEY' | 'BANK_TRANSFER' | null;
  operator: string | null;
  number: string | null;
  holderName: string | null;
}

interface Payout {
  id: string;
  reference: string;
  amount: string;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  destination: string | null;
  transferRef: string | null;
  createdAt: string;
  paidAt: string | null;
  shop: { name: string };
  _count: { orders: number };
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-500/15 text-yellow-500',
  PAID: 'bg-emerald-500/15 text-emerald-500',
  FAILED: 'bg-red-500/15 text-red-400',
};

/**
 * Pilotage des reversements aux vendeurs.
 *
 * Le mouvement d'argent reste extérieur — Wave, Orange Money, virement. Ce
 * panneau dit à qui, combien et pourquoi, puis garde la trace du versement une
 * fois effectué.
 */
export function PayoutsPanel() {
  const [pending, setPending] = useState<PendingPayout[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    const [p, list] = await Promise.all([
      apiFetch<PendingPayout[]>('/admin/payouts/pending').catch(() => []),
      apiFetch<Payout[]>('/admin/payouts').catch(() => []),
    ]);
    setPending(p);
    setPayouts(list);
  };

  useEffect(() => {
    load();
  }, []);

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

  const create = (shopId: string) =>
    run(shopId, () => apiFetch(`/admin/payouts/${shopId}`, { method: 'POST' }));

  const markPaid = (id: string) => {
    const transferRef = window.prompt('Référence du virement (facultatif) :') ?? '';
    return run(id, () =>
      apiFetch(`/admin/payouts/${id}/paid`, {
        method: 'PATCH',
        body: JSON.stringify({ transferRef }),
      }),
    );
  };

  const cancel = (id: string) => {
    if (!window.confirm('Annuler ce versement ? Les commandes retourneront au solde disponible.')) return;
    return run(id, () => apiFetch(`/admin/payouts/${id}`, { method: 'DELETE' }));
  };

  return (
    <div className="card p-5">
      <h2 className="mb-1 font-bold">💸 Reversements aux vendeurs</h2>
      <p className="mb-4 text-xs text-muted">
        Montants dus après livraison et délai de garantie. Le virement se fait hors plateforme, puis
        se confirme ici.
      </p>

      {error && <p className="mb-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}

      {pending.length === 0 ? (
        <p className="text-sm text-muted">Aucun montant versable actuellement.</p>
      ) : (
        <div className="space-y-2">
          {pending.map((p) => (
            <div
              key={p.shopId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3"
            >
              <div>
                <p className="font-semibold">{p.shopName}</p>
                <p className="text-xs text-faint">
                  {p.orders} commande{p.orders > 1 ? 's' : ''}
                  {p.payoutReady
                    ? ` · ${[p.operator, p.number, p.holderName].filter(Boolean).join(' · ')}`
                    : ' · ⚠️ coordonnées manquantes'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display text-lg font-bold text-brand-violet">
                  {p.amount.toFixed(2)}
                </span>
                <button
                  onClick={() => create(p.shopId)}
                  disabled={!p.payoutReady || busy === p.shopId}
                  className="btn-primary text-sm disabled:opacity-40"
                  title={p.payoutReady ? undefined : 'Le vendeur doit renseigner ses coordonnées'}
                >
                  {busy === p.shopId ? '…' : 'Préparer'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {payouts.length > 0 && (
        <>
          <h3 className="mb-2 mt-6 text-sm font-semibold">Historique</h3>
          <div className="space-y-2">
            {payouts.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {p.shop.name} · <span className="font-mono text-xs">{p.reference}</span>
                  </p>
                  <p className="text-xs text-faint">
                    {new Date(p.createdAt).toLocaleDateString('fr-FR')} · {p._count.orders} commandes
                    {p.destination && ` · ${p.destination}`}
                    {p.transferRef && ` · réf. ${p.transferRef}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">
                    {Number(p.amount).toFixed(2)} {p.currency}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[p.status]}`}>
                    {p.status === 'PAID' ? 'Versé' : p.status === 'PENDING' ? 'À verser' : 'Échec'}
                  </span>
                  {p.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => markPaid(p.id)}
                        disabled={busy === p.id}
                        className="btn-primary text-sm disabled:opacity-40"
                      >
                        {busy === p.id ? '…' : 'Marquer versé'}
                      </button>
                      <button
                        onClick={() => cancel(p.id)}
                        disabled={busy === p.id}
                        className="text-sm text-muted hover:text-red-400"
                      >
                        Annuler
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
