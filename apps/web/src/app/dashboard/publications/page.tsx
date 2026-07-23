'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ScheduledPostDto, SocialConnectionInfo, SocialNetworkStatus } from '@odalyan/shared';
import { apiFetch, uploadFile } from '@/lib/api';
import { useT } from '@/lib/i18n';
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
  PARTIAL: 'bg-amber-500/15 text-amber-500',
  FAILED: 'bg-red-500/15 text-red-400',
  CANCELLED: 'bg-surface-2 text-faint',
};
export default function PublicationsPage() {
  const t = useT();
  const [connections, setConnections] = useState<SocialConnectionInfo[]>([]);
  const [networks, setNetworks] = useState<SocialNetworkStatus[]>([]);
  const [posts, setPosts] = useState<ScheduledPostDto[]>([]);
  const [noShop, setNoShop] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = () => {
    apiFetch<SocialConnectionInfo[]>('/social/connections').then(setConnections).catch(() => setNoShop(true));
    apiFetch<SocialNetworkStatus[]>('/social/networks').then(setNetworks).catch(() => setNetworks([]));
    apiFetch<ScheduledPostDto[]>('/social/scheduled').then(setPosts).catch(() => undefined);
  };

  useEffect(() => {
    load();
    // Retour du réseau après autorisation OAuth
    const q = new URLSearchParams(window.location.search);
    const social = q.get('social');
    if (social === 'connected') setNotice({ kind: 'ok', text: t('pub.connectedOk').replace('{n}', q.get('network') ?? '') });
    else if (social === 'error') setNotice({ kind: 'err', text: q.get('message') ?? t('common.error') });
    else if (social === 'cancelled') setNotice({ kind: 'err', text: t('pub.cancelled') });
    if (social) window.history.replaceState({}, '', window.location.pathname);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const netStatus = (network: string) => networks.find((n) => n.network === network);

  const toggle = async (network: string, connected: boolean) => {
    setBusy(network);
    setNotice(null);
    try {
      if (connected) {
        await apiFetch(`/social/disconnect/${network}`, { method: 'POST' });
        load();
        return;
      }
      const res = await apiFetch<{ authorizeUrl: string | null; simulated: boolean }>(
        `/social/connect/${network}`,
        { method: 'POST' },
      );
      // Vraie connexion → redirection vers le réseau ; sinon connexion simulée
      if (res.authorizeUrl) {
        window.location.href = res.authorizeUrl;
        return;
      }
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
            <h1 className="font-display text-3xl font-bold">{t('dash.nav.publications')}</h1>
            <p className="text-muted">{t('pub.subtitle')}</p>
          </div>
          <span className="ml-3 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-bold text-brand-violet">
            Phase 5
          </span>
        </div>

        {noShop ? (
          <div className="card mt-6 p-10 text-center text-muted">
            {t('common.mustCreateShop')}
            <Link href="/dashboard" className="btn-primary mx-auto mt-4 block w-fit">{t('dh.createShop')}</Link>
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {notice && (
              <div
                className={`rounded-xl border p-3 text-sm ${
                  notice.kind === 'ok'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                    : 'border-brand-magenta/40 bg-brand-magenta/10 text-brand-magenta'
                }`}
              >
                {notice.kind === 'ok' ? '✅ ' : '⚠️ '}
                {notice.text}
              </div>
            )}

            {/* Connexions */}
            <section>
              <h2 className="mb-3 text-lg font-bold">{t('pub.connected')}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {connections.map((c) => {
                  const st = netStatus(c.network);
                  const mode = st?.enabled ? 'real' : st?.supported ? 'needsApp' : 'soon';
                  return (
                    <div key={c.network} className="card flex items-center gap-3 p-4">
                      <NetBadge network={c.network} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 font-medium">
                          {c.network}
                          <span
                            title={st?.requirement}
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                              mode === 'real'
                                ? 'bg-emerald-500/15 text-emerald-500'
                                : mode === 'needsApp'
                                  ? 'bg-amber-500/15 text-amber-500'
                                  : 'bg-surface-2 text-faint'
                            }`}
                          >
                            {mode === 'real' ? t('pub.modeReal') : mode === 'needsApp' ? t('pub.modeNeedsApp') : t('common.soon')}
                          </span>
                        </p>
                        <p className="truncate text-xs text-faint">
                          {c.connected ? c.accountName : t('pub.notConnected')}
                        </p>
                      </div>
                      <button
                        onClick={() => toggle(c.network, c.connected)}
                        disabled={busy === c.network}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          c.connected ? 'border border-border text-muted hover:bg-surface-hover' : 'bg-brand-violet-magenta text-white'
                        }`}
                      >
                        {busy === c.network ? '…' : c.connected ? t('pub.disconnect') : t('pub.connect')}
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] text-faint">{t('pub.simNote')}</p>
            </section>

            {/* Importer et publier une vidéo directement */}
            <PublishVideoPanel connections={connections} onDone={load} />

            {/* Publications programmées */}
            <section>
              <h2 className="mb-3 text-lg font-bold">{t('dash.nav.publications')} ({posts.length})</h2>
              {posts.length === 0 ? (
                <div className="card p-10 text-center text-muted">
                  {t('pub.empty')}{' '}
                  <Link href="/dashboard/campaigns" className="text-brand-violet hover:underline">{t('dash.nav.campaigns')}</Link>.
                </div>
              ) : (
                <div className="space-y-3">
                  {posts.map((p) => (
                    <div key={p.id} className="card flex items-center gap-4 p-4">
                      {p.imageUrl && (
                        <span className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
                          {p.videoUrl && (
                            <span className="absolute -right-1 -top-1 rounded-full bg-black/70 px-1 text-[10px] leading-4">🎬</span>
                          )}
                        </span>
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
                        {p.results && Object.keys(p.results).length > 0 && (
                          <p className="mt-1.5 flex flex-wrap gap-1.5">
                            {Object.entries(p.results).map(([net, r]) => (
                              <span
                                key={net}
                                title={r.error ?? undefined}
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                  !r.ok
                                    ? 'bg-red-500/15 text-red-400'
                                    : r.simulated
                                      ? 'bg-surface-2 text-faint'
                                      : 'bg-emerald-500/15 text-emerald-500'
                                }`}
                              >
                                {!r.ok ? '❌' : r.simulated ? '🟡' : '✅'} {net}
                                {r.simulated ? ` ${t('pub.simulatedTag')}` : ''}
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[p.status]}`}>
                        {t(`ps.${p.status}`)}
                      </span>
                      {p.status === 'SCHEDULED' && (
                        <button onClick={() => cancel(p.id)} className="text-xs text-red-400 hover:text-red-300">
                          {t('common.cancel')}
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

/**
 * Importe une vidéo (fichier .mp4/.mov) vers le stockage, puis la publie sur les
 * réseaux connectés. Permet de publier une vraie vidéo sans passer par la génération IA.
 */
function PublishVideoPanel({
  connections,
  onDone,
}: {
  connections: SocialConnectionInfo[];
  onDone: () => void;
}) {
  const t = useT();
  const connected = connections.filter((c) => c.connected);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [caption, setCaption] = useState('');
  const [nets, setNets] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const toggleNet = (n: string) => setNets((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setMsg(null);
    setUploading(true);
    try {
      const { url } = await uploadFile(file);
      setVideoUrl(url);
      setFileName(file.name);
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : t('common.error') });
    } finally {
      setUploading(false);
    }
  };

  const publish = async () => {
    if (!videoUrl || nets.length === 0) return;
    setPublishing(true);
    setMsg(null);
    try {
      await apiFetch('/social/schedule', {
        method: 'POST',
        body: JSON.stringify({ caption: caption || ' ', videoUrl, networks: nets }),
      });
      setMsg({ kind: 'ok', text: t('pub.videoPublished') });
      setVideoUrl(null);
      setFileName('');
      setCaption('');
      setNets([]);
      onDone();
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : t('common.error') });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <section>
      <h2 className="mb-1 text-lg font-bold">🎬 {t('pub.videoTitle')}</h2>
      <p className="mb-3 text-xs text-muted">{t('pub.videoDesc')}</p>
      <div className="card space-y-4 p-5">
        {/* Choix du fichier */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="btn-primary cursor-pointer">
            {uploading ? t('pub.uploading') : t('pub.chooseVideo')}
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              disabled={uploading}
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </label>
          {videoUrl && <span className="truncate text-xs text-emerald-500">✓ {fileName}</span>}
        </div>

        {videoUrl && (
          <video src={videoUrl} controls className="max-h-64 w-full rounded-xl border border-border" />
        )}

        {/* Légende */}
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={t('pub.captionPlaceholder')}
          rows={2}
          className="input w-full"
        />

        {/* Réseaux connectés */}
        {connected.length === 0 ? (
          <p className="text-xs text-faint">{t('pub.noConnected')}</p>
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

        <div className="flex items-center gap-3">
          <button
            onClick={publish}
            disabled={!videoUrl || nets.length === 0 || publishing}
            className="btn-primary disabled:opacity-40"
          >
            {publishing ? '…' : t('pub.publishNow')}
          </button>
          {msg && (
            <span className={`text-sm ${msg.kind === 'ok' ? 'text-emerald-500' : 'text-red-400'}`}>
              {msg.kind === 'ok' ? '✅ ' : '⚠️ '}
              {msg.text}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
