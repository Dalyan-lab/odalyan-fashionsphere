'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type {
  BestTimesResult,
  MonthlyReportDto,
  ScheduledPostDto,
  SocialConnectionInfo,
  SocialCopyResult,
  SocialIdeasResult,
  TopPostDto,
} from '@odalyan/shared';
import { apiFetch, uploadFile } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { Topbar } from '@/components/dashboard/topbar';
import { BrandIcon, type BrandName } from '@/components/brand-icons';

/** Taille maximale acceptée par l'API pour un média (miroir de upload.controller.ts). */
const MAX_UPLOAD_MB = 200;

/** Limite de caractères recommandée par réseau (miroir du serveur). */
const NET_LIMITS: Record<string, number> = {
  Facebook: 1900,
  Instagram: 2200,
  TikTok: 150,
  YouTube: 5000,
  Pinterest: 500,
  X: 280,
};

/** Créneaux de publication recommandés (heure locale) par réseau. */
const BEST_TIMES: Record<string, string[]> = {
  Facebook: ['12:30', '18:30'],
  Instagram: ['12:00', '19:30'],
  TikTok: ['19:00', '21:00'],
  YouTube: ['18:00'],
  Pinterest: ['21:00'],
  X: ['09:00', '12:30'],
};

const POST_TYPES = ['promo', 'actu', 'temoignage', 'coulisses', 'autre'] as const;

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED: 'bg-yellow-500/15 text-yellow-500',
  PUBLISHED: 'bg-emerald-500/15 text-emerald-500',
  PARTIAL: 'bg-amber-500/15 text-amber-500',
  FAILED: 'bg-red-500/15 text-red-400',
  CANCELLED: 'bg-surface-2 text-faint',
};

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Libellés courts, indexés par jour ISO - 1 (1 = lundi). */
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Prochaine occurrence d'un jour de la semaine (aujourd'hui compris), au format AAAA-MM-JJ. */
function nextDateForWeekday(weekday: number): string {
  const d = new Date();
  const current = ((d.getDay() + 6) % 7) + 1; // 1 = lundi … 7 = dimanche
  d.setDate(d.getDate() + ((weekday - current + 7) % 7));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function NetBadge({ network, size = 20 }: { network: string; size?: number }) {
  const Icon = BrandIcon[network as BrandName];
  return (
    <span
      className="grid shrink-0 place-items-center rounded-lg border border-border bg-surface-2"
      style={{ width: size, height: size }}
    >
      {Icon ? <Icon width={size * 0.55} height={size * 0.55} /> : null}
    </span>
  );
}

interface GeneratedAsset {
  id: string;
  type: string;
  provider: string;
  prompt?: string | null;
  url?: string | null;
  meta?: unknown;
  createdAt: string;
}

const isVideoAsset = (a: GeneratedAsset) => {
  const kind = (a.meta as { kind?: string } | null)?.kind;
  return kind === 'video' || /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(a.url ?? '');
};

/**
 * Sélecteur de médias générés (Studio / Vidéo IA) : réutilise les visuels et
 * vidéos déjà créés au lieu de re-téléverser un fichier.
 */
function StudioMediaPicker({
  onPick,
  onClose,
}: {
  onPick: (m: { url: string; kind: 'image' | 'video'; name: string }) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [tab, setTab] = useState<'images' | 'videos'>('images');
  const [images, setImages] = useState<GeneratedAsset[]>([]);
  const [videos, setVideos] = useState<GeneratedAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<GeneratedAsset[]>('/ai/assets').catch(() => [] as GeneratedAsset[]),
      apiFetch<GeneratedAsset[]>('/ai/videos').catch(() => [] as GeneratedAsset[]),
    ]).then(([assets, vids]) => {
      setImages(assets.filter((a) => a.url && !isVideoAsset(a)));
      setVideos(vids.filter((a) => a.url));
      setLoading(false);
    });
  }, []);

  const list = tab === 'images' ? images : videos;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">🎨 {t('pilot.pickerTitle')}</h3>
          <button onClick={onClose} className="text-faint hover:text-content">✕</button>
        </div>
        <div className="mb-4 flex gap-2">
          {(['images', 'videos'] as const).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                tab === id ? 'border-brand-violet bg-surface-2' : 'border-border text-muted'
              }`}
            >
              {id === 'images' ? `🖼️ ${t('pilot.pickerImages')} (${images.length})` : `🎬 ${t('pilot.pickerVideos')} (${videos.length})`}
            </button>
          ))}
        </div>
        {loading ? (
          <p className="p-6 text-center text-sm text-muted">…</p>
        ) : list.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">{t('pilot.pickerEmpty')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {list.map((a) => (
              <button
                key={a.id}
                onClick={() =>
                  onPick({
                    url: a.url!,
                    kind: tab === 'images' ? 'image' : 'video',
                    name: a.prompt?.slice(0, 40) || (tab === 'images' ? 'Image Studio' : 'Vidéo générée'),
                  })
                }
                className="group overflow-hidden rounded-xl border border-border transition hover:border-brand-violet"
              >
                {tab === 'images' ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={a.url!} alt="" className="h-28 w-full object-cover transition group-hover:scale-105" loading="lazy" />
                ) : (
                  <span className="relative block h-28 w-full bg-black">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video src={`${a.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    <span className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 text-xs">🎬</span>
                  </span>
                )}
                {a.prompt && <p className="line-clamp-1 px-2 py-1.5 text-left text-[11px] text-faint">{a.prompt}</p>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Score qualité d'un texte : longueur, appel à l'action, hashtags (Instagram). */
function scoreText(text: string, network: string, t: (k: string) => string): { score: number; notes: string[] } {
  if (!text.trim()) return { score: 0, notes: [] };
  const limit = NET_LIMITS[network] ?? 1000;
  let score = 100;
  const notes: string[] = [];
  if (text.length > limit) {
    score -= 25;
    notes.push(t('pilot.note.tooLong'));
  }
  const ctaWords = ['contactez', 'appelez', 'réservez', 'commandez', 'découvrez', 'visitez', 'cliquez', 'inscrivez', 'profitez', 'venez', 'écrivez', 'achetez', 'foncez'];
  if (!ctaWords.some((w) => text.toLowerCase().includes(w))) {
    score -= 20;
    notes.push(t('pilot.note.noCta'));
  }
  if (network === 'Instagram' && !text.includes('#')) {
    score -= 15;
    notes.push(t('pilot.note.noHashtag'));
  }
  if (text.length < 20) {
    score -= 20;
    notes.push(t('pilot.note.short'));
  }
  score = Math.max(0, Math.min(100, score));
  if (notes.length === 0) notes.push(t('pilot.note.good'));
  return { score, notes };
}

/**
 * L'onglet actif et le brouillon en cours sont mémorisés pour la session : en
 * revenant sur la page (après avoir consulté une commande, par exemple) on
 * retrouve exactement où on en était, au lieu d'un formulaire vide.
 */
const TAB_KEY = 'pilotage.tab';
const DRAFT_KEY = 'pilotage.draft';

/** Brouillon de publication conservé entre deux visites de la page. */
interface PilotageDraft {
  brief: string;
  tone: string;
  postType: string;
  nets: string[];
  when: 'now' | 'later';
  date: string;
  time: string;
  drafts: Record<string, string>;
  media: { url: string; kind: 'image' | 'video'; name: string } | null;
}

const TABS = ['create', 'calendar', 'report'] as const;
const TAB_ICON: Record<(typeof TABS)[number], string> = { create: '✨', calendar: '📅', report: '📈' };

export default function PilotagePage() {
  const t = useT();
  const [tab, setTab] = useState<(typeof TABS)[number]>('create');

  // Restaure l'onglet consulté en dernier (sessionStorage n'existe pas côté serveur).
  useEffect(() => {
    const saved = sessionStorage.getItem(TAB_KEY);
    if (saved && (TABS as readonly string[]).includes(saved)) {
      setTab(saved as (typeof TABS)[number]);
    }
  }, []);

  const changeTab = (id: (typeof TABS)[number]) => {
    setTab(id);
    sessionStorage.setItem(TAB_KEY, id);
  };
  const [connections, setConnections] = useState<SocialConnectionInfo[]>([]);
  const [posts, setPosts] = useState<ScheduledPostDto[]>([]);
  const [bestTimes, setBestTimes] = useState<BestTimesResult | null>(null);
  const [noShop, setNoShop] = useState(false);
  /** Sujet injecté depuis le recyclage d'une publication performante. */
  const [seedBrief, setSeedBrief] = useState('');

  const load = () => {
    apiFetch<SocialConnectionInfo[]>('/social/connections').then(setConnections).catch(() => setNoShop(true));
    apiFetch<ScheduledPostDto[]>('/social/scheduled').then(setPosts).catch(() => undefined);
    apiFetch<BestTimesResult>('/social/best-times').then(setBestTimes).catch(() => undefined);
  };
  useEffect(load, []);

  /** Reprend une publication qui a marché : pré-remplit l'onglet Créer avec un angle neuf. */
  const recycle = (post: TopPostDto) => {
    setSeedBrief(
      `${t('pilot.recycleBrief')} : « ${post.caption.replace(/\s+/g, ' ').slice(0, 400)} »`,
    );
    changeTab('create');
  };

  return (
    <>
      <Topbar />
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-violet-magenta text-white">🎛️</span>
          <div>
            <h1 className="font-display text-3xl font-bold">{t('pilot.title')}</h1>
            <p className="text-muted">{t('pilot.subtitle')}</p>
          </div>
        </div>

        {noShop ? (
          <div className="card mt-6 p-10 text-center text-muted">
            {t('common.mustCreateShop')}
            <Link href="/dashboard" className="btn-primary mx-auto mt-4 block w-fit">{t('dh.createShop')}</Link>
          </div>
        ) : (
          <>
            <div className="mt-6 flex gap-2 border-b border-border">
              {TABS.map((id) => (
                <button
                  key={id}
                  onClick={() => changeTab(id)}
                  className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                    tab === id ? 'border-brand-violet text-content' : 'border-transparent text-muted hover:text-content'
                  }`}
                >
                  {TAB_ICON[id]} {t(`pilot.tab.${id}`)}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {tab === 'create' && (
                <CreateTab
                  connections={connections}
                  bestTimes={bestTimes}
                  seedBrief={seedBrief}
                  onSeedUsed={() => setSeedBrief('')}
                  onScheduled={() => { load(); changeTab('calendar'); }}
                />
              )}
              {tab === 'calendar' && <CalendarTab posts={posts} onChanged={load} onRecycle={recycle} />}
              {tab === 'report' && <ReportTab onRecycle={recycle} />}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────── Onglet « Créer un post »

function CreateTab({
  connections,
  bestTimes,
  seedBrief,
  onSeedUsed,
  onScheduled,
}: {
  connections: SocialConnectionInfo[];
  bestTimes: BestTimesResult | null;
  seedBrief: string;
  onSeedUsed: () => void;
  onScheduled: () => void;
}) {
  const t = useT();
  const connected = connections.filter((c) => c.connected);

  const [brief, setBrief] = useState('');
  const [tone, setTone] = useState('');
  const [postType, setPostType] = useState<string>('autre');
  const [nets, setNets] = useState<string[]>([]);
  const [when, setWhen] = useState<'now' | 'later'>('later');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('18:30');

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [ideas, setIdeas] = useState<SocialIdeasResult | null>(null);
  const [loadingIdeas, setLoadingIdeas] = useState(false);

  const [media, setMedia] = useState<{ url: string; kind: 'image' | 'video'; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Présélectionne les réseaux connectés au chargement
  useEffect(() => {
    if (nets.length === 0 && connected.length > 0) setNets(connected.map((c) => c.network));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections]);

  /**
   * Brouillon : restauré au montage, puis sauvegardé à chaque modification.
   * `restored` évite d'écraser le brouillon enregistré avec l'état vide initial.
   */
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as PilotageDraft;
        setBrief(d.brief ?? '');
        setTone(d.tone ?? '');
        setPostType(d.postType ?? 'autre');
        if (d.nets?.length) setNets(d.nets);
        setWhen(d.when ?? 'later');
        if (d.date) setDate(d.date);
        if (d.time) setTime(d.time);
        setDrafts(d.drafts ?? {});
        setMedia(d.media ?? null);
      }
    } catch {
      /* brouillon illisible : on repart d'un formulaire vierge */
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    const draft: PilotageDraft = { brief, tone, postType, nets, when, date, time, drafts, media };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [restored, brief, tone, postType, nets, when, date, time, drafts, media]);

  // Sujet venu du recyclage d'une publication performante
  useEffect(() => {
    if (!seedBrief) return;
    setBrief(seedBrief);
    setDrafts({});
    onSeedUsed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedBrief]);

  const toggleNet = (n: string) =>
    setNets((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));

  const generate = async () => {
    if (!brief.trim() || nets.length === 0) return;
    setGenerating(true);
    setMsg(null);
    try {
      const res = await apiFetch<SocialCopyResult>('/ai/social-copy', {
        method: 'POST',
        body: JSON.stringify({ brief: brief.trim(), tone: tone.trim() || undefined, postType, networks: nets }),
      });
      setDrafts(res.texts);
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : t('common.error') });
    } finally {
      setGenerating(false);
    }
  };

  const fetchIdeas = async () => {
    setLoadingIdeas(true);
    setMsg(null);
    try {
      const res = await apiFetch<SocialIdeasResult>('/ai/social-ideas', {
        method: 'POST',
        body: JSON.stringify({ tone: tone.trim() || undefined }),
      });
      setIdeas(res);
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : t('common.error') });
    } finally {
      setLoadingIdeas(false);
    }
  };

  const useMyText = () => {
    if (!brief.trim() || nets.length === 0) return;
    const d: Record<string, string> = {};
    for (const n of nets) d[n] = brief.trim();
    setDrafts(d);
  };

  const pickMedia = async (file: File | undefined) => {
    if (!file) return;
    // Vérifié AVANT l'envoi : inutile de faire monter 200 Mo pour se voir refuser à l'arrivée.
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_UPLOAD_MB) {
      setMsg({
        kind: 'err',
        text: t('pilot.tooLarge').replace('{size}', sizeMb.toFixed(0)).replace('{max}', String(MAX_UPLOAD_MB)),
      });
      return;
    }
    setUploading(true);
    setMsg(null);
    try {
      const { url } = await uploadFile(file);
      setMedia({ url, kind: file.type.startsWith('video') ? 'video' : 'image', name: file.name });
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : t('common.error') });
    } finally {
      setUploading(false);
    }
  };

  const readyNets = nets.filter((n) => drafts[n]?.trim());
  const tiktokNoVideo = readyNets.includes('TikTok') && media?.kind !== 'video';
  // Créneaux issus des vraies performances, limités aux réseaux sélectionnés.
  const computedSlots = (bestTimes?.slots ?? []).filter((s) => nets.includes(s.network));

  const schedule = async () => {
    if (readyNets.length === 0) return;
    setPublishing(true);
    setMsg(null);
    const scheduledAt = when === 'later' ? new Date(`${date}T${time}`).toISOString() : undefined;
    try {
      // Un post par réseau : chaque réseau reçoit son texte adapté
      for (const n of readyNets) {
        await apiFetch('/social/schedule', {
          method: 'POST',
          body: JSON.stringify({
            caption: drafts[n].trim(),
            networks: [n],
            scheduledAt,
            imageUrl: media?.kind === 'image' ? media.url : undefined,
            videoUrl: media?.kind === 'video' ? media.url : undefined,
          }),
        });
      }
      setMsg({ kind: 'ok', text: when === 'later' ? t('pilot.scheduledOk') : t('pilot.publishedOk') });
      setBrief('');
      setDrafts({});
      setMedia(null);
      onScheduled();
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : t('common.error') });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Sujet + paramètres */}
      <div className="card space-y-4 p-5">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold text-muted">{t('pilot.brief')}</label>
            <button
              onClick={fetchIdeas}
              disabled={loadingIdeas}
              className="text-xs font-semibold text-brand-violet hover:underline disabled:opacity-50"
            >
              {loadingIdeas ? '…' : `💡 ${t('pilot.ideas')}`}
            </button>
          </div>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={t('pilot.briefPh')}
            rows={2}
            className="input w-full"
          />
        </div>

        {ideas && (ideas.ideas.length > 0 || ideas.hashtags.length > 0) && (
          <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
            {ideas.ideas.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-muted">{t('pilot.ideasHint')}</p>
                <div className="flex flex-col gap-1.5">
                  {ideas.ideas.map((idea, i) => (
                    <button
                      key={i}
                      onClick={() => setBrief(idea)}
                      className="rounded-lg bg-surface px-3 py-2 text-left text-sm transition hover:bg-surface-hover"
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {ideas.hashtags.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-muted">{t('pilot.hashtagsHint')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {ideas.hashtags.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => navigator.clipboard?.writeText(`#${h}`)}
                      className="rounded-full border border-border px-2.5 py-1 text-xs transition hover:border-brand-violet"
                    >
                      #{h}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">{t('pilot.tone')}</label>
            <input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder={t('pilot.tonePh')}
              className="input w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">{t('pilot.type')}</label>
            <select value={postType} onChange={(e) => setPostType(e.target.value)} className="input w-full">
              {POST_TYPES.map((p) => (
                <option key={p} value={p}>{t(`pilot.type.${p}`)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Réseaux */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">{t('pilot.networks')}</label>
          {connected.length === 0 ? (
            <p className="text-xs text-faint">
              {t('pilot.noNetworks')}{' '}
              <Link href="/dashboard/publications" className="text-brand-violet hover:underline">
                {t('dash.nav.publications')}
              </Link>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {connected.map((c) => (
                <button
                  key={c.network}
                  onClick={() => toggleNet(c.network)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                    nets.includes(c.network) ? 'border-brand-violet bg-surface-2' : 'border-border text-muted'
                  }`}
                >
                  <NetBadge network={c.network} size={18} />
                  {c.network}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Média */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">{t('pilot.media')}</label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setPickerOpen(true)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface-hover"
            >
              🎨 {t('pilot.fromStudio')}
            </button>
            <label className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface-hover">
              {uploading ? t('pilot.converting') : `📎 ${t('pilot.chooseMedia')}`}
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => pickMedia(e.target.files?.[0])}
              />
            </label>
            {media && (
              <>
                <span className="truncate text-xs text-emerald-500">✓ {media.name}</span>
                <button onClick={() => setMedia(null)} className="text-xs text-red-400 hover:underline">
                  ✕ {t('pilot.removeMedia')}
                </button>
              </>
            )}
          </div>
          {media?.kind === 'image' && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={media.url} alt="" className="mt-2 h-28 rounded-xl border border-border object-cover" />
          )}
          {media?.kind === 'video' && (
            <video src={media.url} controls className="mt-2 max-h-48 rounded-xl border border-border" />
          )}
          <p className="mt-1.5 text-xs text-faint">{t('pilot.mediaHint').replace('{max}', String(MAX_UPLOAD_MB))}</p>
          {tiktokNoVideo && <p className="mt-1.5 text-xs text-amber-500">⚠️ {t('pilot.tiktokNeedsVideo')}</p>}
          {pickerOpen && (
            <StudioMediaPicker
              onPick={(m) => {
                setMedia(m);
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>

        {/* Quand publier */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">{t('pilot.when')}</label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setWhen('now')}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${when === 'now' ? 'border-brand-violet bg-surface-2' : 'border-border text-muted'}`}
            >
              ⚡ {t('pilot.now')}
            </button>
            <button
              onClick={() => setWhen('later')}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${when === 'later' ? 'border-brand-violet bg-surface-2' : 'border-border text-muted'}`}
            >
              🕒 {t('pilot.later')}
            </button>
            {when === 'later' && (
              <>
                <input type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} className="input w-auto" />
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input w-auto" />
              </>
            )}
          </div>
          {when === 'later' && nets.length > 0 && (
            <div className="mt-2">
              {computedSlots.length > 0 ? (
                <>
                  <span className="text-xs text-faint">
                    {t('pilot.bestTimesComputed').replace('{n}', String(bestTimes?.analyzed ?? 0))} :
                  </span>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {computedSlots.map((s) => {
                      const hh = `${String(s.hour).padStart(2, '0')}:00`;
                      return (
                        <button
                          key={`${s.network}-${s.weekday}-${s.hour}`}
                          onClick={() => {
                            setTime(hh);
                            setDate(nextDateForWeekday(s.weekday));
                          }}
                          title={t('pilot.slotDetail')
                            .replace('{avg}', String(s.avgInteractions))
                            .replace('{n}', String(s.samples))}
                          className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted transition hover:border-brand-violet"
                        >
                          <NetBadge network={s.network} size={14} />
                          {WEEKDAYS[s.weekday - 1]} {hh}
                          <span className="text-emerald-500">↑{s.avgInteractions}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <span className="text-xs text-faint">
                    {t('pilot.bestTimesGeneric')}
                    {bestTimes ? ` (${t('pilot.needMore').replace('{n}', String(bestTimes.minimum - bestTimes.analyzed))})` : ''} :
                  </span>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {nets.flatMap((n) => (BEST_TIMES[n] ?? []).map((h) => ({ n, h }))).map(({ n, h }) => (
                      <button
                        key={`${n}-${h}`}
                        onClick={() => setTime(h)}
                        title={n}
                        className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition hover:border-brand-violet ${time === h ? 'border-brand-violet text-content' : 'border-border text-muted'}`}
                      >
                        <NetBadge network={n} size={14} /> {h}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={generate}
            disabled={generating || !brief.trim() || nets.length === 0}
            className="btn-primary disabled:opacity-40"
          >
            {generating ? t('pilot.generating') : `✨ ${t('pilot.generate')}`}
          </button>
          <button
            onClick={useMyText}
            disabled={!brief.trim() || nets.length === 0}
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface-hover disabled:opacity-40"
          >
            {t('pilot.useMyText')}
          </button>
          {msg && (
            <span className={`text-sm ${msg.kind === 'ok' ? 'text-emerald-500' : 'text-red-400'}`}>
              {msg.kind === 'ok' ? '✅ ' : '⚠️ '}
              {msg.text}
            </span>
          )}
        </div>
      </div>

      {/* Textes générés, éditables par réseau */}
      {readyNets.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">{t('pilot.perNetwork')}</p>
          {readyNets.map((n) => {
            const s = scoreText(drafts[n], n, t);
            const limit = NET_LIMITS[n] ?? 1000;
            const over = drafts[n].length > limit;
            return (
              <div key={n} className="card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <NetBadge network={n} /> {n}
                  </span>
                  <span
                    className={`text-xs font-bold ${s.score >= 80 ? 'text-emerald-500' : s.score >= 50 ? 'text-amber-500' : 'text-red-400'}`}
                  >
                    {s.score}/100
                  </span>
                </div>
                <textarea
                  value={drafts[n]}
                  onChange={(e) => setDrafts((d) => ({ ...d, [n]: e.target.value }))}
                  rows={n === 'TikTok' || n === 'X' ? 2 : 4}
                  className="input w-full"
                />
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className={over ? 'text-red-400' : 'text-faint'}>
                    {drafts[n].length} / {limit}
                  </span>
                  <span className="text-faint">{s.notes.join(' · ')}</span>
                </div>
              </div>
            );
          })}
          <button onClick={schedule} disabled={publishing} className="btn-primary disabled:opacity-40">
            {publishing
              ? '…'
              : when === 'later'
                ? `📅 ${t('pilot.scheduleBtn')} — ${new Date(`${date}T${time}`).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
                : `🚀 ${t('pilot.publishBtn')}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────── Onglet « Calendrier »

function CalendarTab({
  posts,
  onChanged,
  onRecycle,
}: {
  posts: ScheduledPostDto[];
  onChanged: () => void;
  onRecycle: (post: TopPostDto) => void;
}) {
  const t = useT();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [top, setTop] = useState<TopPostDto[]>([]);

  useEffect(() => {
    apiFetch<TopPostDto[]>('/social/top-posts').then(setTop).catch(() => undefined);
  }, [posts]);

  // Cumul des statistiques de toutes les publications remontées par les réseaux.
  const totals = useMemo(() => {
    const acc = { views: 0, likes: 0, comments: 0, shares: 0, measured: 0 };
    for (const p of posts) {
      for (const i of p.insights ?? []) {
        acc.views += i.views;
        acc.likes += i.likes;
        acc.comments += i.comments;
        acc.shares += i.shares;
        acc.measured++;
      }
    }
    return acc;
  }, [posts]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await apiFetch('/social/insights/refresh', { method: 'POST' });
      onChanged();
    } catch {
      /* l'erreur par réseau est déjà affichée sur chaque publication */
    } finally {
      setRefreshing(false);
    }
  };

  const byDate = useMemo(() => {
    const m: Record<string, ScheduledPostDto[]> = {};
    for (const p of posts) {
      const d = p.scheduledAt.slice(0, 10);
      (m[d] = m[d] ?? []).push(p);
    }
    return m;
  }, [posts]);

  const cells = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const startDay = (first.getDay() + 6) % 7; // lundi = 0
    const days = new Date(y, m, 0).getDate();
    const out: (string | null)[] = Array(startDay).fill(null);
    for (let d = 1; d <= days; d++) out.push(`${month}-${String(d).padStart(2, '0')}`);
    return out;
  }, [month]);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setSelected(null);
  };

  const sorted = [...posts].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));

  if (posts.length === 0) {
    return <div className="card p-10 text-center text-muted">{t('pilot.calEmpty')}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Performances cumulées, remontées automatiquement depuis les réseaux */}
      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">📊 {t('pilot.perf')}</h3>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface-hover disabled:opacity-40"
          >
            {refreshing ? '…' : `🔄 ${t('pilot.refreshStats')}`}
          </button>
        </div>
        {totals.measured === 0 ? (
          <p className="text-xs text-faint">{t('pilot.noStats')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['👁️', t('pilot.views'), totals.views],
              ['❤️', t('pilot.likes'), totals.likes],
              ['💬', t('pilot.comments'), totals.comments],
              ['🔁', t('pilot.shares'), totals.shares],
            ].map(([icon, label, val]) => (
              <div key={String(label)} className="rounded-xl bg-surface-2 p-3">
                <p className="text-xs text-muted">
                  {icon} {label}
                </p>
                <p className="mt-0.5 text-xl font-bold">{Number(val).toLocaleString('fr-FR')}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recyclage : reprendre ce qui a déjà bien fonctionné */}
      {top.length > 0 && <RecycleSection posts={top} onRecycle={onRecycle} />}

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button
            onClick={() => setView('grid')}
            className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${view === 'grid' ? 'border-brand-violet' : 'border-border text-muted'}`}
          >
            📅 {t('pilot.viewGrid')}
          </button>
          <button
            onClick={() => setView('list')}
            className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${view === 'list' ? 'border-brand-violet' : 'border-border text-muted'}`}
          >
            📋 {t('pilot.viewList')}
          </button>
        </div>
        {view === 'grid' && (
          <div className="flex items-center gap-2">
            <button onClick={() => shiftMonth(-1)} className="rounded-lg border border-border px-2 py-1 text-sm text-muted hover:bg-surface-hover">←</button>
            <span className="text-sm font-semibold">{month}</span>
            <button onClick={() => shiftMonth(1)} className="rounded-lg border border-border px-2 py-1 text-sm text-muted hover:bg-surface-hover">→</button>
          </div>
        )}
      </div>

      {view === 'grid' ? (
        <>
          <div className="grid grid-cols-7 gap-1.5">
            {t('pilot.days').split(',').map((d) => (
              <div key={d} className="pb-1 text-center text-xs text-faint">{d}</div>
            ))}
            {cells.map((dateStr, i) => {
              if (!dateStr) return <div key={`e${i}`} />;
              const dayPosts = byDate[dateStr] ?? [];
              const isToday = dateStr === todayISO();
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelected(dateStr === selected ? null : dateStr)}
                  className={`min-h-[56px] rounded-xl border p-1.5 text-left transition hover:border-brand-violet ${
                    selected === dateStr ? 'border-brand-violet bg-surface-2' : 'border-border'
                  } ${isToday ? 'ring-1 ring-brand-violet' : ''}`}
                >
                  <p className="text-xs">{Number(dateStr.slice(-2))}</p>
                  {dayPosts.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {dayPosts.slice(0, 4).map((p) => (
                        <span
                          key={p.id}
                          className={`h-1.5 w-1.5 rounded-full ${
                            p.status === 'PUBLISHED' ? 'bg-emerald-500' : p.status === 'FAILED' ? 'bg-red-400' : 'bg-yellow-500'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="space-y-3">
            {selected ? (
              (byDate[selected] ?? []).length === 0 ? (
                <p className="text-sm text-muted">{t('pilot.dayEmpty')}</p>
              ) : (
                byDate[selected].map((p) => <PostRow key={p.id} post={p} onChanged={onChanged} />)
              )
            ) : (
              <p className="text-sm text-faint">{t('pilot.pickDay')}</p>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {sorted.map((p) => <PostRow key={p.id} post={p} onChanged={onChanged} />)}
        </div>
      )}
    </div>
  );
}

function PostRow({ post: p, onChanged }: { post: ScheduledPostDto; onChanged: () => void }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(p.caption);
  const local = new Date(p.scheduledAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const [date, setDate] = useState(`${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`);
  const [time, setTime] = useState(`${pad(local.getHours())}:${pad(local.getMinutes())}`);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const editable = p.status === 'SCHEDULED' || p.status === 'FAILED' || p.status === 'CANCELLED';

  const cancel = async () => {
    await apiFetch(`/social/scheduled/${p.id}/cancel`, { method: 'POST' }).catch(() => undefined);
    onChanged();
  };
  const remove = async () => {
    if (!window.confirm(t('pilot.deleteConfirm'))) return;
    await apiFetch(`/social/scheduled/${p.id}`, { method: 'DELETE' }).catch(() => undefined);
    onChanged();
  };
  const save = async () => {
    if (!caption.trim()) return;
    setSaving(true);
    setErr('');
    try {
      await apiFetch(`/social/scheduled/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ caption: caption.trim(), scheduledAt: new Date(`${date}T${time}`).toISOString() }),
      });
      setEditing(false);
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="card space-y-3 p-4">
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} className="input w-full" />
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input w-auto" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input w-auto" />
          <span className="flex gap-1">
            {p.networks.map((n) => <NetBadge key={n} network={n} size={20} />)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={saving || !caption.trim()} className="btn-primary text-sm disabled:opacity-40">
            {saving ? '…' : `💾 ${t('pilot.save')}`}
          </button>
          <button
            onClick={() => { setEditing(false); setCaption(p.caption); }}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted transition hover:bg-surface-hover"
          >
            {t('common.cancel')}
          </button>
          {err && <span className="text-sm text-red-400">⚠️ {err}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="card flex items-center gap-4 p-4">
      {p.imageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={p.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
      ) : p.videoUrl ? (
        <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={`${p.videoUrl}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
          <span className="absolute -right-1 -top-1 rounded-full bg-black/70 px-1 text-[10px] leading-4">🎬</span>
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm">{p.caption}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-faint">
          <span className="flex gap-1">
            {p.networks.map((n) => <NetBadge key={n} network={n} size={20} />)}
          </span>
          · {new Date(p.scheduledAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
        {p.results && Object.keys(p.results).length > 0 && (
          <p className="mt-1.5 flex flex-wrap gap-1.5">
            {Object.entries(p.results).map(([net, r]) => (
              <span
                key={net}
                title={r.error ?? undefined}
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                  !r.ok ? 'bg-red-500/15 text-red-400' : r.simulated ? 'bg-surface-2 text-faint' : 'bg-emerald-500/15 text-emerald-500'
                }`}
              >
                {!r.ok ? '❌' : r.simulated ? '🟡' : '✅'} {net}
                {r.simulated ? ` ${t('pub.simulatedTag')}` : ''}
              </span>
            ))}
          </p>
        )}
        {p.lastError && (
          <p className="mt-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
            ⚠️ {p.lastError}
          </p>
        )}
        {/* Statistiques remontées par chaque réseau */}
        {(p.insights ?? []).map((i) => {
          const hasNumbers = i.views + i.likes + i.comments + i.shares > 0;
          return (
            <p key={i.network} className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-semibold text-muted">{i.network}</span>
              {hasNumbers ? (
                <>
                  <span title={t('pilot.views')}>👁️ {i.views.toLocaleString('fr-FR')}</span>
                  <span title={t('pilot.likes')}>❤️ {i.likes.toLocaleString('fr-FR')}</span>
                  <span title={t('pilot.comments')}>💬 {i.comments.toLocaleString('fr-FR')}</span>
                  <span title={t('pilot.shares')}>🔁 {i.shares.toLocaleString('fr-FR')}</span>
                </>
              ) : null}
              {i.error && (
                <span className="text-amber-500" title={i.error}>
                  ⚠️ {i.error.length > 70 ? `${i.error.slice(0, 70)}…` : i.error}
                </span>
              )}
            </p>
          );
        })}
      </div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[p.status] ?? ''}`}>
        {t(`ps.${p.status}`)}
      </span>
      {editable && (
        <button onClick={() => setEditing(true)} className="text-xs text-brand-violet hover:underline">
          {p.status === 'SCHEDULED' ? `✏️ ${t('pilot.edit')}` : `🔁 ${t('pilot.retry')}`}
        </button>
      )}
      {p.status === 'SCHEDULED' && (
        <button onClick={cancel} className="text-xs text-red-400 hover:text-red-300">{t('common.cancel')}</button>
      )}
      <button onClick={remove} title={t('pub.deletePost')} className="text-faint transition hover:text-red-400">🗑</button>
    </div>
  );
}

// ─────────────────────────────────────────────── Recyclage & rapport

/** Publications les plus performantes, à reprendre sous un angle neuf. */
function RecycleSection({ posts, onRecycle }: { posts: TopPostDto[]; onRecycle: (p: TopPostDto) => void }) {
  const t = useT();
  return (
    <div className="card p-4">
      <h3 className="text-sm font-bold">♻️ {t('pilot.recycleTitle')}</h3>
      <p className="mb-3 mt-0.5 text-xs text-muted">{t('pilot.recycleHint')}</p>
      <div className="space-y-2">
        {posts.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm">{p.caption}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-faint">
                <span className="flex gap-1">
                  {p.networks.map((n) => <NetBadge key={n} network={n} size={16} />)}
                </span>
                👁️ {p.views.toLocaleString('fr-FR')} · ❤️💬🔁 {p.interactions.toLocaleString('fr-FR')}
              </p>
            </div>
            <button
              onClick={() => onRecycle(p)}
              className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-brand-violet hover:text-content"
            >
              ✨ {t('pilot.recycleBtn')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Bilan mensuel : volumes, détail par réseau, meilleures publications. */
function ReportTab({ onRecycle }: { onRecycle: (p: TopPostDto) => void }) {
  const t = useT();
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [report, setReport] = useState<MonthlyReportDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<MonthlyReportDto>(`/social/report?month=${month}`)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [month]);

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      [t('pilot.network'), t('pilot.published'), t('pilot.views'), t('pilot.interactions')],
      ...report.byNetwork.map((n) => [n.network, n.published, n.views, n.interactions]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-social-${report.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const interactions = report ? report.likes + report.comments + report.shares : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input w-auto" />
        <button
          onClick={exportCsv}
          disabled={!report || report.byNetwork.length === 0}
          className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted transition hover:bg-surface-hover disabled:opacity-40"
        >
          ⬇️ {t('pilot.exportCsv')}
        </button>
      </div>

      {loading ? (
        <p className="p-6 text-center text-sm text-muted">…</p>
      ) : !report || report.published === 0 ? (
        <div className="card p-10 text-center text-muted">{t('pilot.reportEmpty')}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['📤', t('pilot.published'), report.published],
              ['👁️', t('pilot.views'), report.views],
              ['❤️', t('pilot.likes'), report.likes],
              ['💬', t('pilot.comments'), report.comments],
            ].map(([icon, label, val]) => (
              <div key={String(label)} className="card p-4">
                <p className="text-xs text-muted">
                  {icon} {label}
                </p>
                <p className="mt-0.5 text-xl font-bold">{Number(val).toLocaleString('fr-FR')}</p>
              </div>
            ))}
          </div>

          {report.interactionsChange !== null && (
            <div
              className={`rounded-xl border p-3 text-sm ${
                report.interactionsChange >= 0
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-600'
              }`}
            >
              {report.interactionsChange >= 0 ? '📈 ' : '📉 '}
              {t('pilot.vsPrevMonth')
                .replace('{pct}', `${report.interactionsChange > 0 ? '+' : ''}${report.interactionsChange}`)
                .replace('{n}', interactions.toLocaleString('fr-FR'))}
            </div>
          )}

          {report.byNetwork.length > 0 && (
            <div className="card overflow-x-auto p-4">
              <h3 className="mb-3 text-sm font-bold">{t('pilot.byNetwork')}</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="pb-2 pr-4">{t('pilot.network')}</th>
                    <th className="pb-2 pr-4">{t('pilot.published')}</th>
                    <th className="pb-2 pr-4">{t('pilot.views')}</th>
                    <th className="pb-2">{t('pilot.interactions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byNetwork.map((n) => (
                    <tr key={n.network} className="border-t border-border">
                      <td className="flex items-center gap-2 py-2 pr-4">
                        <NetBadge network={n.network} size={18} /> {n.network}
                      </td>
                      <td className="py-2 pr-4">{n.published}</td>
                      <td className="py-2 pr-4">{n.views.toLocaleString('fr-FR')}</td>
                      <td className="py-2">{n.interactions.toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report.topPosts.length > 0 && <RecycleSection posts={report.topPosts} onRecycle={onRecycle} />}
        </>
      )}
    </div>
  );
}
