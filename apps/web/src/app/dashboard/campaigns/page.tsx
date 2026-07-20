'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AdTone, SocialNetwork, type CampaignResult, type VideoAsset } from '@odalyan/shared';
import { apiFetch, uploadImage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Product } from '@/lib/types';
import { Topbar } from '@/components/dashboard/topbar';
import { Icon } from '@/components/dashboard/icons';
import { BrandIcon, type BrandName } from '@/components/brand-icons';
import { ProductImagePicker } from '@/components/dashboard/product-image-picker';

const ALL_NETWORKS = Object.values(SocialNetwork);

export default function CampaignsPage() {
  const t = useT();
  const [products, setProducts] = useState<Product[]>([]);
  const [noShop, setNoShop] = useState(false);
  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [tone, setTone] = useState<AdTone>(AdTone.LUXE);
  const [sourceImageUrl, setSourceImageUrl] = useState('');
  const [details, setDetails] = useState('');
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
        body: JSON.stringify({
          productId: productId || undefined,
          productName,
          tone,
          networks,
          sourceImageUrl: sourceImageUrl || undefined,
          details: details.trim() || undefined,
        }),
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

              {/* Visuel de base importé : catalogue / upload / créations IA */}
              <VisualSourcePicker value={sourceImageUrl} onChange={setSourceImageUrl} />

              <div>
                <label className="label">{t('camp.details')}</label>
                <textarea
                  className="input min-h-[64px]"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder={t('camp.detailsPh')}
                />
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
  // Vidéo générée par le bloc « Animer » ci-dessous : jointe à la publication (TikTok, Reels…).
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

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
          videoUrl: videoUrl ?? undefined,
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

      {/* Animer le visuel en vidéo (image → vidéo) */}
      <CampaignVideo campaign={campaign} onVideoReady={setVideoUrl} />

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
        {videoUrl && (
          <p className="mt-2 text-[11px] text-brand-violet">🎬 {t('camp.videoAttached')}</p>
        )}
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

/**
 * Anime le visuel d'une campagne en vidéo (image→vidéo) — réutilise le pipeline
 * vidéo existant en le seedant avec l'image de campagne. Poll jusqu'à READY.
 */
function CampaignVideo({
  campaign,
  onVideoReady,
}: {
  campaign: CampaignResult;
  onVideoReady?: (url: string | null) => void;
}) {
  const t = useT();
  const [asset, setAsset] = useState<VideoAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (poll.current) clearInterval(poll.current);
    if (asset?.status === 'PENDING') {
      poll.current = setInterval(async () => {
        try {
          const up = await apiFetch<VideoAsset>(`/ai/video/${asset.id}`);
          setAsset(up);
          if (up.status !== 'PENDING' && poll.current) clearInterval(poll.current);
        } catch {
          /* ignore */
        }
      }, 5000);
    }
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [asset?.status, asset?.id]);

  // Remonte l'URL vers CampaignKit dès que la vidéo réelle est prête (ignore le mode simulé sans URL).
  useEffect(() => {
    onVideoReady?.(asset?.status === 'READY' && asset.url ? asset.url : null);
  }, [asset?.status, asset?.url, onVideoReady]);

  const animate = async () => {
    if (!campaign.imageUrl) return;
    setError('');
    setLoading(true);
    setAsset(null);
    try {
      const providers = await apiFetch<{ id: string; enabled: boolean }[]>('/ai/video/providers');
      const providerId = providers.find((p) => p.enabled)?.id ?? providers[0]?.id ?? 'replicate';
      const res = await apiFetch<VideoAsset>('/ai/video', {
        method: 'POST',
        body: JSON.stringify({
          providerId,
          productName: campaign.productName,
          imageUrl: campaign.imageUrl,
          prompt: t('camp.videoPrompt'),
          language: 'fr',
        }),
      });
      setAsset(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold">🎬 {t('camp.video')}</h2>
          <p className="text-xs text-muted">{t('camp.videoDesc')}</p>
        </div>
        <button onClick={animate} disabled={loading || !campaign.imageUrl} className="btn-primary">
          {loading ? t('common.generating') : `🎬 ${t('camp.animate')}`}
        </button>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}

      {asset && (
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <div className="relative aspect-video bg-black">
            {asset.status === 'READY' && asset.url ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={asset.url} controls autoPlay loop className="h-full w-full" />
            ) : asset.status === 'PENDING' ? (
              <div className="grid h-full place-items-center text-center text-white/80">
                <div>
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand-magenta" />
                  <p className="mt-2 text-sm">{t('common.generating')} ({asset.provider})</p>
                </div>
              </div>
            ) : asset.status === 'FAILED' ? (
              <div className="grid h-full place-items-center text-red-300">{t('vid.failed')}</div>
            ) : (
              <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_30%,rgba(124,58,237,0.4),transparent_60%)] p-6 text-center text-white">
                <div>
                  <p className="text-4xl">🎬</p>
                  <p className="mt-2 font-semibold">{t('vid.simMode')}</p>
                  {campaign.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={campaign.imageUrl} alt="" className="mx-auto mt-3 h-32 rounded-lg object-cover" />
                  )}
                </div>
              </div>
            )}
          </div>
          <p className="px-3 py-1.5 text-[10px] text-faint">
            {asset.provider === 'mock' ? t('common.simulated') : `✨ ${asset.provider}`} · {asset.status}
          </p>
        </div>
      )}
    </div>
  );
}

