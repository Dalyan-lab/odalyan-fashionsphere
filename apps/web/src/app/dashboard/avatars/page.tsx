'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AvatarSex, BodyType, SkinTone } from '@odalyan/shared';
import { apiFetch, uploadImage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { Topbar } from '@/components/dashboard/topbar';
import { Icon } from '@/components/dashboard/icons';

interface AvatarAsset {
  id: string;
  url?: string | null;
  provider: string;
  meta?: { sex?: string; bodyType?: string; skinTone?: string; hairstyle?: string | null } | null;
  createdAt: string;
}

export default function AvatarsPage() {
  const t = useT();
  const [avatars, setAvatars] = useState<AvatarAsset[]>([]);
  const [noShop, setNoShop] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setAvatars(await apiFetch<AvatarAsset[]>('/ai/assets?type=AVATAR'));
      setNoShop(false);
    } catch {
      setNoShop(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Topbar />
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-violet-magenta text-white">
            {Icon.avatars({})}
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">{t('dash.nav.avatars')}</h1>
            <p className="text-muted">{t('av.subtitle')}</p>
          </div>
        </div>

        {noShop ? (
          <div className="card mt-6 p-10 text-center text-muted">
            {t('common.mustCreateShop')}
            <Link href="/dashboard" className="btn-primary mx-auto mt-4 block w-fit">{t('dh.createShop')}</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
            <AvatarCreator onCreated={load} />

            <div>
              <h2 className="mb-3 text-lg font-bold">{t('av.mine')} ({avatars.length})</h2>
              {loading ? (
                <p className="text-muted">{t('common.loading')}</p>
              ) : avatars.length === 0 ? (
                <div className="card p-10 text-center text-muted">
                  {t('av.empty')}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {avatars.map((a) => (
                    <div key={a.id} className="card overflow-hidden">
                      {a.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.url} alt="Avatar" className="aspect-[3/4] w-full object-cover" />
                      )}
                      <div className="p-2">
                        <p className="text-xs font-medium">
                          {a.meta?.sex} · {a.meta?.bodyType}
                        </p>
                        <p className="text-[10px] text-faint">
                          {t('tryon.skinTone')} {a.meta?.skinTone}
                          {a.meta?.hairstyle ? ` · ${a.meta.hairstyle}` : ''}
                        </p>
                        <p className="mt-0.5 text-[10px] text-faint">
                          {a.provider === 'mock' ? t('common.simulated') : `✨ ${a.provider}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Modules liés (phases suivantes) */}
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <Link href="/dashboard/tryon" className="card p-4 transition hover:border-brand-violet">
                  <p className="text-sm font-semibold">👗 {t('dash.nav.tryon')}</p>
                  <p className="mt-1 text-xs text-muted">{t('av.tryonDesc')}</p>
                  <p className="mt-2 text-[10px] text-brand-violet">{t('av.openTryon')}</p>
                </Link>
                <Link href="/dashboard/showroom" className="card p-4 transition hover:border-brand-violet">
                  <p className="text-sm font-semibold">{t('av.avatar3d')}</p>
                  <p className="mt-1 text-xs text-muted">{t('av.avatar3dDesc')}</p>
                  <p className="mt-2 text-[10px] text-brand-violet">{t('av.openShowroom')}</p>
                </Link>
                <div className="card p-4 opacity-70">
                  <p className="text-sm font-semibold">{t('av.influencer')}</p>
                  <p className="mt-1 text-xs text-muted">{t('av.influencerDesc')}</p>
                  <p className="mt-2 text-[10px] text-faint">🔒 Phase 4</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function AvatarCreator({ onCreated }: { onCreated: () => void }) {
  const t = useT();
  const [mode, setMode] = useState<'manual' | 'photo'>('manual');
  const [form, setForm] = useState({
    sex: AvatarSex.FEMME as AvatarSex,
    bodyType: BodyType.NORMALE as BodyType,
    skinTone: SkinTone.METISSE as SkinTone,
    hairstyle: '',
    prompt: '',
  });
  const [sourceUrl, setSourceUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<AvatarAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      setSourceUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('av.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const generate = async () => {
    if (mode === 'photo' && !sourceUrl) {
      setError(t('av.uploadFirst'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const asset = await apiFetch<AvatarAsset>('/ai/avatar', {
        method: 'POST',
        body: JSON.stringify({
          sex: form.sex,
          bodyType: form.bodyType,
          skinTone: form.skinTone,
          hairstyle: form.hairstyle || undefined,
          prompt: form.prompt || undefined,
          sourceImageUrl: mode === 'photo' ? sourceUrl : undefined,
        }),
      });
      setResult(asset);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card h-fit space-y-4 p-5">
      <h2 className="font-bold">{t('av.create')}</h2>

      <div className="flex gap-2 rounded-xl bg-surface-2 p-1">
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${mode === 'manual' ? 'bg-brand-violet-magenta text-white' : 'text-muted'}`}
        >
          {t('av.manual')}
        </button>
        <button
          onClick={() => setMode('photo')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${mode === 'photo' ? 'bg-brand-violet-magenta text-white' : 'text-muted'}`}
        >
          {t('av.fromPhoto')}
        </button>
      </div>

      {mode === 'photo' && (
        <div>
          <label className="label">{t('av.yourPhoto')}</label>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 p-5 text-center transition hover:border-brand-violet">
            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
            {uploading ? (
              <span className="text-sm text-muted">Upload…</span>
            ) : sourceUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sourceUrl} alt="Source" className="h-32 w-auto rounded-lg object-cover" />
            ) : (
              <>
                <span className="text-2xl">📤</span>
                <span className="text-sm text-muted">{t('av.uploadHint')}</span>
                <span className="text-[10px] text-faint">{t('av.uploadSpec')}</span>
              </>
            )}
          </label>
          <p className="mt-1 text-[10px] text-faint">{t('av.photoNote')}</p>
        </div>
      )}

      <Select label={t('av.sex')} value={form.sex} onChange={(v) => setForm({ ...form, sex: v as AvatarSex })} options={Object.values(AvatarSex)} />
      <Select label={t('av.bodyType')} value={form.bodyType} onChange={(v) => setForm({ ...form, bodyType: v as BodyType })} options={Object.values(BodyType)} />
      <Select label={t('tryon.skinTone')} value={form.skinTone} onChange={(v) => setForm({ ...form, skinTone: v as SkinTone })} options={Object.values(SkinTone)} />

      <div>
        <label className="label">{t('av.hairstyle')}</label>
        <input className="input" value={form.hairstyle} onChange={(e) => setForm({ ...form, hairstyle: e.target.value })} placeholder={t('av.hairstylePh')} />
      </div>
      <div>
        <label className="label">{t('av.details')}</label>
        <textarea className="input min-h-[60px]" value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} placeholder={t('av.detailsPh')} />
      </div>

      {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}

      <button onClick={generate} disabled={loading || uploading} className="btn-primary w-full">
        {loading ? t('common.generating') : <>{Icon.sparkles({ width: 16, height: 16 })} {t('av.generate')}</>}
      </button>

      {result?.url && (
        <div className="overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.url} alt="Avatar généré" className="aspect-[3/4] w-full object-cover" />
          <p className="px-2 py-1 text-[10px] text-faint">
            {result.provider === 'mock' ? t('common.simulated') : `✨ ${result.provider}`}
          </p>
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
