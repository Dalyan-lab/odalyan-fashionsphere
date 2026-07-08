'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/store';

interface Overview {
  usersCount: number;
  roles: Record<string, number>;
  shopsCount: number;
  productsCount: number;
  ordersCount: number;
  paidOrdersCount: number;
  revenue: number;
  monthlyRevenue: { label: string; revenue: number }[];
}
interface ShopRow {
  id: string; name: string; slug: string; owner: string; ownerEmail: string;
  plan: string; productsCount: number; ordersCount: number; revenue: number; createdAt: string;
}
interface UserRow {
  id: string; email: string; name: string; role: string;
  shopName: string | null; ordersCount: number; createdAt: string;
}
interface OrderRow {
  id: string; orderNumber: string; status: string; total: number; currency: string;
  shop: string; customer: string; customerEmail: string; createdAt: string;
}

const ROLES = ['ADMIN', 'SELLER', 'CUSTOMER', 'MARKETING_AGENCY'];
const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
const date = (s: string) => new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });

type Tab = 'shops' | 'users' | 'orders';

export default function AdminPage() {
  const me = useAuth((s) => s.user);
  const [ov, setOv] = useState<Overview | null>(null);
  const [tab, setTab] = useState<Tab>('shops');
  const [shops, setShops] = useState<ShopRow[] | null>(null);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);

  useEffect(() => {
    apiFetch<Overview>('/admin/overview').then(setOv).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (tab === 'shops' && !shops) apiFetch<ShopRow[]>('/admin/shops').then(setShops).catch(() => setShops([]));
    if (tab === 'users' && !users) apiFetch<UserRow[]>('/admin/users').then(setUsers).catch(() => setUsers([]));
    if (tab === 'orders' && !orders) apiFetch<OrderRow[]>('/admin/orders').then(setOrders).catch(() => setOrders([]));
  }, [tab, shops, users, orders]);

  const changeRole = async (id: string, role: string) => {
    setUsers((prev) => prev?.map((u) => (u.id === id ? { ...u, role } : u)) ?? prev);
    try {
      await apiFetch(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
    } catch {
      // recharge en cas d'échec
      apiFetch<UserRow[]>('/admin/users').then(setUsers).catch(() => undefined);
    }
  };

  const maxRev = Math.max(...(ov?.monthlyRevenue.map((m) => m.revenue) ?? [1]), 1);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-violet-magenta text-xl text-white">🛡️</span>
          <div>
            <h1 className="font-display text-3xl font-bold">Administration</h1>
            <p className="text-sm text-muted">Vue globale de la plateforme Odalyan FashionSphere.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Connecté : {me?.email}</span>
          <Link href="/dashboard" className="btn-ghost">Mon dashboard</Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi emoji="💰" label="Revenus plateforme" value={ov ? eur(ov.revenue) : '…'} wide />
        <Kpi emoji="🏬" label="Boutiques" value={ov ? String(ov.shopsCount) : '…'} />
        <Kpi emoji="👥" label="Utilisateurs" value={ov ? String(ov.usersCount) : '…'} />
        <Kpi emoji="📦" label="Produits" value={ov ? String(ov.productsCount) : '…'} />
        <Kpi emoji="🧾" label="Commandes" value={ov ? `${ov.paidOrdersCount}/${ov.ordersCount}` : '…'} />
        <Kpi emoji="🛒" label="Vendeurs" value={ov ? String(ov.roles.SELLER ?? 0) : '…'} />
      </div>

      {/* Revenus mensuels + répartition rôles */}
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-bold">Revenus plateforme (6 derniers mois)</h2>
          <div className="flex h-40 items-end justify-between gap-2">
            {(ov?.monthlyRevenue ?? []).map((m) => (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-faint">{m.revenue > 0 ? eur(m.revenue) : ''}</span>
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t-lg bg-brand-violet-magenta transition-all" style={{ height: `${Math.max(2, (m.revenue / maxRev) * 100)}%` }} />
                </div>
                <span className="text-xs capitalize text-muted">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-bold">Répartition des comptes</h2>
          <div className="space-y-3">
            {ov && ROLES.map((r) => {
              const n = ov.roles[r] ?? 0;
              const pct = ov.usersCount ? (n / ov.usersCount) * 100 : 0;
              return (
                <div key={r}>
                  <div className="flex justify-between text-sm"><span>{roleLabel(r)}</span><span className="text-muted">{n}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand-violet" style={{ width: `${Math.max(3, pct)}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="mt-8 flex gap-2">
        {(['shops', 'users', 'orders'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === t ? 'bg-brand-violet-magenta text-white' : 'bg-surface-2 text-muted hover:text-brand-violet'}`}
          >
            {t === 'shops' ? 'Boutiques' : t === 'users' ? 'Utilisateurs' : 'Commandes'}
          </button>
        ))}
      </div>

      <div className="card mt-3 overflow-x-auto p-0">
        {tab === 'shops' && <ShopsTable rows={shops} />}
        {tab === 'users' && <UsersTable rows={users} meId={me?.id} onChangeRole={changeRole} />}
        {tab === 'orders' && <OrdersTable rows={orders} />}
      </div>
    </div>
  );
}

function roleLabel(r: string) {
  return r === 'ADMIN' ? 'Administrateurs' : r === 'SELLER' ? 'Vendeurs' : r === 'CUSTOMER' ? 'Clients' : 'Agences marketing';
}

function Kpi({ emoji, label, value, wide }: { emoji: string; label: string; value: string; wide?: boolean }) {
  return (
    <div className={`card p-4 ${wide ? 'col-span-2 md:col-span-1' : ''}`}>
      <span className="text-lg">{emoji}</span>
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-faint">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-4 py-3 text-sm">{children}</td>;
}
function Loading({ cols }: { cols: number }) {
  return <tr><td colSpan={cols} className="px-4 py-8 text-center text-sm text-muted">Chargement…</td></tr>;
}
function Empty({ cols, text }: { cols: number; text: string }) {
  return <tr><td colSpan={cols} className="px-4 py-8 text-center text-sm text-muted">{text}</td></tr>;
}

function ShopsTable({ rows }: { rows: ShopRow[] | null }) {
  return (
    <table className="w-full min-w-[720px]">
      <thead className="border-b border-border"><tr><Th>Boutique</Th><Th>Propriétaire</Th><Th>Plan</Th><Th>Produits</Th><Th>Commandes</Th><Th>CA</Th><Th>Créée</Th></tr></thead>
      <tbody className="divide-y divide-border">
        {!rows ? <Loading cols={7} /> : rows.length === 0 ? <Empty cols={7} text="Aucune boutique." /> : rows.map((s) => (
          <tr key={s.id}>
            <Td><span className="font-medium">{s.name}</span><span className="ml-1 text-xs text-faint">/{s.slug}</span></Td>
            <Td><span className="text-muted">{s.owner}</span><br /><span className="text-xs text-faint">{s.ownerEmail}</span></Td>
            <Td><span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs">{s.plan}</span></Td>
            <Td>{s.productsCount}</Td>
            <Td>{s.ordersCount}</Td>
            <Td><span className="font-semibold text-brand-violet">{eur(s.revenue)}</span></Td>
            <Td><span className="text-faint">{date(s.createdAt)}</span></Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UsersTable({ rows, meId, onChangeRole }: { rows: UserRow[] | null; meId?: string; onChangeRole: (id: string, role: string) => void }) {
  return (
    <table className="w-full min-w-[720px]">
      <thead className="border-b border-border"><tr><Th>Utilisateur</Th><Th>Boutique</Th><Th>Commandes</Th><Th>Rôle</Th><Th>Inscrit</Th></tr></thead>
      <tbody className="divide-y divide-border">
        {!rows ? <Loading cols={5} /> : rows.length === 0 ? <Empty cols={5} text="Aucun utilisateur." /> : rows.map((u) => (
          <tr key={u.id}>
            <Td><span className="font-medium">{u.name}</span><br /><span className="text-xs text-faint">{u.email}</span></Td>
            <Td>{u.shopName ? <span className="text-muted">{u.shopName}</span> : <span className="text-faint">—</span>}</Td>
            <Td>{u.ordersCount}</Td>
            <Td>
              <select
                value={u.role}
                disabled={u.id === meId}
                onChange={(e) => onChangeRole(u.id, e.target.value)}
                className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs disabled:opacity-50"
                title={u.id === meId ? 'Vous ne pouvez pas changer votre propre rôle' : 'Changer le rôle'}
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Td>
            <Td><span className="text-faint">{date(u.createdAt)}</span></Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OrdersTable({ rows }: { rows: OrderRow[] | null }) {
  const badge = (s: string) => {
    const paid = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(s);
    const cls = paid ? 'bg-green-500/15 text-green-300' : s === 'PENDING' ? 'bg-amber-500/15 text-amber-300' : 'bg-red-500/15 text-red-300';
    return <span className={`rounded-md px-2 py-0.5 text-xs ${cls}`}>{s}</span>;
  };
  return (
    <table className="w-full min-w-[720px]">
      <thead className="border-b border-border"><tr><Th>Commande</Th><Th>Boutique</Th><Th>Client</Th><Th>Montant</Th><Th>Statut</Th><Th>Date</Th></tr></thead>
      <tbody className="divide-y divide-border">
        {!rows ? <Loading cols={6} /> : rows.length === 0 ? <Empty cols={6} text="Aucune commande." /> : rows.map((o) => (
          <tr key={o.id}>
            <Td><span className="font-mono text-xs">{o.orderNumber}</span></Td>
            <Td><span className="text-muted">{o.shop}</span></Td>
            <Td><span className="text-muted">{o.customer}</span><br /><span className="text-xs text-faint">{o.customerEmail}</span></Td>
            <Td><span className="font-semibold">{eur(o.total)}</span></Td>
            <Td>{badge(o.status)}</Td>
            <Td><span className="text-faint">{date(o.createdAt)}</span></Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
