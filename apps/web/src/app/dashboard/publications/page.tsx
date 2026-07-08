'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ScheduledPostDto, SocialConnectionInfo } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { Topbar } from '@/components/dashboard/topbar';
import { BrandIcon, type BrandName } from '@/components/brand-icons';

function NetBadge({ network, size = 44 }: { network: string; size?: number }) {
  const Icon = BrandIcon[network as BrandName];
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl border border-border bg-surface-2"
      style={{ width: size, height: size }}
    >
      {Icon ? <Icon width={size * 0.55} height={size * 0.55} /> : null}
    </span>
  );
}

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED: 'bg-yellow-500/15 text-yellow-500',
  PUBLISHED: 'bg-emerald-500/15 text-emerald-500',
  FAILED: 'bg-red-500/15 text-red-400',
  CANCELLED: 'bg-surface-2 text-faint',
};
const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Programmée',
  PUBLISHED: 'Publiée',
  FAILED: 'Échec',
  CANCELLED: 'Annulée',
};

export default function PublicationsPage() {
  const [connections, setConnections] = useState<SocialConnectionInfo[]>([]);
  const [posts, setPosts] = useState<ScheduledPostDto[]>([]);
  const [noShop, setNoShop] = useState(false);
  const [busy, setBusy] = useState('');

  const load = () => {
    apiFetch<SocialConnectionInfo[]>('/social/connections').then(setConnections).catch(() => setNoShop(true));
    apiFetch<ScheduledPostDto[]>('/social/scheduled').then(setPosts).catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (network: string, connected: boolean) => {
    setBusy(network);
    try {
      await apiFetch(`/social/${connected ? 'disconnect' : 'connect'}/${network}`, { method: 'POST' });
      load();
    } finally {
      setBusy('');
    }
  };

  const cancel = async (id: string) => {
    await apiFetch(`/social/scheduled/${id}/cancel`, { method: 'POST' }).catch(() => undefined);
    load();
  };

  return (
    <>
      <Topbar />
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-violet-magenta text-white">📡</span>
          <div>
            <h1 className="font-display text-3xl font-bold">Publications</h1>
            <p className="text-muted">Connectez vos réseaux et programmez vos publications.</p>
          </div>
          <span className="ml-3 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-bold text-brand-violet">
            Phase 5
          </span>
        </div>

        {noShop ? (
          <div className="card mt-6 p-10 text-center text-muted">
            Vous devez d’abord créer votre boutique.
            <Link href="/dashboard" className="btn-primary mx-auto mt-4 block w-fit">Créer ma boutique</Link>
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {/* Connexions */}
            <section>
              <h2 className="mb-3 text-lg font-bold">Comptes connectés</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {connections.map((c) => (
                  <div key={c.network} className="card flex items-center gap-3 p-4">
                    <NetBadge network={c.network} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{c.network}</p>
                      <p className="truncate text-xs text-faint">
                        {c.connected ? c.accountName : 'Non connecté'}
                      </p>
                    </div>
                    <button
                      onClick={() => toggle(c.network, c.connected)}
                      disabled={busy === c.network}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        c.connected ? 'border border-border text-muted hover:bg-surface-hover' : 'bg-brand-violet-magenta text-white'
                      }`}
                    >
                      {busy === c.network ? '…' : c.connected ? 'Déconnecter' : 'Connecter'}
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-faint">
                ⚙️ Connexion simulée. La liaison réelle (OAuth) s’active en fournissant les identifiants d’app de chaque plateforme.
              </p>
            </section>

            {/* Publications programmées */}
            <section>
              <h2 className="mb-3 text-lg font-bold">Publications ({posts.length})</h2>
              {posts.length === 0 ? (
                <div className="card p-10 text-center text-muted">
                  Aucune publication. Créez-en une depuis{' '}
                  <Link href="/dashboard/campaigns" className="text-brand-violet hover:underline">Campagnes IA</Link>.
                </div>
              ) : (
                <div className="space-y-3">
                  {posts.map((p) => (
                    <div key={p.id} className="card flex items-center gap-4 p-4">
                      {p.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm">{p.caption}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-faint">
                          <span className="flex gap-1">
                            {p.networks.map((n) => (
                              <NetBadge key={n} network={n} size={20} />
                            ))}
                          </span>
                          · {new Date(p.scheduledAt).toLocaleString('fr-FR')}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[p.status]}`}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                      {p.status === 'SCHEDULED' && (
                        <button onClick={() => cancel(p.id)} className="text-xs text-red-400 hover:text-red-300">
                          Annuler
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}
