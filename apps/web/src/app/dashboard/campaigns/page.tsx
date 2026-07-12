'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdTone, SocialNetwork, type CampaignResult } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Product } from '@/lib/types';
import { Topbar } from '@/components/dashboard/topbar';
import { Icon } from '@/components/dashboard/icons';
import { BrandIcon, type BrandName } from '@/components/brand-icons';

const ALL_NETWORKS = Object.values(SocialNetwork);

export default function CampaignsPage() {
  const t = useT();
  const [products, setProducts] = useState<Product[]>([]);
  const [noShop, setNoShop] = useState(false);
  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [tone, setTone] = useState<AdTone>(AdTone.LUXE);
  const [networks, setNetworks] = useState<SocialNetwork[]>([
    SocialNetwork.FACEBOOK,
    SocialNetwork.INSTAGRAM,
    SocialNetwork.TIKTOK,
  ]);

  const [campaign, setCampaign] = useState<CampaignResult | null>(null);
  const [history, setHistory] = useState<CampaignResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = () => {
    apiFetch<CampaignResult[]>('/ai/campaigns').then(setHistory).catch(() => undefined);
  };

  useEffect(() => {
    apiFetch<Product[]>('/products/mine')
      .then((p) => {
        setProducts(p);
        if (p[0]) {
          setProductId(p[0].id);
          setProductName(p[0].name);
        }
      })
      .catch(() => setNoShop(true));
    loadHistory();
  }, []);

  const toggleNet = (n: SocialNetwork) =>
    setNetworks((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  const generate = async () => {
    if (!productName.trim()) {
      setError(t('camp.nameRequired'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<CampaignResult>('/ai/campaign', {
        method: 'POST',
        body: JSON.stringify({ productId: productId || undefined, productName, tone, networks }),
      });
      setCampaign(res);
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Topbar />
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-violet-magenta text-white">📣</span>
          <div>
            <h1 className="font-display text-3xl font-bold">{t('dash.nav.campaigns')}</h1>
            <p className="text-muted">{t('camp.subtitle')}</p>
          </div>
          <span className="ml-3 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-bold text-brand-violet">
            Phase 4
          </span>
        </div>

        {noShop ? (
          <div className="card mt-6 p-10 text-center text-muted">
            {t('common.mustCreateShop')}
            <Link href="/dashboard" className="btn-primary mx-auto mt-4 block w-fit">{t('dh.createShop')}</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
            {/* Brief */}
            <div className="card h-fit space-y-4 p-5">
              <h2 className="font-bold">{t('camp.new')}</h2>
              <div>
                <label className="label">{t('common.product')}</label>
                <input
                  className="input"
                  list="prods"
                  value={productName}
                  onChange={(e) => {
                    setProductName(e.target.value);
                    setProductId(products.find((p) => p.name === e.target.value)?.id ?? '');
                  }}
                  placeholder={t('aim.productNamePh')}
                />
                <datalist id="prods">
                  {products.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="label">{t('aim.tone')}</label>
                <select className="input" value={tone} onChange={(e) => setTone(e.target.value as AdTone)}>
                  {Object.values(AdTone).map((tn) => (
                    <option key={tn} value={tn}>{tn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t('camp.targets')}</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_NETWORKS.map((n) => (
                    <button
                      key={n}
                      onClick={() => toggleNet(n)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${networks.includes(n) ? 'border-brand-violet bg-surface-2 text-content' : 'border-border text-muted'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}

              <button onClick={generate} disabled={loading || networks.length === 0} className="btn-primary w-full">
                {loading ? t('camp.generating') : <>{Icon.sparkles({ width: 16, height: 16 })} {t('camp.generate')}</>}
              </button>
            </div>

            {/* Résultat */}
            <div className="space-y-6">
              {campaign ? (
                <CampaignKit campaign={campaign} />
              ) : (
                <div className="card grid min-h-[300px] place-items-center p-10 text-center text-muted">
                  <div>
                    <p className="text-5xl">📣</p>
                    <p className="mt-3">{t('camp.emptyHint')}</p>
                  </div>
                </div>
              )}

              {history.length > 0 && (
                <div>
                  <h2 className="mb-3 text-lg font-bold">{t('camp.history')} ({history.length})</h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {history.map((c) => (
                      <button key={c.id} onClick={() => setCampaign(c)} className="card overflow-hidden text-left transition hover:border-brand-violet">
                        {c.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.imageUrl} alt="" className="aspect-video w-full object-cover" />
                        )}
                        <div className="p-2.5">
                          <p className="line-clamp-1 text-sm font-medium">{c.productName}</p>
                          <p className="text-[10px] text-faint">{c.posts.length} {t('camp.networksWord')} · {new Date(c.createdAt).toLocaleDateString('fr-FR')}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function CampaignKit({ campaign }: { campaign: CampaignResult }) {
  const t = useT();
  const [scheduledAt, setScheduledAt] = useState('');
  const [pubNets, setPubNets] = useState<string[]>(campaign.posts.map((p) => p.network));
  const [scheduled, setScheduled] = useState<string | null>(null);
  const [pubError, setPubError] = useState('');
  const [publishing, setPublishing] = useState(false);

  const copy = (text: string) => navigator.clipboard?.writeText(text);
  const togglePub = (n: string) => setPubNets((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  const program = async () => {
    setPubError('');
    setScheduled(null);
    setPublishing(true);
    try {
      const caption = campaign.posts.find((p) => pubNets.includes(p.network))?.caption ?? campaign.copy.description;
      await apiFetch('/social/schedule', {
        method: 'POST',
        body: JSON.stringify({
          caption,
          imageUrl: campaign.imageUrl ?? undefined,
          networks: pubNets,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          campaignAssetId: campaign.id,
        }),
      });
      setScheduled(`${pubNets.join(', ')}${scheduledAt ? ' · ' + new Date(scheduledAt).toLocaleString('fr-FR') : ` · ${t('camp.now')}`}`);
    } catch (err) {
      setPubError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="grid gap-0 md:grid-cols-2">
          {campaign.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={campaign.imageUrl} alt="" className="h-full max-h-80 w-full object-cover" />
          )}
          <div className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">{campaign.productName}</h2>
              <span className="text-[10px] text-faint">
                {campaign.providers.image === 'mock' ? t('camp.visualSim') : `✨ ${campaign.providers.image}`}
              </span>
            </div>
            <CopyRow label={t('aim.description')} text={campaign.copy.description} onCopy={copy} />
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-faint">{t('aim.slogans')}</p>
              <ul className="space-y-1 text-sm">
                {campaign.copy.slogans.map((s, i) => (
                  <li key={i} className="flex gap-2"><span className="text-brand-coral">›</span> {s}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-1">
              {campaign.copy.hashtags.map((h) => (
                <span key={h} className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-brand-violet">#{h}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Légendes par réseau */}
      <div className="grid gap-3 sm:grid-cols-2">
        {campaign.posts.map((p) => (
          <div key={p.network} className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold">
                {(() => {
                  const I = BrandIcon[p.network as BrandName];
                  return I ? <I width={18} height={18} /> : null;
                })()}
                {p.network}
              </span>
              <button onClick={() => copy(p.caption)} className="text-xs text-brand-violet hover:underline">{t('aim.copy')}</button>
            </div>
            <p className="whitespace-pre-line text-xs text-muted">{p.caption}</p>
          </div>
        ))}
      </div>

      {/* Publication / programmation */}
      <div className="card p-5">
        <h2 className="font-bold">{t('camp.publish')}</h2>
        <p className="mt-1 text-xs text-muted">{t('camp.publishDesc')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {campaign.posts.map((p) => (
            <button
              key={p.network}
              onClick={() => togglePub(p.network)}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${pubNets.includes(p.network) ? 'border-brand-violet bg-surface-2' : 'border-border text-muted'}`}
            >
              {p.network}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input type="datetime-local" className="input w-auto" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          <button onClick={program} disabled={pubNets.length === 0 || publishing} className="btn-primary">
            {publishing ? '…' : t('camp.schedule')}
          </button>
        </div>
        {pubError && (
          <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">
            {pubError} — <Link href="/dashboard/publications" className="underline">{t('camp.connectNets')}</Link>
          </p>
        )}
        {scheduled && (
          <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
            {t('camp.scheduledOk')} {scheduled}
            <span className="block text-[10px] text-faint">
              {t('camp.followIn')} <Link href="/dashboard/publications" className="underline">{t('dash.nav.publications')}</Link>. {t('camp.simTail')}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

function CopyRow({ label, text, onCopy }: { label: string; text: string; onCopy: (v: string) => void }) {
  const t = useT();
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">{label}</span>
        <button onClick={() => onCopy(text)} className="text-xs text-brand-violet hover:underline">{t('aim.copy')}</button>
      </div>
      <p className="text-sm">{text}</p>
    </div>
  );
}
