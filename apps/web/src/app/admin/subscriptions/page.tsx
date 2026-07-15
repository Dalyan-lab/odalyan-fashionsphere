'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface PaymentRow {
  id: string;
  shop: string;
  plan: string;
  period: string;
  amount: number;
  currency: string;
  status: string;
  couponCode?: string | null;
  createdAt: string;
}
interface Data {
  summary: {
    totalEur: number;
    paidCount: number;
    pendingCount: number;
    activeSubscriptions: number;
    byPlan: Record<string, { count: number; eur: number }>;
  };
  payments: PaymentRow[];
}

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
const date = (s: string) => new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const STATUS_STYLE: Record<string, string> = {
  PAID: 'bg-emerald-500/15 text-emerald-500',
  PENDING: 'bg-amber-500/15 text-amber-500',
  FAILED: 'bg-brand-magenta/15 text-brand-magenta',
};

export default function AdminSubscriptionsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Data>('/subscriptions/admin/payments')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">💳 Revenus d’abonnement</h1>
          <p className="text-sm text-muted">Paiements de plans et abonnements actifs.</p>
        </div>
        <Link href="/admin" className="btn-ghost">← Administration</Link>
      </div>

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : !data ? (
        <p className="text-muted">Aucune donnée.</p>
      ) : (
        <>
          {/* Synthèse */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Revenu encaissé" value={eur(data.summary.totalEur)} accent />
            <StatCard label="Paiements réglés" value={String(data.summary.paidCount)} />
            <StatCard label="Abonnements actifs" value={String(data.summary.activeSubscriptions)} />
            <StatCard label="En attente" value={String(data.summary.pendingCount)} />
          </div>

          {/* Par plan */}
          {Object.keys(data.summary.byPlan).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(data.summary.byPlan).map(([plan, v]) => (
                <span key={plan} className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs">
                  <strong className="text-brand-violet">{plan}</strong> · {v.count} × · {eur(v.eur)}
                </span>
              ))}
            </div>
          )}

          {/* Table */}
          <h2 className="mb-3 mt-8 text-lg font-bold">Derniers paiements ({data.payments.length})</h2>
          {data.payments.length === 0 ? (
            <p className="text-muted">Aucun paiement d’abonnement pour l’instant.</p>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-faint">
                    <th className="p-3">Boutique</th>
                    <th className="p-3">Plan</th>
                    <th className="p-3">Période</th>
                    <th className="p-3">Montant</th>
                    <th className="p-3">Code</th>
                    <th className="p-3">Statut</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="p-3 font-medium">{p.shop}</td>
                      <td className="p-3">{p.plan}</td>
                      <td className="p-3 text-muted">{p.period === 'annual' ? 'Annuel' : 'Mensuel'}</td>
                      <td className="p-3 tabular-nums">{eur(p.amount)}</td>
                      <td className="p-3 font-mono text-xs text-brand-violet">{p.couponCode ?? '—'}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[p.status] ?? ''}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-faint">{date(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-faint">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${accent ? 'text-brand-violet' : ''}`}>{value}</p>
    </div>
  );
}
