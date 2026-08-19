'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { convertAndFormat, useLocale, useT } from '@/lib/i18n';
import { Icon } from '@/components/dashboard/icons';

/**
 * Fil d'activité récente de la boutique.
 *
 * Les totaux disent où en est la boutique, la courbe dit si elle bouge ; le fil
 * dit **ce qui vient de se passer**. C'est ce qui donne le sentiment que la
 * plateforme travaille en dehors des heures où on la regarde.
 *
 * Rien n'y est inventé : chaque ligne correspond à un enregistrement réel, et
 * l'API ne renvoie que le type et ses données — la phrase est composée ici,
 * dans la langue de l'utilisateur.
 */

interface Event {
  type: string;
  at: string;
  ref?: string;
  amount?: number;
  currency?: string;
  networks?: string[];
  rating?: number;
  label?: string;
  approved?: boolean;
}

/**
 * Famille visuelle de chaque événement.
 *
 * Les teintes d'état — vert, ambre — ne servent qu'aux événements qui **ont**
 * un état : de l'argent qui rentre, une demande qui attend. Les autres restent
 * dans la couleur de marque, sans quoi la couleur cesserait de vouloir dire
 * quelque chose.
 */
const FAMILLE: Record<string, { icone: keyof typeof Icon; couleur: string }> = {
  ORDER_PAID: { icone: 'orders', couleur: 'text-emerald-500' },
  ORDER_SHIPPED: { icone: 'orders', couleur: 'text-brand-violet' },
  ORDER_DELIVERED: { icone: 'orders', couleur: 'text-brand-violet' },
  REFUND_REQUESTED: { icone: 'bell', couleur: 'text-yellow-500' },
  REFUND_DECIDED: { icone: 'bell', couleur: 'text-yellow-500' },
  PAYOUT_PAID: { icone: 'credits', couleur: 'text-emerald-500' },
  POST_PUBLISHED: { icone: 'publications', couleur: 'text-brand-violet' },
  REVIEW_ADDED: { icone: 'sparkles', couleur: 'text-brand-violet' },
};

/**
 * Ancienneté en clair.
 *
 * Une date absolue oblige à calculer ; « il y a 20 minutes » se lit sans
 * effort, et c'est bien la fraîcheur qui compte dans un fil.
 */
function ancienneteFr(iso: string, t: (k: string) => string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return t('dh.feed.now');
  if (minutes < 60) return t('dh.feed.minutes').replace('{n}', String(minutes));
  const heures = Math.round(minutes / 60);
  if (heures < 24) return t('dh.feed.hours').replace('{n}', String(heures));
  const jours = Math.round(heures / 24);
  if (jours === 1) return t('dh.feed.yesterday');
  if (jours < 30) return t('dh.feed.days').replace('{n}', String(jours));
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

export function ActivityFeed() {
  const t = useT();
  const devise = useLocale((s) => s.currency);
  const [events, setEvents] = useState<Event[] | null>(null);

  const charger = useCallback(() => {
    apiFetch<Event[]>('/shops/me/activity')
      .then(setEvents)
      .catch(() => setEvents([]));
  }, []);

  useEffect(() => {
    charger();
    // Rafraîchi au retour sur l'onglet plutôt qu'en boucle : c'est le moment
    // où l'on veut savoir ce qui a bougé, et cela n'interroge pas l'API pour
    // rien pendant qu'on regarde ailleurs.
    const auRetour = () => {
      if (!document.hidden) charger();
    };
    document.addEventListener('visibilitychange', auRetour);
    return () => document.removeEventListener('visibilitychange', auRetour);
  }, [charger]);

  const phrase = (e: Event): string => {
    const somme = e.amount != null ? convertAndFormat(e.amount, e.currency ?? 'XOF', devise) : '';
    const cle =
      e.type === 'REFUND_DECIDED'
        ? e.approved
          ? 'dh.feed.refundApproved'
          : 'dh.feed.refundRejected'
        : `dh.feed.${e.type}`;
    return t(cle)
      .replace('{ref}', e.ref ?? '')
      .replace('{amount}', somme)
      .replace('{networks}', (e.networks ?? []).join(', '))
      .replace('{rating}', String(e.rating ?? ''))
      .replace('{label}', e.label ?? '');
  };

  if (events !== null && events.length === 0) {
    return (
      <p className="rounded-xl bg-surface-2 px-4 py-5 text-center text-xs text-muted">
        {t('dh.feed.empty')}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {(events ?? []).map((e, i) => {
        const f = FAMILLE[e.type] ?? { icone: 'sparkles' as const, couleur: 'text-brand-violet' };
        return (
          <li
            key={`${e.type}-${e.at}-${i}`}
            className="flex animate-reveal gap-2.5 opacity-0 motion-reduce:animate-none motion-reduce:opacity-100"
            // Arrivée en cascade : le fil se déroule au lieu de s'afficher d'un bloc.
            style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
          >
            <span
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-surface-2 ${f.couleur}`}
            >
              {Icon[f.icone]({ width: 13, height: 13 })}
            </span>
            <span className="min-w-0">
              <span className="block text-xs leading-snug">{phrase(e)}</span>
              <time dateTime={e.at} className="block text-[10px] text-faint">
                {ancienneteFr(e.at, t)}
              </time>
            </span>
          </li>
        );
      })}
      {events === null && <li className="text-xs text-faint">{t('common.loading')}</li>}
    </ul>
  );
}
