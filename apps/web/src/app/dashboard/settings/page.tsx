'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Topbar } from '@/components/dashboard/topbar';
import { Icon } from '@/components/dashboard/icons';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { PasswordInput } from '@/components/password-input';

export default function SettingsPage() {
  const t = useT();
  const user = useAuth((s) => s.user);

  return (
    <>
      <Topbar />
      <div className="mx-auto max-w-3xl p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-violet-magenta text-white">
            {Icon.settings({})}
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">{t('dash.nav.settings')}</h1>
            <p className="text-muted">{t('set.subtitle')}</p>
          </div>
        </div>

        {/* Compte */}
        <section className="card mt-6 p-6">
          <h2 className="mb-4 font-bold">{t('set.account')}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-faint">{t('set.name')}</p>
              <p className="mt-1 font-medium">{user ? `${user.firstName} ${user.lastName}` : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-faint">{t('set.email')}</p>
              <p className="mt-1 truncate font-medium">{user?.email ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-faint">{t('set.role')}</p>
              <p className="mt-1">
                <span className="rounded-md bg-surface-2 px-2 py-0.5 text-sm font-medium text-brand-violet">
                  {user?.role ?? '—'}
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Sécurité */}
        <section className="card mt-6 p-6">
          <h2 className="mb-1 font-bold">{t('set.security')}</h2>
          <p className="mb-4 text-xs text-faint">{t('set.oauthNote')}</p>
          <PasswordForm />
        </section>

        {/* Préférences */}
        <section className="card mt-6 p-6">
          <h2 className="mb-1 font-bold">{t('set.prefs')}</h2>
          <p className="mb-4 text-xs text-faint">{t('set.prefsDesc')}</p>
          <LocaleSwitcher />
        </section>
      </div>
    </>
  );
}

function PasswordForm() {
  const t = useT();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setError('');
    if (form.next !== form.confirm) {
      setError(t('set.passwordMismatch'));
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      });
      setMsg(res.message);
      setForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-sm space-y-3">
      {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}
      {msg && <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-500">{msg}</p>}
      <div>
        <label className="label">{t('set.currentPassword')}</label>
        <PasswordInput value={form.current} onChange={(v) => setForm({ ...form, current: v })} autoComplete="current-password" />
      </div>
      <div>
        <label className="label">{t('set.newPassword')}</label>
        <PasswordInput value={form.next} onChange={(v) => setForm({ ...form, next: v })} autoComplete="new-password" minLength={8} required />
      </div>
      <div>
        <label className="label">{t('set.confirmPassword')}</label>
        <PasswordInput value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} autoComplete="new-password" minLength={8} required />
      </div>
      <button className="btn-primary" disabled={saving}>
        {saving ? t('common.saving') : t('set.changePassword')}
      </button>
    </form>
  );
}
