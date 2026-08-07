'use client';

import { useCallback, useEffect, useState } from 'react';
import type { VideoAsset } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { AttachToProduct } from './attach-to-product';
import { VoiceoverButton } from './voiceover-button';

/** Compteur écoulé (mm:ss) affiché pendant une génération longue (vidéo). */
export function GenTimer() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setS((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, []);
  const mm = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return (
    <span className="tabular-nums">
      {mm}:{ss}
    </span>
  );
}

/**
 * Galerie des vidéos générées, PERSISTÉE (rechargée du serveur) — elle ne
 * disparaît plus en changeant de page. Chaque vidéo peut être attachée à un
 * produit (puis publiée) ou téléchargée.
 */
export function VideoGallery({ productId, refreshKey }: { productId?: string; refreshKey?: number }) {
  const t = useT();
  const [videos, setVideos] = useState<VideoAsset[]>([]);

  const load = useCallback(() => {
    const q = productId ? `?productId=${productId}` : '';
    apiFetch<VideoAsset[]>(`/ai/videos${q}`)
      .then(setVideos)
      .catch(() => undefined);
  }, [productId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const ready = videos.filter((v) => v.status === 'READY' && v.url);
  if (ready.length === 0) return null;

  return (
    <div className="card p-5">
      <h2 className="mb-3 font-bold">🎞️ {t('vid.myVideos')} ({ready.length})</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {ready.map((v) => (
          <div key={v.id} className="card overflow-hidden">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={v.url!} controls playsInline className="aspect-video w-full bg-black" />
            <div className="space-y-1.5 p-2">
              <p className="text-[10px] text-faint">
                {v.provider === 'mock' ? t('common.simulated') : `✨ ${v.provider}`} ·{' '}
                {new Date(v.createdAt).toLocaleDateString('fr-FR')}
              </p>
              {(() => {
                const m = v.meta as { hasVoiceover?: boolean; hasMusic?: boolean } | null;
                if (!m?.hasVoiceover && !m?.hasMusic) return null;
                return (
                  <p className="text-center text-[10px] font-medium text-emerald-400">
                    {m?.hasVoiceover ? `🎙️ ${t('vo.badge')}` : ''}
                    {m?.hasMusic ? ' 🎵' : ''}
                  </p>
                );
              })()}
              <AttachToProduct url={v.url!} kind="video" />
              <VoiceoverButton videoId={v.id} onDone={load} />
              <a
                href={v.url!}
                download
                target="_blank"
                rel="noreferrer"
                className="block text-center text-[11px] text-brand-violet hover:underline"
              >
                ⬇️ {t('vid.download')}
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
