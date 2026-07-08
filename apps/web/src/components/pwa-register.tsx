'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWARegister() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // En développement, on désinscrit tout SW et on vide les caches
    // (un SW + next dev cause des ChunkLoadError car les chunks changent à chaque build).
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
      return;
    }

    navigator.serviceWorker.register('/sw.js').catch(() => undefined);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  if (!deferred || hidden) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-2xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" className="h-9 w-9 rounded-lg" />
      <div className="text-sm">
        <p className="font-semibold">Installer l’application</p>
        <p className="text-xs text-muted">Accès rapide depuis votre écran d’accueil</p>
      </div>
      <button onClick={install} className="btn-primary px-4 py-2 text-sm">
        Installer
      </button>
      <button onClick={() => setHidden(true)} aria-label="Fermer" className="px-1 text-muted hover:text-content">
        ✕
      </button>
    </div>
  );
}
