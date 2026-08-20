'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  DEFAULT_COMMISSION_RATE,
  DEFAULT_PAYOUT_HOLD_DAYS,
  AI_CREDIT_COSTS,
} from '@odalyan/shared';

/**
 * Centre d'aide.
 *
 * Écrit à partir des parcours **réels** de la plateforme, pas de généralités :
 * chaque étape correspond à un écran qui existe, et les chiffres — commission,
 * délai de garantie, coût en crédits — sont importés du même endroit que le
 * code qui les applique. Une aide qui annonce autre chose que ce que fait le
 * logiciel est pire que pas d'aide : elle fait perdre confiance au moment
 * précis où l'on cherchait à en gagner.
 */

const COMMISSION = Math.round(DEFAULT_COMMISSION_RATE * 100);

type Etape = { titre: string; texte: string; lien?: { href: string; label: string } };

const PARCOURS_CLIENT: Etape[] = [
  {
    titre: 'Trouver un article',
    texte:
      'La marketplace rassemble les boutiques de tous les vendeurs. Filtrez par rayon — Mode, Maison, Beauté, High-tech, Enfants, Loisirs — ou tapez directement ce que vous cherchez.',
    lien: { href: '/marketplace', label: 'Ouvrir la marketplace' },
  },
  {
    titre: 'Voir la fiche avant d’acheter',
    texte:
      'Chaque fiche indique le prix en francs CFA, la boutique qui vend, le délai de livraison annoncé et les avis laissés par d’autres acheteurs. Les frais de livraison dépendent de la boutique et de votre ville ; ils s’affichent avant le paiement, jamais après.',
  },
  {
    titre: 'Commander auprès de plusieurs boutiques',
    texte:
      'Votre panier peut contenir des articles de boutiques différentes. Vous payez une seule fois : la plateforme répartit ensuite la commande entre chaque vendeur, qui prépare sa part de son côté.',
  },
  {
    titre: 'Suivre la livraison',
    texte:
      'Depuis « Mes commandes », vous voyez l’avancement étape par étape : payée, en préparation, expédiée, livrée. Dès que le vendeur expédie, le transporteur et le numéro de suivi s’affichent, avec le lien pour suivre le colis.',
    lien: { href: '/orders', label: 'Mes commandes' },
  },
  {
    titre: 'Demander un remboursement',
    texte:
      'Sur une commande payée, le bouton « Demander un remboursement » vous laisse choisir les articles concernés et leur quantité — vous n’êtes pas obligé de rendre toute la commande. Le montant se calcule tout seul. Le vendeur reçoit la demande et vous répond ; rien n’est prélevé chez lui tant qu’il n’a pas accepté.',
  },
];

const PARCOURS_VENDEUR: Etape[] = [
  {
    titre: 'Créer votre boutique',
    texte:
      'Nom, slogan, logo, bannière, couleurs : votre vitrine porte votre identité, pas celle de la plateforme. Renseignez aussi votre délai de livraison — un acheteur qui ignore quand il sera livré hésite, puis renonce.',
    lien: { href: '/dashboard/shop', label: 'Ma boutique' },
  },
  {
    titre: 'Ajouter vos produits',
    texte:
      'Une photo, un prix en francs CFA, une catégorie. Les variantes — taille, couleur, stock — évitent d’avoir à créer dix fiches pour un même modèle.',
    lien: { href: '/dashboard/products', label: 'Mes produits' },
  },
  {
    titre: 'Faire porter vos vêtements par un mannequin',
    texte: `Créez un avatar, puis lancez un essayage : l’IA génère cinq vues du vêtement porté — face, trois-quarts gauche, profil, dos, trois-quarts droit. Comptez ${AI_CREDIT_COSTS.tryon} crédits par essayage. Ces images servent ensuite au défilé et à vos publications.`,
    lien: { href: '/dashboard/tryon', label: 'Essayage virtuel' },
  },
  {
    titre: 'Publier sur les réseaux sociaux',
    texte:
      'Reliez vos comptes une fois, puis programmez vos publications depuis Pilotage social. Les réseaux non reliés apparaissent en gris sur votre tableau de bord : vous voyez d’un coup d’œil ce qui reste à brancher.',
    lien: { href: '/dashboard/publications', label: 'Publications' },
  },
  {
    titre: 'Régler vos frais de livraison',
    texte:
      'Un tarif de base par boutique, des zones géographiques si vos tarifs changent selon la ville, et un seuil au-delà duquel la livraison est offerte. Tout est saisi en francs CFA.',
    lien: { href: '/dashboard/shop', label: 'Réglages de livraison' },
  },
  {
    titre: 'Être payé',
    texte: `Renseignez vos coordonnées de reversement — Mobile Money ou virement. Après chaque vente, la plateforme retient ${COMMISSION} % sur les articles ; les frais de livraison vous reviennent entièrement. La somme devient versable ${DEFAULT_PAYOUT_HOLD_DAYS} jours après la livraison.`,
    lien: { href: '/dashboard/revenus', label: 'Mes revenus' },
  },
];

