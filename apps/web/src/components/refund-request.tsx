'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { convertAndFormat, useLocale } from '@/lib/i18n';

interface RefundableItem {
  id: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  /** Unités encore remboursables, une fois déduites les demandes déjà déposées. */
  refundable: number;
}

interface Refundable {
  currency: string;
  shippingAmount: number;
  items: RefundableItem[];
}

/**
 * Demande de remboursement, article par article.
 *
 * Le client désigne ce qu'il rend ; le montant s'en déduit. Lui faire saisir
 * une somme l'obligerait à calculer lui-même, et laisserait passer des
 * demandes sans rapport avec ce qu'il a payé.
 */
export function RefundRequest({
  orderId,
  orderNumber,
  onDone,
}: {
  orderId: string;
  orderNumber: string;
  onDone: () => void;
}) {
  const currency = useLocale((s) => s.currency);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Refundable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || data) return;
    apiFetch<Refundable>(`/refunds/refundable/${orderId}`)
      .then((r) => {
        setData(r);
        // Tout coché par défaut : le cas courant reste « je rends tout », et
        // décocher est plus rapide que de tout sélectionner.
        setQty(Object.fromEntries(r.items.map((i) => [i.id, i.refundable])));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'));
  }, [open, data, orderId]);

  const lines = data?.items.filter((i) => (qty[i.id] ?? 0) > 0) ?? [];
  const itemsTotal = lines.reduce((sum, i) => sum + i.unitPrice * (qty[i.id] ?? 0), 0);
  // La livraison ne revient qu'à celui qui rend tout : c'est la règle appliquée
  // par le serveur, autant que le client la voie avant d'envoyer.
  const full = Boolean(data) && data!.items.every((i) => (qty[i.id] ?? 0) >= i.refundable);
  const total = itemsTotal + (full ? (data?.shippingAmount ?? 0) : 0);

  const submit = async () => {
    if (!reason.trim() || lines.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/refunds', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          reason,
          items: lines.map((i) => ({ orderItemId: i.id, quantity: qty[i.id] })),
        }),
      });
      setOpen(false);
      setData(null);
      setReason('');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 text-sm text-muted underline-offset-2 hover:text-content hover:underline"
      >
        Demander un remboursement
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-2 p-4">
      <p className="font-semibold">Que souhaitez-vous vous faire rembourser ?</p>
      <p className="mt-0.5 text-xs text-faint">Commande {orderNumber}</p>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {!data ? (
        <p className="mt-3 text-sm text-muted">Chargement…</p>
      ) : (
        <>
          <ul className="mt-4 space-y-2">
            {data.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
                <span className={i.refundable === 0 ? 'text-faint line-through' : 'text-muted'}>
                  {i.productName}
                  {i.refundable === 0 && ' — déjà remboursé'}
                </span>
                {i.refundable > 0 && (
                  <span className="flex shrink-0 items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={i.refundable}
                      step={1}
                      value={qty[i.id] ?? 0}
                      onChange={(e) =>
                        setQty((q) => ({
                          ...q,
                          [i.id]: Math.max(0, Math.min(i.refundable, Number(e.target.value) || 0)),
                        }))
                      }
                      className="w-16 rounded-lg border border-border bg-surface px-2 py-1 text-right"
                      aria-label={`Quantité à rembourser pour ${i.productName}`}
                    />
                    <span className="w-8 text-xs text-faint">/ {i.refundable}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>

          <p className="mt-3 flex justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted">
              Montant demandé
              {full && data.shippingAmount > 0 && (
                <span className="block text-xs text-faint">livraison comprise</span>
              )}
            </span>
            <strong className="text-brand-violet">
              {convertAndFormat(total, data.currency, currency)}
            </strong>
          </p>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Pourquoi ? (article abîmé, taille incorrecte, colis jamais reçu…)"
            className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />

          <div className="mt-3 flex gap-2">
            <button
              onClick={submit}
              disabled={busy || !reason.trim() || lines.length === 0}
              className="btn-primary text-sm disabled:opacity-40"
            >
              {busy ? '…' : 'Envoyer la demande'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-sm text-muted hover:text-content"
            >
              Annuler
            </button>
          </div>
          <p className="mt-2 text-xs text-faint">
            Le vendeur reçoit votre demande et vous répond. Rien n’est débité de son côté tant
            qu’il n’a pas accepté.
          </p>
        </>
      )}
    </div>
  );
}
