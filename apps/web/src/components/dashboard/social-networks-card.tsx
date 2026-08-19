'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { BrandIcon, type BrandName } from '@/components/brand-icons';
import { useT } from '@/lib/i18n';

/**
 * Pastilles des réseaux sociaux du tableau de bord.
 *
 * Deux défauts corrigés ici.
 *
 * Le premier est visuel : les glyphes portaient la couleur de leur marque sur
 * une pastille de la même couleur. YouTube dessinait du rouge sur du rouge,
 * Pinterest aussi — deux carrés vides à l'écran. Le glyphe est désormais blanc
 * sur un dégradé de marque, ce qui harmonise les cinq d'un coup.
 *
 * Le second est de fond : les cinq pastilles se ressemblaient, qu'un réseau
 * soit relié ou non. Un tableau de bord doit dire l'état réel du système ; on
 * lit maintenant d'un coup d'œil ce qui est branché et ce qui reste à faire.
 */

interface Connection {
  network: string;
  connected: boolean;
  accountName?: string | null;
}

/**
 * Dégradés de marque plutôt qu'aplats : sur fond sombre, un aplat paraît terne
 * là où deux teintes proches donnent du relief à une pastille de 40 pixels.
 */
const RESEAUX: { name: BrandName; fond: string; lueur: string }[] = [
  {
    name: 'Instagram',
    fond: 'linear-gradient(135deg,#F58529,#DD2A7B 55%,#8134AF)',
    lueur: '221,42,123',
  },
  { name: 'TikTok', fond: 'linear-gradient(135deg,#25F4EE,#111 45%,#FE2C55)', lueur: '254,44,85' },
  { name: 'YouTube', fond: 'linear-gradient(135deg,#FF4E45,#CC0000)', lueur: '255,0,0' },
  { name: 'Pinterest', fond: 'linear-gradient(135deg,#FF4B6E,#BD081C)', lueur: '230,0,35' },
  { name: 'LinkedIn', fond: 'linear-gradient(135deg,#2D9CDB,#0A66C2)', lueur: '10,102,194' },
];

export function SocialNetworksCard() {
  const t = useT();
  const [connections, setConnections] = useState<Connection[] | null>(null);

  useEffect(() => {
    apiFetch<Connection[]>('/social/connections')
      .then(setConnections)
      .catch(() => setConnections([]));
  }, []);

  const estRelie = (nom: string) =>
    connections?.some((c) => c.network === nom && c.connected) ?? false;
  const compte = (nom: string) =>
    connections?.find((c) => c.network === nom && c.connected)?.accountName ?? null;

  const relies = RESEAUX.filter((r) => estRelie(r.name)).length;

  return (
    <>
      <Link
        href="/dashboard/campaigns"
        className="btn-primary mb-3 block w-full py-2 text-center text-sm"
      >
        {t('dh.social.cta')}
      </Link>

      <div className="grid grid-cols-5 gap-2">
        {RESEAUX.map((r, i) => {
          const I = BrandIcon[r.name];
          const relie = estRelie(r.name);
          const nomCompte = compte(r.name);
          return (
            <Link
              key={r.name}
              href="/dashboard/publications"
              className="group flex animate-reveal flex-col items-center gap-1 opacity-0 motion-reduce:animate-none motion-reduce:opacity-100"
              // Décalage en cascade : les pastilles arrivent l'une après l'autre
              // plutôt qu'en bloc, ce qui donne l'impression d'un système qui
              // s'éveille au lieu d'un écran qui se peint.
              style={{ animationDelay: `${i * 70}ms` }}
              title={
                relie
                  ? `${r.name} — ${t('dh.social.tipLinked')}${nomCompte ? ` (${nomCompte})` : ''}`
                  : `${r.name} — ${t('dh.social.tipUnlinked')}`
              }
            >
              <span className="relative">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl text-white transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110 ${
                    // Un réseau non relié reste lisible mais s'efface : il ne
                    // doit pas se faire passer pour actif.
                    relie ? '' : 'opacity-40 grayscale group-hover:opacity-80 group-hover:grayscale-0'
                  }`}
                  style={{
                    background: r.fond,
                    boxShadow: relie ? `0 4px 14px -4px rgba(${r.lueur},0.65)` : undefined,
                  }}
                >
                  <I mono width={20} height={20} />
                </span>

                {relie && (
                  <span
                    className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-emerald-400"
                    aria-hidden
                  >
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 motion-reduce:animate-none" />
                  </span>
                )}
              </span>
              <span className={`text-[9px] ${relie ? 'text-muted' : 'text-faint'}`}>{r.name}</span>
            </Link>
          );
        })}
      </div>

      <Link
        href="/dashboard/publications"
        className="mt-3 block text-center text-[10px] text-brand-violet hover:underline"
      >
        {connections === null
          ? `${t('dh.social.manage')} →`
          : relies === 0
            ? `${t('dh.social.connect')} →`
            : `${t('dh.social.linked')
                .replace('{n}', String(relies))
                .replace('{total}', String(RESEAUX.length))} →`}
      </Link>
    </>
  );
}
