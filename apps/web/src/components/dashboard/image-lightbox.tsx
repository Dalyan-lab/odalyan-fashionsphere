'use client';

import { useCallback, useEffect, useState } from 'react';

/** Visionneuse plein écran avec zoom (+/−, molette, Échap). */
export function ImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);

  const zoomIn = useCallback(() => setScale((s) => Math.min(s + 0.25, 4)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(s - 0.25, 0.5)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') zoomIn();
      else if (e.key === '-') zoomOut();
    };
    window.addEventListener('keydown', onKey);
    // Empêche le scroll du fond pendant l'affichage
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, zoomIn, zoomOut]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Barre d'actions */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={zoomOut}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-xl text-white transition hover:bg-white/30"
          aria-label="Dézoomer"
        >
          −
        </button>
        <span className="min-w-[3.5rem] text-center text-sm font-medium text-white">{Math.round(scale * 100)}%</span>
        <button
          onClick={zoomIn}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-xl text-white transition hover:bg-white/30"
          aria-label="Zoomer"
        >
          +
        </button>
        <button
          onClick={onClose}
          className="ml-2 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-lg text-white transition hover:bg-red-600"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      {/* Image (le clic sur l'image ne ferme pas ; la molette zoome) */}
      <div
        className="max-h-[92vh] max-w-[92vw] overflow-auto"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => (e.deltaY < 0 ? zoomIn() : zoomOut())}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          className="select-none transition-transform duration-150"
          style={{ transform: `scale(${scale})`, transformOrigin: 'center', cursor: scale < 4 ? 'zoom-in' : 'zoom-out' }}
          onClick={() => (scale < 4 ? zoomIn() : setScale(1))}
        />
      </div>
    </div>
  );
}
