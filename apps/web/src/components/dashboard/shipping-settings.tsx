'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';

interface Rate {
  name: string;
  cities: string[];
  countries: string[];
  fee: number;
}

interface Settings {
  shippingFee: number | null;
  freeShippingFrom: number | null;
  rates: Rate[];
}

/** Champ de saisie d'une liste, séparée par des virgules. */
function listToText(list: string[]): string {
  return list.join(', ');
}
function textToList(text: string): string[] {
  return text
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Réglages de livraison du vendeur.
 *
 * Un tarif de base suffit à la plupart des boutiques. Les zones ne servent
 * qu'à ceux qui livrent à des prix différents selon l'endroit — elles restent
 * donc repliées derrière un bouton plutôt que d'alourdir le formulaire.
 */
export function ShippingSettings() {
  const t = useT();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    apiFetch<Settings>('/shops/me/shipping')
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  if (!settings) return null;

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      const saved = await apiFetch<Settings>('/shops/me/shipping', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setSettings(saved);
      setMsg(t('ship.saved'));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const setRate = (index: number, patch: Partial<Rate>) =>
    setSettings({
      ...settings,
      rates: settings.rates.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    });

  return (
    <div className="rounded-xl border border-border p-4">
      <p className="font-semibold">📦 {t('ship.title')}</p>
      <p className="mb-3 text-xs text-muted">{t('ship.help')}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">{t('ship.baseFee')}</label>
          <input
            type="number"
            min={0}
            className="input"
            value={settings.shippingFee ?? ''}
            onChange={(e) =>
              setSettings({
                ...settings,
                shippingFee: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </div>
        <div>
          <label className="label">{t('ship.freeFrom')}</label>
          <input
            type="number"
            min={0}
            className="input"
            value={settings.freeShippingFrom ?? ''}
            onChange={(e) =>
              setSettings({
                ...settings,
                freeShippingFrom: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </div>
      </div>

      <p className="mt-4 text-sm font-semibold">{t('ship.zones')}</p>
      <p className="mb-2 text-xs text-muted">{t('ship.zonesHelp')}</p>

      <div className="space-y-3">
        {settings.rates.map((rate, i) => (
          <div key={i} className="rounded-lg bg-surface-2 p-3">
            <div className="grid gap-2 sm:grid-cols-4">
              <input
                className="input py-1.5 text-sm"
                placeholder={t('ship.zoneName')}
                value={rate.name}
                onChange={(e) => setRate(i, { name: e.target.value })}
              />
              <input
                className="input py-1.5 text-sm"
                placeholder={t('ship.cities')}
                value={listToText(rate.cities)}
                onChange={(e) => setRate(i, { cities: textToList(e.target.value) })}
              />
              <input
                className="input py-1.5 text-sm"
                placeholder={t('ship.countries')}
                value={listToText(rate.countries)}
                onChange={(e) => setRate(i, { countries: textToList(e.target.value) })}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  className="input py-1.5 text-sm"
                  placeholder={t('ship.fee')}
                  value={rate.fee}
                  onChange={(e) => setRate(i, { fee: Number(e.target.value) })}
                />
                <button
                  type="button"
                  onClick={() =>
                    setSettings({ ...settings, rates: settings.rates.filter((_, j) => j !== i) })
                  }
                  className="text-sm text-muted hover:text-red-400"
                  aria-label={t('common.delete')}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() =>
            setSettings({
              ...settings,
              rates: [...settings.rates, { name: '', cities: [], countries: [], fee: 0 }],
            })
          }
          className="btn-ghost text-sm"
        >
          + {t('ship.addZone')}
        </button>
        <button type="button" onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-40">
          {saving ? '…' : t('common.save')}
        </button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </div>
  );
}