interface AiAsset {
  id: string;
  url?: string | null;
  type: string;
}

/**
 * Choix du visuel de base d'une campagne : depuis le catalogue (produits +
 * affiliés), un import de fichier, ou une création IA existante (avatar/mannequin).
 * Quand un visuel est choisi, la campagne le transforme en image→image.
 */
function VisualSourcePicker({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const t = useT();
  const [tab, setTab] = useState<'catalog' | 'upload' | 'creations'>('catalog');
  const [assets, setAssets] = useState<AiAsset[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    apiFetch<AiAsset[]>('/ai/assets')
      .then((list) => setAssets(list.filter((a) => a.url && ['AVATAR', 'MANNEQUIN', 'STUDIO_PHOTO'].includes(a.type))))
      .catch(() => setAssets([]));
  }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      onChange(url);
    } catch {
      /* ignore */
    } finally {
      setUploading(false);
    }
  };

  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'catalog', label: `📦 ${t('camp.srcCatalog')}` },
    { key: 'upload', label: `📤 ${t('camp.srcUpload')}` },
    { key: 'creations', label: `✨ ${t('camp.srcCreations')}` },
  ];

  return (
    <div>
      <label className="label">{t('camp.visualSource')}</label>
      <div className="mb-2 flex gap-1 rounded-xl bg-surface-2 p-1">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setTab(tb.key)}
            className={`flex-1 rounded-lg py-1.5 text-[11px] font-medium transition ${tab === tb.key ? 'bg-brand-violet-magenta text-white' : 'text-muted'}`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'catalog' && <ProductImagePicker value={value || undefined} onPick={(url) => onChange(url)} />}

      {tab === 'upload' && (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-surface-2 p-4 text-center transition hover:border-brand-violet">
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
          <span className="text-xl">📤</span>
          <span className="text-xs text-muted">{uploading ? t('common.loading') : t('camp.uploadHint')}</span>
        </label>
      )}

      {tab === 'creations' &&
        (assets.length === 0 ? (
          <p className="text-xs text-faint">{t('camp.noCreations')}</p>
        ) : (
          <div className="grid max-h-40 grid-cols-4 gap-2 overflow-y-auto rounded-xl border border-border bg-surface p-2 scrollbar-thin">
            {assets.map((a) => (
              <button
                type="button"
                key={a.id}
                onClick={() => onChange(a.url!)}
                className={`overflow-hidden rounded-lg border transition ${value === a.url ? 'border-brand-violet ring-1 ring-brand-violet/40' : 'border-border hover:border-brand-violet'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url!} alt="" className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        ))}

      {value && (
        <div className="mt-2 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-10 w-10 rounded object-cover" />
          <span className="text-[11px] text-brand-violet">✨ {t('camp.willUseVisual')}</span>
          <button type="button" onClick={() => onChange('')} className="text-[11px] text-faint hover:text-content">
            ✕ {t('aim.clearPhoto')}
          </button>
        </div>
      )}
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
