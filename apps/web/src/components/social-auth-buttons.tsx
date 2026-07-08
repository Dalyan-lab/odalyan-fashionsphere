'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { BrandIcon } from './brand-icons';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export function SocialAuthButtons() {
  const [providers, setProviders] = useState<{ google: boolean; github: boolean } | null>(null);

  useEffect(() => {
    apiFetch<{ google: boolean; github: boolean }>('/auth/oauth/providers', { auth: false })
      .then(setProviders)
      .catch(() => setProviders({ google: false, github: false }));
  }, []);

  const go = (provider: 'google' | 'github') => {
    window.location.href = `${API_BASE}/auth/oauth/${provider}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-faint">ou</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => go('google')}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 py-2.5 text-sm font-medium transition hover:bg-surface-hover"
        >
          <BrandIcon.Google width={18} height={18} /> Google
        </button>
        <button
          type="button"
          onClick={() => go('github')}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 py-2.5 text-sm font-medium transition hover:bg-surface-hover"
        >
          <BrandIcon.GitHub width={18} height={18} /> GitHub
        </button>
      </div>

      {providers && !providers.google && !providers.github && (
        <p className="text-center text-[10px] text-faint">
          Connexion Google/GitHub disponible après configuration des clés OAuth côté serveur.
        </p>
      )}
    </div>
  );
}
