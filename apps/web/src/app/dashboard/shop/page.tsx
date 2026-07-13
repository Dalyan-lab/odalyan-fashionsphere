'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Shop } from '@/lib/types';
import { Topbar } from '@/components/dashboard/topbar';
import { ImageUploadInput } from '@/components/dashboard/image-upload-input';

const PREVIEW_LOGO_POS: Record<string, string> = {
  'top-left': 'left-3 top-3',
  'top-right': 'right-3 top-3',
  'bottom-left': 'left-3 bottom-3',
  'bottom-right': 'right-3 bottom-3',
};

export default function ShopSettingsPage() {
  const t = useT();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    slogan: '',
    description: '',
    primaryColor: '#7c3aed',
    secondaryColor: '#e8527a',
    logoUrl: '',
    bannerUrl: '',
    showNameOnBanner: true,
    showSloganOnBanner: true,
    logoPosition: 'top-left',
    bannerPosition: 'center',
  });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Shop | null>('/shops/me')
      .then((s) => {
        setShop(s ?? null);
        if (s)
          setForm({
            name: s.name ?? '',
            slogan: s.slogan ?? '',
            description: s.description ?? '',
            primaryColor: s.primaryColor ?? '#7c3aed',
            secondaryColor: s.secondaryColor ?? '#e8527a',
            logoUrl: s.logoUrl ?? '',
            bannerUrl: s.bannerUrl ?? '',
            showNameOnBanner: s.showNameOnBanner !== false,
            showSloganOnBanner: s.showSloganOnBanner !== false,
            logoPosition: s.logoPosition ?? 'top-left',
            bannerPosition: s.bannerPosition ?? 'center',
          });
      })
      .catch(() => setShop(null))
      .finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setSaving(true);
    try {
      // n'envoyer que les champs renseignés
      const payload: Record<string, string | boolean> = { name: form.name };
      if (form.slogan) payload.slogan = form.slogan;
      if (form.description) payload.description = form.description;
      if (form.logoUrl) payload.logoUrl = form.logoUrl;
      if (form.bannerUrl) payload.bannerUrl = form.bannerUrl;
      payload.primaryColor = form.primaryColor;
      payload.secondaryColor = form.secondaryColor;
      payload.showNameOnBanner = form.showNameOnBanner;
      payload.showSloganOnBanner = form.showSloganOnBanner;
      payload.logoPosition = form.logoPosition;
      payload.bannerPosition = form.bannerPosition;
      await apiFetch('/shops/me', { method: 'PATCH', body: JSON.stringify(payload) });
      setMsg(t('shop.updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <>
        <Topbar />
        <p className="p-6 text-muted">{t('common.loading')}</p>
      </>
    );

  if (!shop)
    return (
      <>
        <Topbar />
        <div className="card m-6 p-10 text-center text-muted">
          {t('common.mustCreateShop')}
          <Link href="/dashboard" className="btn-primary mx-auto mt-4 block w-fit">{t('dh.createShop')}</Link>
        </div>
      </>
    );

  return (
    <>
      <Topbar userInitial={shop.name.charAt(0).toUpperCase()} />
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">{t('shop.title')}</h1>
            <p className="text-muted">{t('shop.subtitle')}</p>
          </div>
          <Link href={`/shop/${shop.slug}`} className="btn-ghost text-sm">{t('shop.viewStorefront')}</Link>
        </div>

        <form onSubmit={save} className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="card space-y-4 p-6">
            <h2 className="font-bold">{t('shop.identity')}</h2>
            <div>
              <label className="label">{t('dh.brandName')}</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">{t('dh.slogan')}</label>
              <input className="input" value={form.slogan} onChange={(e) => setForm({ ...form, slogan: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('shop.description')}</label>
              <textarea className="input min-h-[90px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{t('shop.primaryColor')}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="h-10 w-12 rounded-lg border border-border bg-transparent" />
                  <input className="input" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">{t('shop.secondaryColor')}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} className="h-10 w-12 rounded-lg border border-border bg-transparent" />
                  <input className="input" value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          <div className="card space-y-4 p-6">
            <h2 className="font-bold">{t('shop.visuals')}</h2>
            <ImageUploadInput label={t('shop.logo')} value={form.logoUrl} onChange={(url) => setForm({ ...form, logoUrl: url })} />
            <ImageUploadInput label={t('shop.banner')} value={form.bannerUrl} onChange={(url) => setForm({ ...form, bannerUrl: url })} />

            {/* Interrupteurs d'affichage (évite le doublon avec une bannière déjà brandée) */}
            <div className="rounded-xl border border-border p-3">
              <p className="text-sm font-semibold">{t('shop.overlay')}</p>
              <p className="mb-2 mt-0.5 text-xs text-faint">{t('shop.overlayHint')}</p>
              <label className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={form.showNameOnBanner}
                  onChange={(e) => setForm({ ...form, showNameOnBanner: e.target.checked })}
                  className="h-4 w-4 accent-brand-violet"
                />
                {t('shop.showName')}
              </label>
              <label className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={form.showSloganOnBanner}
                  onChange={(e) => setForm({ ...form, showSloganOnBanner: e.target.checked })}
                  className="h-4 w-4 accent-brand-violet"
                />
                {t('shop.showSlogan')}
              </label>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('shop.logoPos')}</label>
                  <select className="input" value={form.logoPosition} onChange={(e) => setForm({ ...form, logoPosition: e.target.value })}>
                    <option value="top-left">{t('shop.pos.top-left')}</option>
                    <option value="top-right">{t('shop.pos.top-right')}</option>
                    <option value="bottom-left">{t('shop.pos.bottom-left')}</option>
                    <option value="bottom-right">{t('shop.pos.bottom-right')}</option>
                  </select>
                </div>
                <div>
                  <label className="label">{t('shop.bannerFraming')}</label>
                  <select className="input" value={form.bannerPosition} onChange={(e) => setForm({ ...form, bannerPosition: e.target.value })}>
                    <option value="top">{t('shop.frame.top')}</option>
                    <option value="center">{t('shop.frame.center')}</option>
                    <option value="bottom">{t('shop.frame.bottom')}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Aperçu — reflète exactement la vitrine */}
            <div className="overflow-hidden rounded-xl border border-border">
              <div
                className="relative flex h-32 flex-col items-center justify-center p-3 text-center"
                style={
                  form.bannerUrl
                    ? { backgroundImage: `url(${form.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: `center ${form.bannerPosition}` }
                    : { background: `linear-gradient(135deg, ${form.primaryColor}, ${form.secondaryColor})` }
                }
              >
                {form.bannerUrl && (form.showNameOnBanner || form.showSloganOnBanner) && (
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
                )}
                {form.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.logoUrl}
                    alt=""
                    className={form.bannerUrl ? `absolute z-20 h-11 w-11 rounded-full border-2 border-white object-cover ${PREVIEW_LOGO_POS[form.logoPosition] ?? 'left-3 top-3'}` : 'mb-1 h-12 w-12 rounded-full border-2 border-white object-cover'}
                  />
                )}
                <div className="relative z-10">
                  {form.showNameOnBanner && (
                    <p className="font-display text-lg font-bold drop-shadow" style={{ color: form.bannerUrl ? '#fff' : '#fff' }}>
                      {form.name || t('shop.myBrand')}
                    </p>
                  )}
                  {form.showSloganOnBanner && (
                    <p className="text-xs text-white/90 drop-shadow">{form.slogan || t('shop.yourSlogan')}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {error && <p className="mb-3 rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-400">{error}</p>}
            {msg && <p className="mb-3 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm text-emerald-500">{msg}</p>}
            <button className="btn-primary" disabled={saving}>{saving ? t('common.saving') : t('common.save')}</button>
          </div>
        </form>
      </div>
    </>
  );
}
