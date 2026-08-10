'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useShop } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Topbar } from '@/components/dashboard/topbar';

/** Résolution du PNG téléchargé : large pour rester net à l'impression (flyers, affiches). */
const PNG_SIZE = 1024;

interface ShareLink {
  key: string;
  url: string;
  /** Le lien vers la vitrine n'existe que si la boutique est créée. */
  disabled?: boolean;
}

/**
 * Carte d'un lien partageable : adresse, copie en un clic, QR code affiché en
 * vectoriel (net à toute taille) et téléchargeable en PNG ou SVG.
 */
function LinkCard({ item }: { item: ShareLink }) {
  const t = useT();
  const [svg, setSvg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (item.disabled || !item.url) return;
    QRCode.toString(item.url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then(setSvg)
      .catch(() => setSvg(''));
  }, [item.url, item.disabled]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible (navigateur ancien) : le lien reste sélectionnable */
    }
  };

  const download = useCallback(
    async (format: 'png' | 'svg') => {
      const name = `qr-${item.key}`;
      let href: string;
      if (format === 'png') {
        // Fond blanc explicite : un QR transparent devient illisible à l'impression.
        href = await QRCode.toDataURL(item.url, {
          width: PNG_SIZE,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' },
        });
      } else {
        const text = await QRCode.toString(item.url, { type: 'svg', margin: 2 });
        href = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
      }
      const a = document.createElement('a');
      a.href = href;
      a.download = `${name}.${format}`;
      a.click();
      if (format === 'svg') URL.revokeObjectURL(href);
    },
    [item.url, item.key],
  );

  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold">{t(`share.${item.key}.title`)}</h3>
      <p className="mb-3 mt-0.5 text-xs text-muted">{t(`share.${item.key}.desc`)}</p>

      {item.disabled ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-faint">{t('share.needShop')}</p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div
            className="shrink-0 rounded-xl bg-white p-2 [&>svg]:h-32 [&>svg]:w-32"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div className="min-w-0 flex-1">
            <p className="break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs">{item.url}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={copy} className="btn-primary px-3 py-1.5 text-xs">
                {copied ? `✅ ${t('share.copied')}` : `📋 ${t('share.copy')}`}
              </button>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface-hover"
              >
                ↗ {t('share.open')}
              </a>
              <button
                onClick={() => download('png')}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface-hover"
              >
                ⬇️ PNG
              </button>
              <button
                onClick={() => download('svg')}
                title={t('share.svgHint')}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface-hover"
              >
                ⬇️ SVG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PartagePage() {
  const t = useT();
  const shop = useShop((s) => s.shop);
  // L'origine réelle du site : fonctionne aussi bien en local qu'en production.
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  const links: ShareLink[] = [
    { key: 'shop', url: shop ? `${origin}/shop/${shop.slug}` : '', disabled: !shop },
    { key: 'register', url: `${origin}/register` },
    { key: 'marketplace', url: `${origin}/marketplace` },
    { key: 'home', url: origin },
  ];

  return (
    <>
      <Topbar />
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-violet-magenta text-white">🔗</span>
          <div>
            <h1 className="font-display text-3xl font-bold">{t('share.title')}</h1>
            <p className="text-muted">{t('share.subtitle')}</p>
          </div>
        </div>

        {origin && (
          <div className="mt-6 space-y-4">
            {links.map((l) => (
              <LinkCard key={l.key} item={l} />
            ))}
          </div>
        )}

        <p className="mt-6 rounded-xl border border-border bg-surface-2 p-4 text-xs text-muted">
          💡 {t('share.printTip')}
        </p>
      </div>
    </>
  );
}
