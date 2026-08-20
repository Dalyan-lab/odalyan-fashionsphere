'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AFFILIATE_MIN_WITHDRAWAL,
  CLICK_MILESTONES,
  CreatorTier,
  LEADERBOARD_BONUS,
  STREAK_MILESTONES,
  TIER_AFFILIATE_SHARE,
  TIER_ORDER,
  TIER_SCRIPT_COST,
  TIER_THRESHOLDS,
  TIER_UP_BONUS,
} from '@odalyan/shared';

/**
 * Règles et avantages du programme ViralAmazone.
 *
 * Tous les chiffres — seuils de niveau, bonus, part reversée, seuil de retrait
 * — sont **importés** des mêmes constantes que le code applique. Un programme
 * de récompenses dont les règles publiées ne correspondent pas aux versements
 * réels détruit exactement la confiance qu'il cherche à créer.
 */

const NOM_NIVEAU: Record<string, string> = {
  [CreatorTier.BRONZE]: 'Bronze',
  [CreatorTier.SILVER]: 'Argent',
  [CreatorTier.GOLD]: 'Or',
  [CreatorTier.PLATINUM]: 'Platine',
};

const fcfa = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;
/** Accord du pluriel : « 1 crédit », « 2 crédits ». */
const credits = (n: number) => `${n} crédit${n > 1 ? 's' : ''}`;

