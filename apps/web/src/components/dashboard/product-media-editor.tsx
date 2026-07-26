'use client';

import { useState } from 'react';
import { apiFetch, uploadFile } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Product } from '@/lib/types';

/**
 * Éditeur des médias d'un produit : le vendeur attache ses rendus mannequin IA
 * et ses vidéos. Ils s'affichent ensuite dans la galerie de la fiche produit
 * vue par les clients (PATCH /products/:id { images, videos }).
 */
export function ProductMediaEditor({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const t = useT();
  const [images, setImages] = useState<string[]>(product.images ?? []);
  const [videos, setVideos] = useState<string[]>(product.videos ?? []);
  const [urlImg, setUrlImg] = useState('');
  const [urlVid, setUrlVid] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const upload = async (file: File | undefined, kind: 'img' | 'vid') => {
    if (!file) return;
    setBusy(kind);
    setMsg(null);
    try {
      const { url } = await uploadFile(file);
      if (kind === 'img') setImages((a) => [...a, url]);
      else setVideos((a) => [...a, url]);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : t('common.error') });
    } finally {
      setBusy('');
    }
  };

  const save = async () => {
    setBusy('save');
    setMsg(null);
    try {
      await apiFetch(`/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ images, videos }),
      });
      setMsg({ ok: true, text: t('prod.mediaSaved') });
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : t('common.error') });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="mt-3 space-y-4 rounded-xl border border-border bg-surface-2/40 p-4">
      <p className="text-xs text-muted">{t('prod.mediaHint')}</p>

      {/* Images */}
      <div>
        <p className="label">{t('prod.images')} ({images.length})</p>
        <div className="flex flex-wrap gap-2">
          {images.map((url, i) => (
            <span key={url + i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => setImages((a) => a.filter((_, j) => j !== i))}
                className="absolute right-0 top-0 bg-black/70 px-1 text-[10px] text-white"
              >
                ✕
              </button>
            </span>
          ))}
          <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-lg border border-dashed border-border text-xs text-faint hover:text-brand-violet">
            {busy === 'img' ? '…' : t('prod.addImage')}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0], 'img')} />
          </label>
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={urlImg}
            onChange={(e) => setUrlImg(e.target.value)}
            placeholder={t('prod.orPasteUrl')}
            className="input flex-1 text-xs"
          />
          <button
            onClick={() => { if (urlImg.trim()) { setImages((a) => [...a, urlImg.trim()]); setUrlImg(''); } }}
            className="btn-ghost text-xs"
          >
            {t('common.add')}
          </button>
        </div>
      </div>

      {/* Vidéos */}
      <div>
        <p className="label">{t('prod.videos')} ({videos.length})</p>
        <div className="flex flex-wrap gap-2">
          {videos.map((url, i) => (
            <span key={url + i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={`${url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm">▶️</span>
              <button
                onClick={() => setVideos((a) => a.filter((_, j) => j !== i))}
                className="absolute right-0 top-0 bg-black/70 px-1 text-[10px] text-white"
              >
                ✕
              </button>
            </span>
          ))}
          <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-lg border border-dashed border-border text-xs text-faint hover:text-brand-violet">
            {busy === 'vid' ? '…' : t('prod.addVideo')}
            <input type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={(e) => upload(e.target.files?.[0], 'vid')} />
          </label>
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={urlVid}
            onChange={(e) => setUrlVid(e.target.value)}
            placeholder={t('prod.orPasteUrl')}
            className="input flex-1 text-xs"
          />
          <button
            onClick={() => { if (urlVid.trim()) { setVideos((a) => [...a, urlVid.trim()]); setUrlVid(''); } }}
            className="btn-ghost text-xs"
          >
            {t('common.add')}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy === 'save'} className="btn-primary text-sm">
          {busy === 'save' ? '…' : t('common.save')}
        </button>
        {msg && <span className={`text-xs ${msg.ok ? 'text-emerald-500' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
