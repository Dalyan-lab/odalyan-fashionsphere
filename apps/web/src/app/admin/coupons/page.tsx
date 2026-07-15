'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import type { CouponDto } from '@odalyan/shared';

const date = (s?: string | null) => (s ? new Date(s).toLocaleDateString('fr-FR') : '—');

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<CouponDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    apiFetch<CouponDto[]>('/admin/coupons')
      .then(setCoupons)
      .catch(() => setCoupons([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggle = async (c: CouponDto) => {
    await apiFetch(`/admin/coupons/${c.id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !c.active }),
    }).catch(() => undefined);
    load();
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">🎟️ Codes promo</h1>
          <p className="text-sm text-muted">Créez des réductions pour accélérer l’adhésion des vendeurs.</p>
        </div>
        <Link href="/admin" className="btn-ghost">← Administration</Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Liste */}
        <div>
          <h2 className="mb-3 text-lg font-bold">Coupons ({coupons.length})</h2>
          {loading ? (
            <p className="text-muted">Chargement…</p>
          ) : coupons.length === 0 ? (
            <p className="text-muted">Aucun coupon. Créez-en un à droite (ex. FONDATEUR).</p>
          ) : (
            <div className="space-y-2">
              {coupons.map((c) => (
                <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-mono font-bold text-brand-violet">{c.code}</p>
                    <p className="text-xs text-faint">
                      {c.percentOff ? `-${c.percentOff}%` : `-${c.amountOffEur} €`} · {c.appliesTo} ·{' '}
                      {c.timesRedeemed}
                      {c.maxRedemptions ? `/${c.maxRedemptions}` : ''} utilisés · exp. {date(c.expiresAt)}
                    </p>
                    {c.description && <p className="mt-0.5 text-xs text-muted">{c.description}</p>}
                  </div>
                  <button
                    onClick={() => toggle(c)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      c.active ? 'bg-emerald-500/15 text-emerald-500' : 'bg-surface-2 text-faint'
                    }`}
                  >
                    {c.active ? 'Actif' : 'Inactif'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Création */}
        <CouponForm onCreated={load} />
      </div>
    </main>
  );
}

function CouponForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    code: '',
    description: '',
    discountType: 'percent' as 'percent' | 'amount',
    percentOff: '40',
    amountOffEur: '',
    appliesTo: 'credits',
    maxRedemptions: '',
    expiresAt: '',
  });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    setOk('');
    setBusy(true);
    try {
      await apiFetch('/admin/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code.trim(),
          description: form.description || undefined,
          percentOff: form.discountType === 'percent' ? Number(form.percentOff) : undefined,
          amountOffEur: form.discountType === 'amount' ? Number(form.amountOffEur) : undefined,
          appliesTo: form.appliesTo,
          maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : undefined,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
        }),
      });
      setOk(`Coupon ${form.code.toUpperCase()} créé.`);
      setForm({ ...form, code: '', description: '' });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card h-fit space-y-3 p-5">
      <h2 className="font-bold">Nouveau coupon</h2>

      <div>
        <label className="label">Code</label>
        <input
          className="input font-mono"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          placeholder="FONDATEUR"
        />
      </div>

      <div>
        <label className="label">Type de remise</label>
        <div className="flex gap-2">
          {(['percent', 'amount'] as const).map((tp) => (
            <button
              key={tp}
              onClick={() => setForm({ ...form, discountType: tp })}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                form.discountType === tp ? 'border-brand-violet bg-surface-2' : 'border-border text-muted'
              }`}
            >
              {tp === 'percent' ? 'Pourcentage' : 'Montant fixe'}
            </button>
          ))}
        </div>
      </div>

      {form.discountType === 'percent' ? (
        <div>
          <label className="label">Réduction (%)</label>
          <input
            className="input"
            type="number"
            min={1}
            max={100}
            value={form.percentOff}
            onChange={(e) => setForm({ ...form, percentOff: e.target.value })}
          />
        </div>
      ) : (
        <div>
          <label className="label">Réduction (€)</label>
          <input
            className="input"
            type="number"
            min={1}
            value={form.amountOffEur}
            onChange={(e) => setForm({ ...form, amountOffEur: e.target.value })}
          />
        </div>
      )}

      <div>
        <label className="label">S’applique à</label>
        <select
          className="input"
          value={form.appliesTo}
          onChange={(e) => setForm({ ...form, appliesTo: e.target.value })}
        >
          <option value="credits">Crédits IA</option>
          <option value="order">Commandes</option>
          <option value="all">Tout</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Limite d’usages</label>
          <input
            className="input"
            type="number"
            min={1}
            value={form.maxRedemptions}
            onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
            placeholder="100"
          />
        </div>
        <div>
          <label className="label">Expire le</label>
          <input
            className="input"
            type="date"
            value={form.expiresAt}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="label">Description (interne)</label>
        <input
          className="input"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Offre Fondateur — lancement"
        />
      </div>

      {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}
      {ok && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">{ok}</p>}

      <button onClick={submit} disabled={busy || !form.code.trim()} className="btn-primary w-full">
        {busy ? 'Création…' : 'Créer le coupon'}
      </button>
    </div>
  );
}
