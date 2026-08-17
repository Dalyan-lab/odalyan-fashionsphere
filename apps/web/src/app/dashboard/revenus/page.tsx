'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useT, convertAndFormat, useLocale } from '@/lib/i18n';
import { Topbar } from '@/components/dashboard/topbar';
import { PLATFORM_CURRENCY } from '@odalyan/shared';

interface Balance {
  available: number;
  availableOrders: number;
  onHold: number;
  onHoldOrders: number;
  pending: number;
  pendingOrders: number;
  totalPaidOut: number;
  holdDays: number;
  commissionRate: number;
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
  orders: { orderNumber: string; sellerAmount: string }[];
}

interface Account {
  payoutMethod: 'MOBILE_MONEY' | 'BANK_TRANSFER' | null;
  payoutOperator: string | null;
  payoutNumber: string | null;
  payoutHolderName: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-500/15 text-yellow-500',
  PAID: 'bg-emerald-500/15 text-emerald-500',
  FAILED: 'bg-red-500/15 text-red-400',
};

function Amount({ value, currency }: { value: number; currency: string }) {
  const target = useLocale((s) => s.currency);
  return <>{convertAndFormat(value, currency, target)}</>;
}

export default function RevenusPage() {
  const t = useT();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [noShop, setNoShop] = useState(false);

  const load = async () => {
    try {
      const [b, p, a] = await Promise.all([
        apiFetch<Balance>('/payouts/balance'),
        apiFetch<Payout[]>('/payouts'),
        apiFetch<Account>('/payouts/account'),
      ]);
      setBalance(b);
      setPayouts(p);
      setAccount(a);
    } catch {
      setNoShop(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    setSaving(true);
    setMsg('');
    try {
      await apiFetch('/payouts/account', {
        method: 'PATCH',
        body: JSON.stringify({
          payoutMethod: account.payoutMethod,
          payoutOperator: account.payoutOperator ?? '',
          payoutNumber: account.payoutNumber ?? '',
          payoutHolderName: account.payoutHolderName ?? '',
        }),
      });
      setMsg(t('earn.saved'));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  // La devise des versements suit celle des commandes ; à défaut, l'euro.
  const currency = payouts[0]?.currency ?? PLATFORM_CURRENCY;

  return (
    <>
      <Topbar />
      <div className="p-6">
        <h1 className="font-display text-3xl font-bold">{t('earn.title')}</h1>
        <p className="text-muted">{t('earn.subtitle')}</p>

        {noShop ? (
          <div className="card mt-6 p-10 text-center text-muted">{t('common.mustCreateShop')}</div>
        ) : !balance ? (
          <p className="mt-6 text-muted">{t('common.loading')}</p>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="card p-5">
                <p className="text-xs uppercase tracking-wide text-faint">{t('earn.available')}</p>
                <p className="mt-1 font-display text-2xl font-bold text-emerald-500">
                  <Amount value={balance.available} currency={currency} />
                </p>
                <p className="mt-1 text-xs text-muted">
                  {balance.availableOrders} {t('earn.orders')}
                </p>
              </div>
              <div className="card p-5">
                <p className="text-xs uppercase tracking-wide text-faint">{t('earn.onHold')}</p>
                <p className="mt-1 font-display text-2xl font-bold">
                  <Amount value={balance.onHold} currency={currency} />
                </p>
                <p className="mt-1 text-xs text-muted">
                  {t('earn.onHoldHelp').replace('{d}', String(balance.holdDays))}
                </p>
              </div>
              <div className="card p-5">
                <p className="text-xs uppercase tracking-wide text-faint">{t('earn.pending')}</p>
                <p className="mt-1 font-display text-2xl font-bold">
                  <Amount value={balance.pending} currency={currency} />
                </p>
                <p className="mt-1 text-xs text-muted">{t('earn.pendingHelp')}</p>
              </div>
              <div className="card p-5">
                <p className="text-xs uppercase tracking-wide text-faint">{t('earn.paidOut')}</p>
                <p className="mt-1 font-display text-2xl font-bold text-brand-violet">
                  <Amount value={balance.totalPaidOut} currency={currency} />
                </p>
                <p className="mt-1 text-xs text-muted">
                  {t('earn.commission').replace('{p}', String(Math.round(balance.commissionRate * 100)))}
                </p>
              </div>
            </div>

            {account && (
              <form onSubmit={saveAccount} className="card mt-6 p-5">
                <h2 className="font-bold">💳 {t('earn.accountTitle')}</h2>
                <p className="mb-4 text-xs text-muted">{t('earn.accountHelp')}</p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">{t('earn.method')}</label>
                    <select
                      className="input"
                      value={account.payoutMethod ?? ''}
                      onChange={(e) =>
                        setAccount({
                          ...account,
                          payoutMethod: (e.target.value || null) as Account['payoutMethod'],
                        })
                      }
                    >
                      <option value="">—</option>
                      <option value="MOBILE_MONEY">{t('earn.mobileMoney')}</option>
                      <option value="BANK_TRANSFER">{t('earn.bank')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">{t('earn.operator')}</label>
                    <input
                      className="input"
                      placeholder={t('earn.operatorPh')}
                      value={account.payoutOperator ?? ''}
                      onChange={(e) => setAccount({ ...account, payoutOperator: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">{t('earn.number')}</label>
                    <input
                      className="input"
                      placeholder={t('earn.numberPh')}
                      value={account.payoutNumber ?? ''}
                      onChange={(e) => setAccount({ ...account, payoutNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">{t('earn.holder')}</label>
                    <input
                      className="input"
                      value={account.payoutHolderName ?? ''}
                      onChange={(e) => setAccount({ ...account, payoutHolderName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button className="btn-primary text-sm disabled:opacity-40" disabled={saving}>
                    {saving ? '…' : t('common.save')}
                  </button>
                  {msg && <span className="text-sm text-muted">{msg}</span>}
                </div>
              </form>
            )}

            <h2 className="mt-8 font-bold">{t('earn.history')}</h2>
            {payouts.length === 0 ? (
              <div className="card mt-3 p-8 text-center text-muted">{t('earn.noPayout')}</div>
            ) : (
              <div className="mt-3 space-y-3">
                {payouts.map((p) => (
                  <div key={p.id} className="card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{p.reference}</p>
                        <p className="text-xs text-faint">
                          {new Date(p.createdAt).toLocaleDateString('fr-FR')} · {p.orders.length}{' '}
                          {t('earn.orders')}
                          {p.transferRef && ` · ${p.transferRef}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-display text-lg font-bold">
                          <Amount value={Number(p.amount)} currency={p.currency} />
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[p.status]}`}
                        >
                          {t(`pos.${p.status}`)}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-faint">
                      {p.orders.map((o) => o.orderNumber).join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
