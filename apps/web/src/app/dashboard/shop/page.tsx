'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Shop } from '@/lib/types';
import { Topbar } from '@/components/dashboard/topbar';
import { ImageUploadInput } from '@/components/dashboard/image-upload-input';

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
      const payload: Record<string, string> = { name: form.name };
      if (form.slogan) payload.slogan = form.slogan;
      if (form.description) payload.description = form.description;
      if (form.logoUrl) payload.logoUrl = form.logoUrl;
      if (form.bannerUrl) payload.bannerUrl = form.bannerUrl;
      payload.primaryColor = form.primaryColor;
      payload.secondaryColor = form.secondaryColor;
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
            {/* Aperçu */}
            <div className="overflow-hidden rounded-xl border border-border">
              <div
                className="flex h-28 items-end p-3"
                style={{
                  background: form.bannerUrl
                    ? `url(${form.bannerUrl}) center/cover`
                    : `linear-gradient(135deg, ${form.primaryColor}, ${form.secondaryColor})`,
                }}
              >
                {form.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logoUrl} alt="" className="h-12 w-12 rounded-full border-2 border-white object-cover" />
                )}
              </div>
              <div className="p-3">
                <p className="font-display text-lg font-bold" style={{ color: form.primaryColor }}>{form.name || t('shop.myBrand')}</p>
                <p className="text-xs text-muted">{form.slogan || t('shop.yourSlogan')}</p>
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
