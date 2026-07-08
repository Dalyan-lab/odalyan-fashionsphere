'use client';

import { use } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/dashboard/topbar';
import { Icon } from '@/components/dashboard/icons';

const LABELS: Record<string, { title: string; desc: string; phase: string }> = {
  clients: {
    title: 'Clients',
    desc: 'Historique d’achat, fidélisation et segmentation de votre clientèle.',
    phase: 'Bientôt',
  },
  marketing: {
    title: 'Marketing IA',
    desc: 'Campagnes publicitaires automatiques : visuels, vidéos et textes.',
    phase: 'Phase 4',
  },
  avatars: {
    title: 'Avatars & Mannequins',
    desc: 'Avatars IA personnalisés, essayage virtuel et mannequins 3D.',
    phase: 'Phases 2–3',
  },
  publications: {
    title: 'Publications',
    desc: 'Programmez et publiez sur Instagram, TikTok, YouTube, Pinterest, X.',
    phase: 'Phase 5',
  },
  stats: {
    title: 'Statistiques',
    desc: 'Revenus, produits performants, taux de conversion et trafic.',
    phase: 'Bientôt',
  },
  subscriptions: {
    title: 'Abonnements',
    desc: 'Gérez votre plan : Starter, Pro, Business ou Enterprise.',
    phase: 'Bientôt',
  },
  settings: {
    title: 'Paramètres',
    desc: 'Préférences du compte, sécurité et intégrations.',
    phase: 'Bientôt',
  },
};

export default function DashboardSectionPage({ params }: { params: Promise<{ rest: string[] }> }) {
  const { rest } = use(params);
  const key = rest?.[0] ?? '';
  const info = LABELS[key] ?? {
    title: key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Section',
    desc: 'Cette section sera bientôt disponible.',
    phase: 'Bientôt',
  };

  return (
    <>
      <Topbar />
      <div className="grid min-h-[70vh] place-items-center p-6 text-center">
        <div className="max-w-md">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-violet-magenta text-white">
            {Icon.sparkles({ width: 30, height: 30 })}
          </div>
          <span className="mt-6 inline-block rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-bold text-brand-violet">
            🔒 {info.phase}
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold">{info.title}</h1>
          <p className="mt-3 text-muted">{info.desc}</p>
          <Link href="/dashboard" className="btn-primary mt-8">
            ← Retour au tableau de bord
          </Link>
        </div>
      </div>
    </>
  );
}
