'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AvatarSex, SkinTone, type TryOnResult, type TryOnView } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Product } from '@/lib/types';
import { Topbar } from '@/components/dashboard/topbar';
import { Icon } from '@/components/dashboard/icons';

const SPEEDS = [
  { key: 'defile.slow', ms: 2600 },
  { key: 'defile.normal', ms: 1700 },
  { key: 'defile.fast', ms: 1000 },
];

export default function DefilePage() {
  const t = useT();
  const [products, setProducts] = useState<Product[]>([]);
  const [noShop, setNoShop] = useState(false);
  const [productId, setProductId] = useState('');
  const [avatarSex, setAvatarSex] = useState<AvatarSex>(AvatarSex.FEMME);
  const [skinTone, setSkinTone] = useState<SkinTone>(SkinTone.METISSE);

  const [views, setViews] = useState<TryOnView[]>([]);
  const [productName, setProductName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Lecteur d'animation
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(SPEEDS[1]!.ms);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    apiFetch<Product[]>('/products/mine')
      .then((p) => {
        const withImg = p.filter((x) => x.images[0]);
        setProducts(withImg);
        if (withImg[0]) setProductId(withImg[0].id);
      })
      .catch(() => setNoShop(true));
  }, []);

  // Boucle d'animation du défilé
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (!playing || views.length === 0) return;
    timer.current = setInterval(() => setIdx((i) => (i + 1) % views.length), speed);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, views, speed]);

  const generate = async () => {
    if (!productId) {
      setError(t('tryon.selectProduct'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<TryOnResult>('/ai/tryon', {
        method: 'POST',
        body: JSON.stringify({ productId, avatarSex, skinTone }),
      });
      setViews(res.views);
      setProductName(res.productName);
      setIdx(0);
      setPlaying(true);
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
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-violet-magenta text-white">🎬</span>
          <div>
            <h1 className="font-display text-3xl font-bold">{t('dash.nav.defile')}</h1>
            <p className="text-muted">{t('defile.subtitle')}</p>
          </div>
        </div>

        {noShop ? (
          <div className="card mt-6 p-10 text-center text-muted">
            {t('common.mustCreateShop')}
            <Link href="/dashboard" className="btn-primary mx-auto mt-4 block w-fit">{t('dh.createShop')}</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* Scène podium */}
            <div className="card relative flex h-[600px] items-center justify-center overflow-hidden bg-black">
              {/* fond podium */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.35),transparent_55%),radial-gradient(circle_at_50%_100%,rgba(232,82,122,0.25),transparent_55%)]" />

              {views.length === 0 ? (
                <div className="relative z-10 text-center text-muted">
                  <p className="text-5xl">🎬</p>
                  <p className="mt-3">{t('defile.emptyHint')}</p>
                </div>
              ) : (
                <>
                  {views.map((v, i) => (
                    <img
                      key={i}
                      // eslint-disable-next-line @next/next/no-img-element
                      src={v.url}
                      alt={v.angle}
                      className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-700 ${
                        i === idx ? 'z-10 opacity-100' : 'z-0 opacity-0'
                      } ${i === idx && playing ? 'animate-kenburns' : ''}`}
                    />
                  ))}
                  {/* sol / reflet podium */}
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 h-24 bg-gradient-to-t from-black to-transparent" />
                  {/* libellé d'angle */}
                  <div className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-sm text-white backdrop-blur">
                    {playing && <span className="h-2 w-2 animate-pulse rounded-full bg-brand-magenta" />}
                    {productName} · {views[idx]?.angle}
                  </div>
                </>
              )}

              {/* Lecteur */}
              {views.length > 0 && (
                <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/15 bg-black/60 px-3 py-2 backdrop-blur">
                  <button
                    onClick={() => setPlaying((p) => !p)}
                    className="grid h-9 w-9 place-items-center rounded-full bg-brand-violet-magenta text-white"
                  >
                    {playing ? '❚❚' : Icon.play({ width: 14, height: 14 })}
                  </button>
                  <div className="flex gap-1">
                    {views.map((_, i) => (
                      <span key={i} className={`h-1.5 w-6 rounded-full transition ${i === idx ? 'bg-brand-violet-magenta' : 'bg-white/20'}`} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Contrôles */}
            <div className="space-y-5">
              <div className="card p-5">
                <h2 className="mb-3 font-bold">{t('defile.staging')}</h2>
                <label className="label">{t('common.product')}</label>
                {products.length === 0 ? (
                  <p className="text-sm text-muted">{t('common.noProducts')} <Link href="/dashboard/products" className="text-brand-violet hover:underline">{t('common.addOne')}</Link>.</p>
                ) : (
                  <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
                <label className="label mt-3">{t('tryon.mannequin')}</label>
                <select className="input" value={avatarSex} onChange={(e) => setAvatarSex(e.target.value as AvatarSex)}>
                  {Object.values(AvatarSex).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <label className="label mt-3">{t('tryon.skinTone')}</label>
                <select className="input" value={skinTone} onChange={(e) => setSkinTone(e.target.value as SkinTone)}>
                  {Object.values(SkinTone).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                {error && <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}

                <button onClick={generate} disabled={loading || products.length === 0} className="btn-primary mt-4 w-full">
                  {loading ? t('defile.generating') : <>{Icon.sparkles({ width: 16, height: 16 })} {t('dh.runway.launch')}</>}
                </button>
              </div>

              {views.length > 0 && (
                <div className="card p-5">
                  <h2 className="mb-3 font-bold">{t('defile.speed')}</h2>
                  <div className="grid grid-cols-3 gap-2">
                    {SPEEDS.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setSpeed(s.ms)}
                        className={`rounded-xl border py-2 text-sm transition ${speed === s.ms ? 'border-brand-violet bg-surface-2' : 'border-border text-muted'}`}
                      >
                        {t(s.key)}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-faint">{t('defile.note')}</p>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </>
  );
}
