'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';

/** Sélecteur d'avatar réutilisable (Essayage, Défilé…). Masqué si aucun avatar. */
export function AvatarPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const t = useT();
  const [avatars, setAvatars] = useState<{ id: string; url: string | null }[]>([]);

  useEffect(() => {
    apiFetch<{ id: string; url: string | null }[]>('/ai/assets?type=AVATAR')
      .then((l) => setAvatars(l.filter((a) => a.url)))
      .catch(() => setAvatars([]));
  }, []);

  if (avatars.length === 0) return null;

  return (
    <div>
      <label className="label">{t('aim.dressAvatar')}</label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange('')}
          className={`grid h-14 w-14 place-items-center rounded-lg border text-[10px] ${
            value === '' ? 'border-brand-violet text-brand-violet' : 'border-border text-faint'
          }`}
        >
          {t('aim.noAvatar')}
        </button>
        {avatars.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onChange(a.id)}
            className={`h-14 w-14 overflow-hidden rounded-lg border-2 transition ${
              value === a.id ? 'border-brand-violet' : 'border-transparent opacity-75 hover:opacity-100'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.url ?? ''} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