const QUESTIONS: { q: string; r: string }[] = [
  {
    q: 'Pourquoi mon argent n’est-il pas disponible tout de suite ?',
    r: `Une vente devient versable ${DEFAULT_PAYOUT_HOLD_DAYS} jours après la livraison. Ce délai existe pour une raison précise : si un acheteur obtient un remboursement après coup, la somme n’a pas encore quitté la plateforme. Sans lui, il faudrait vous réclamer de l’argent déjà versé. Votre écran « Mes revenus » sépare clairement ce qui est disponible, ce qui est encore sous garantie et ce qui n’est pas encore livré.`,
  },
  {
    q: 'Combien la plateforme prélève-t-elle exactement ?',
    r: `${COMMISSION} % sur le montant des articles, sauf taux négocié pour votre boutique. Les frais de livraison en sont exclus : c’est vous qui payez le transport, vous prélever dessus reviendrait à vous taxer sur une dépense. Le taux réellement appliqué à votre boutique s’affiche dans « Mes revenus », et il est figé sur chaque commande au moment de l’encaissement — changer le taux plus tard ne réécrit jamais vos ventes passées.`,
  },
  {
    q: 'Un client demande un remboursement. Que se passe-t-il pour moi ?',
    r: 'Vous décidez : vous accordez ou vous refusez, avec un message. Un refus doit être expliqué — un client sans réponse se tourne vers sa banque, ce qui coûte plus cher à tout le monde. Si vous accordez et que la commande ne vous a pas encore été versée, elle sort simplement de votre solde. Si elle vous a déjà été versée, le montant devient une dette retenue sur votre prochain versement. Cette dette s’affiche sur « Mes revenus » : vous n’êtes jamais prélevé sans l’avoir vu venir.',
  },
  {
    q: 'Un remboursement partiel, ça marche comment ?',
    r: 'Le client choisit les articles et les quantités qu’il rend. Le montant se calcule à partir de ces lignes, jamais d’une somme tapée à la main. Une unité déjà rendue ne peut pas l’être une seconde fois. Les frais de livraison ne sont remboursés que si toute la commande est retournée : un client qui garde un article a bien été livré.',
  },
  {
    q: 'À quoi servent les crédits IA ?',
    r: `Chaque génération consomme des crédits : ${AI_CREDIT_COSTS.tryon} pour un essayage complet, moins pour un visuel simple. Votre offre vous en donne un lot chaque mois. Les crédits achetés en supplément, eux, ne sont jamais remis à zéro — ils s’ajoutent à votre solde et se reportent.`,
  },
  {
    q: 'Les images générées par l’IA m’appartiennent-elles ?',
    r: 'Les visuels produits à partir de vos photos et de vos produits sont à vous, et vous pouvez les publier. Vous restez responsable de ce que vous mettez en ligne : une IA peut se tromper sur une matière ou une couleur, et c’est à vous de vérifier avant de présenter le résultat comme votre produit.',
  },
  {
    q: 'Je vends dans plusieurs villes, mes frais de port varient. C’est possible ?',
    r: 'Oui. Réglez un tarif de base, puis ajoutez des zones — par ville, région ou pays. La première zone qui correspond à l’adresse du client s’applique. Un seuil de livraison offerte, s’il est atteint, l’emporte sur toutes les zones.',
  },
];

function Section({ titre, sous, etapes }: { titre: string; sous: string; etapes: Etape[] }) {
  return (
    <section className="mt-14">
      <h2 className="font-display text-2xl font-bold">{titre}</h2>
      <p className="mt-1 text-sm text-muted">{sous}</p>
      <ol className="mt-6 space-y-5">
        {etapes.map((e, i) => (
          <li key={e.titre} className="flex gap-4">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-violet-magenta text-xs font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold">{e.titre}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{e.texte}</p>
              {e.lien && (
                <Link
                  href={e.lien.href}
                  className="mt-1.5 inline-block text-sm text-brand-violet hover:underline"
                >
                  {e.lien.label} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Question dépliable : la liste reste lisible d'un coup d'œil. */
function Question({ q, r }: { q: string; r: string }) {
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
      {ouverte && <p className="mt-3 text-sm leading-relaxed text-muted">{r}</p>}
    </div>
  );
}

export default function AidePage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-violet">
        Centre d’aide
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold">Comment ça marche</h1>
      <p className="mt-4 text-muted">
        Deux parcours, selon que vous venez acheter ou vendre. Chaque étape renvoie à l’écran
        correspondant : vous pouvez suivre ce guide en gardant la plateforme ouverte à côté.
      </p>

      <Section
        titre="Vous venez acheter"
        sous="Du premier article au suivi du colis."
        etapes={PARCOURS_CLIENT}
      />

      <Section
        titre="Vous venez vendre"
        sous="De la création de la boutique au premier versement."
        etapes={PARCOURS_VENDEUR}
      />

      <section className="mt-16">
        <h2 className="font-display text-2xl font-bold">Questions fréquentes</h2>
        <p className="mt-1 text-sm text-muted">
          Surtout celles qui touchent à l’argent — ce sont les plus légitimes.
        </p>
        <div className="mt-4">
          {QUESTIONS.map((x) => (
            <Question key={x.q} q={x.q} r={x.r} />
          ))}
        </div>
      </section>

      <div className="mt-14 rounded-2xl border border-border bg-surface-2 p-6">
        <h2 className="font-semibold">Vous ne trouvez pas votre réponse ?</h2>
        <p className="mt-2 text-sm text-muted">
          Le programme d’affiliation a ses propres règles, détaillées sur la page{' '}
          <Link href="/viral-amazone" className="text-brand-violet hover:underline">
            ViralAmazone
          </Link>
          . Écrivez-nous à{' '}
          <a href="mailto:technodalyan@gmail.com" className="text-brand-violet hover:underline">
            technodalyan@gmail.com
          </a>
          . Les règles complètes — remboursements, versements, responsabilités — sont détaillées
          dans les{' '}
          <Link href="/conditions" className="text-brand-violet hover:underline">
            conditions d’utilisation
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
