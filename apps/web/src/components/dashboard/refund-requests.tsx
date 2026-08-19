'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { convertAndFormat, useLocale } from '@/lib/i18n';

interface Refund {
  id: string;
  reference: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED';
  amount: string;
  sellerShare: string;
  reason: string;
  decisionNote: string | null;
  full: boolean;
  items: { quantity: number; orderItem: { productName: string } }[];
  createdAt: string;
  order: {
    orderNumber: string;
    totalAmount: string;
    currency: string;
    status: string;
    customer: { firstName: string; lastName: string; email: string };
  };
}

const STATUS_COLOR: Record<Refund['status'], string> = {
  REQUESTED: 'bg-yellow-500/15 text-yellow-500',
  APPROVED: 'bg-emerald-500/15 text-emerald-500',
  REJECTED: 'bg-red-500/15 text-red-400',
};

const STATUS_LABEL: Record<Refund['status'], string> = {
  REQUESTED: 'À trancher',
  APPROVED: 'Accordé',
  REJECTED: 'Refusé',
};

/**
 * Demandes de remboursement reçues par le vendeur.
 *
 * Le bloc reste masqué quand il n'y a rien à traiter : une liste vide en
 * permanence sur la page Commandes n'apprendrait rien et ajouterait du bruit.
 */
export function RefundRequests() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const target = useLocale((s) => s.currency);

  const load = () =>
    apiFetch<Refund[]>('/refunds/shop')
      .then(setRefunds)
      .catch(() => setRefunds([]));

  useEffect(() => {
    load();
  }, []);

  if (refunds.length === 0) return null;

  const decide = async (r: Refund, approve: boolean) => {
    const note = window.prompt(
      approve
        ? `Message au client pour la commande ${r.order.orderNumber} (facultatif) :`
        : `Pourquoi refusez-vous le remboursement de ${r.order.orderNumber} ?`,
    );
    // Un refus sans explication est la meilleure façon de déclencher une
    // réclamation bancaire : on l'exige.
    if (!approve && !note?.trim()) return;

    setBusy(r.id);
    setError('');
    try {
      await apiFetch(`/refunds/${r.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ approve, note: note ?? '' }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(null);
    }
  };

  const pending = refunds.filter((r) => r.status === 'REQUESTED');

  return (
    <div className="card mb-6 p-5">
      <h2 className="mb-1 font-bold">
        🔁 Demandes de remboursement
        {pending.length > 0 && (
          <span className="ml-2 rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-500">
            {pending.length} en attente
          </span>
        )}
      </h2>
      <p className="mb-4 text-xs text-muted">
        Accorder un remboursement retire la somme rendue de votre solde — la part que vous
        auriez perçue, commission déduite. Si la commande vous a déjà été versée, elle sera
        retenue sur votre prochain versement. Un remboursement partiel ne touche que les
        articles rendus : le reste de la commande vous revient normalement.
      </p>

      {error && <p className="mb-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="space-y-2">
        {refunds.map((r) => (
          <div key={r.id} className="rounded-xl bg-surface-2 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  {r.order.orderNumber} ·{' '}
                  <span className="font-normal text-muted">
                    {r.order.customer.firstName} {r.order.customer.lastName}
                  </span>
                </p>
                <p className="mt-1 text-xs text-faint">
                  {new Date(r.createdAt).toLocaleDateString('fr-FR')} · vous reprendriez{' '}
                  {convertAndFormat(Number(r.sellerShare), r.order.currency, target)}
                </p>
                <p className="mt-1 text-sm">
                  {r.full ? (
                    <span className="mr-1 rounded bg-surface px-1.5 py-0.5 text-xs text-faint">
                      commande entière
                    </span>
                  ) : (
                    r.items.length > 0 && (
                      <span className="mr-1 rounded bg-surface px-1.5 py-0.5 text-xs text-faint">
                        {r.items
                          .map((i) => `${i.quantity} × ${i.orderItem.productName}`)
                          .join(', ')}
                      </span>
                    )
                  )}
                  « {r.reason} »
                </p>
                {r.decisionNote && <p className="mt-1 text-xs text-faint">Votre réponse : {r.decisionNote}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold">
                  {convertAndFormat(Number(r.amount), r.order.currency, target)}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
                {r.status === 'REQUESTED' && (
                  <>
                    <button
                      onClick={() => decide(r, true)}
                      disabled={busy === r.id}
                      className="btn-primary text-sm disabled:opacity-40"
                    >
                      {busy === r.id ? '…' : 'Accorder'}
                    </button>
                    <button
                      onClick={() => decide(r, false)}
                      disabled={busy === r.id}
                      className="text-sm text-muted hover:text-red-400"
                    >
                      Refuser
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
