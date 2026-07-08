'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/store';

/** Garde d'accès : seuls les utilisateurs ADMIN accèdent au back-office. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const p = useAuth.persist;
    if (!p) {
      setHydrated(true);
      return;
    }
    const unsub = p.onFinishHydration(() => setHydrated(true));
    if (p.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) router.replace('/login');
    else if (user.role !== 'ADMIN') router.replace('/dashboard');
  }, [hydrated, user, router]);

  if (!hydrated || !user || user.role !== 'ADMIN') {
    return (
      <div className="grid min-h-screen place-items-center bg-bg px-6 text-center text-muted">
        {!hydrated ? 'Chargement…' : 'Accès réservé aux administrateurs. Redirection…'}
      </div>
    );
  }

  return <div className="min-h-screen bg-bg">{children}</div>;
}