function Question({ q, r }: { q: string; r: React.ReactNode }) {
  const [ouverte, setOuverte] = useState(false);
  return (
    <div className="border-b border-border py-4">
      <button
        type="button"
        onClick={() => setOuverte((v) => !v)}
        aria-expanded={ouverte}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <span className="font-medium">{q}</span>
        <span className="mt-0.5 shrink-0 text-brand-violet">{ouverte ? '−' : '+'}</span>
      </button>
      {ouverte && <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">{r}</div>}
    </div>
  );
}

export default function ViralAmazonePage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-violet">
        Programme créateur
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold">ViralAmazone</h1>
      <p className="mt-4 text-lg text-muted">
        Repérez les produits qui montent, faites-en des vidéos courtes, et gagnez sur chaque clic
        qu’elles rapportent. Sans stock, sans avance, sans expédition.
      </p>

      {/* ------------------------------------------------ Le principe */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold">Comment ça rapporte</h2>
        <ol className="mt-5 space-y-4">
          {[
            {
              t: 'La plateforme repère les produits qui décollent',
              d: 'Les tendances sont classées par vitesse : explosion éclair, tendance forte, croissance stable. Vous voyez ce qui monte avant que tout le monde en parle.',
            },
            {
              t: 'Vous générez un script vidéo',
              d: `L’IA écrit l’accroche, le déroulé et l’appel à l’action pour TikTok, Reels ou Shorts. Le coût baisse avec votre niveau : ${credits(TIER_SCRIPT_COST[CreatorTier.BRONZE])} au départ, ${credits(TIER_SCRIPT_COST[CreatorTier.PLATINUM])} au niveau Platine.`,
            },
            {
              t: 'Vous publiez avec votre lien',
              d: 'Chaque script porte un lien de suivi qui vous est propre. Tout achat qui en découle est attribué à votre boutique.',
            },
            {
              t: 'Vous encaissez',
              d: `La plateforme reçoit la commission d’affiliation et vous en reverse une part, de ${Math.round(TIER_AFFILIATE_SHARE[CreatorTier.BRONZE] * 100)} % à ${Math.round(TIER_AFFILIATE_SHARE[CreatorTier.PLATINUM] * 100)} % selon votre niveau. Retirable en argent réel dès ${fcfa(AFFILIATE_MIN_WITHDRAWAL)}.`,
            },
          ].map((e, i) => (
            <li key={e.t} className="flex gap-4">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-violet-magenta text-xs font-bold text-white">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold">{e.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{e.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------ Les niveaux */}
      <section className="mt-14">
        <h2 className="font-display text-2xl font-bold">Les quatre niveaux</h2>
        <p className="mt-1 text-sm text-muted">
          Votre niveau dépend du nombre de clics cumulés sur vos liens. Il ne redescend jamais.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="pb-2 font-medium">Niveau</th>
                <th className="pb-2 font-medium">À partir de</th>
                <th className="pb-2 text-right font-medium">Part reversée</th>
                <th className="pb-2 text-right font-medium">Script</th>
                <th className="pb-2 text-right font-medium">Bonus d’accès</th>
              </tr>
            </thead>
            <tbody>
              {TIER_ORDER.map((t) => (
                <tr key={t} className="border-t border-border">
                  <td className="py-2 font-semibold">{NOM_NIVEAU[t]}</td>
                  <td className="py-2 tabular-nums text-muted">
                    {TIER_THRESHOLDS[t].toLocaleString('fr-FR')} clics
                  </td>
                  <td className="py-2 text-right tabular-nums text-emerald-500">
                    {Math.round(TIER_AFFILIATE_SHARE[t] * 100)} %
                  </td>
                  <td className="py-2 text-right tabular-nums text-muted">
                    {credits(TIER_SCRIPT_COST[t])}
                  </td>
                  <td className="py-2 text-right tabular-nums text-muted">
                    {TIER_UP_BONUS[t] > 0 ? `+${credits(TIER_UP_BONUS[t])}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------ Les bonus */}
      <section className="mt-14">
        <h2 className="font-display text-2xl font-bold">Les bonus en crédits</h2>
        <p className="mt-1 text-sm text-muted">
          Chaque jalon est accordé une seule fois, à vie. Rien ne se perd si vous ralentissez.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="card p-4">
            <h3 className="text-sm font-semibold">Clics cumulés</h3>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {CLICK_MILESTONES.map((m) => (
                <li key={m.clicks} className="flex justify-between tabular-nums">
                  <span>{m.clicks.toLocaleString('fr-FR')} clics</span>
                  <span className="text-brand-violet">+{m.credits}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold">Régularité</h3>
            <p className="mt-1 text-[11px] text-faint">Jours consécutifs avec une création.</p>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {STREAK_MILESTONES.map((m) => (
                <li key={m.days} className="flex justify-between tabular-nums">
                  <span>{m.days} jours</span>
                  <span className="text-brand-violet">+{m.credits}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold">Classement hebdomadaire</h3>
            <p className="mt-1 text-[11px] text-faint">Les trois premiers de la semaine.</p>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {LEADERBOARD_BONUS.map((c, i) => (
                <li key={i} className="flex justify-between tabular-nums">
                  <span>{i + 1}ᵉ place</span>
                  <span className="text-brand-violet">+{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ L'argent réel */}
      <section className="mt-14 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
        <h2 className="font-display text-2xl font-bold">Passer des crédits à l’argent</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Les bonus ci-dessus paient en crédits IA — de quoi créer davantage. Les commissions
          d’affiliation, elles, paient en <strong className="text-content">francs CFA</strong>, sur
          un solde distinct. Dès qu’il atteint{' '}
          <strong className="text-emerald-500">{fcfa(AFFILIATE_MIN_WITHDRAWAL)}</strong>, vous
          demandez le retrait et l’argent part sur vos coordonnées de reversement — Mobile Money ou
          virement, les mêmes que pour vos ventes.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          <strong className="text-content">Les crédits IA ne se convertissent jamais en argent</strong>,
          et c’est volontaire : ils s’achètent. Les rendre convertibles reviendrait à permettre
          d’acheter un pack pour l’encaisser ensuite. Les deux soldes restent donc séparés.
        </p>
      </section>

      {/* ------------------------------------------------ Questions */}
      <section className="mt-14">
        <h2 className="font-display text-2xl font-bold">Questions fréquentes</h2>
        <div className="mt-4">
          <Question
            q="Faut-il acheter du stock ou avancer de l’argent ?"
            r={
              <p>
                Non. Vous ne vendez pas le produit&nbsp;: vous en parlez. Amazon expédie, encaisse et
                gère le service après-vente. Vous êtes rémunéré sur la commission d’apport.
              </p>
            }
          />
          <Question
            q="Combien de clics faut-il pour toucher de l’argent ?"
            r={
              <p>
                Il n’y a pas de nombre magique&nbsp;: c’est la commission encaissée qui compte, pas le
                clic seul. Un clic sur un produit à {fcfa(5000)} ne rapporte pas comme un clic sur un
                produit à {fcfa(150000)}. Le seuil de retrait est de {fcfa(AFFILIATE_MIN_WITHDRAWAL)},
                et votre solde s’affiche en permanence dans Hot Trends.
              </p>
            }
          />
          <Question
            q="Que se passe-t-il si je m’arrête un moment ?"
            r={
              <p>
                Votre niveau et vos bonus déjà obtenus vous restent&nbsp;: rien ne redescend. Seule la
                série de jours consécutifs repart de zéro — c’est une récompense de régularité, pas
                une punition.
              </p>
            }
          />
          <Question
            q="Quand suis-je payé après une demande de retrait ?"
            r={
              <p>
                La demande fige le montant et vos coordonnées. Le virement est effectué manuellement
                par la plateforme, puis marqué comme versé avec sa référence. Vous suivez chaque
                étape dans votre historique de gains.
              </p>
            }
          />
          <Question
            q="Puis-je perdre des gains déjà crédités ?"
            r={
              <p>
                Seulement si la commission correspondante est annulée en amont — un retour produit,
                par exemple. L’écriture est alors annulée et sort du solde, avec son motif. Tant
                qu’un gain figure comme disponible, il est à vous.
              </p>
            }
          />
          <Question
            q="Est-ce compatible avec ma boutique ?"
            r={
              <p>
                Oui, les deux cohabitent. Vos ventes propres suivent le circuit habituel — commission
                plateforme, délai de garantie, versement. Les gains ViralAmazone ont leur solde à
                part. Beaucoup de créateurs commencent par l’affiliation, puis lancent leur boutique
                avec les crédits accumulés.
              </p>
            }
          />
        </div>
      </section>

      <div className="mt-14 rounded-2xl border border-border bg-surface-2 p-6 text-center">
        <h2 className="font-semibold">Prêt à commencer ?</h2>
        <p className="mt-2 text-sm text-muted">
          Le programme est ouvert à toute boutique, dès l’offre gratuite.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link href="/register" className="btn-primary">
            Créer mon compte
          </Link>
          <Link href="/dashboard/hot-trends" className="btn-ghost">
            Ouvrir Hot Trends
          </Link>
        </div>
        <p className="mt-4 text-xs text-faint">
          Les règles complètes figurent dans les{' '}
          <Link href="/conditions" className="text-brand-violet hover:underline">
            conditions d’utilisation
          </Link>
          . Voir aussi le{' '}
          <Link href="/aide" className="text-brand-violet hover:underline">
            centre d’aide
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
