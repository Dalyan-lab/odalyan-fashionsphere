import type { Metadata } from 'next';
import { LegalShell, LegalSection } from '@/components/legal-shell';

export const metadata: Metadata = {
  title: 'Conditions d’utilisation — Odalyan FashionSphere AI',
  description:
    'Les conditions régissant l’utilisation de la plateforme Odalyan FashionSphere AI : comptes, abonnements, contenus IA, publication sur les réseaux sociaux et affiliation.',
};

export default function ConditionsPage() {
  return (
    <LegalShell
      title="Conditions d’utilisation"
      updated="21 juillet 2026"
      intro="Bienvenue sur Odalyan FashionSphere AI™. En créant un compte et en utilisant la plateforme, vous acceptez les conditions ci-dessous. Merci de les lire attentivement."
    >
      <LegalSection title="1. Objet du service">
        <p>
          Odalyan FashionSphere AI™ est une plateforme qui aide les vendeurs de mode à créer des visuels
          et vidéos par IA, à repérer des tendances, à gérer une boutique et à publier des contenus sur
          les réseaux sociaux.
        </p>
      </LegalSection>

      <LegalSection title="2. Compte">
        <p>
          Vous devez fournir des informations exactes et garder votre mot de passe confidentiel. Vous êtes
          responsable de l’activité réalisée depuis votre compte. Vous devez avoir l’âge légal requis dans
          votre pays pour contracter.
        </p>
      </LegalSection>

      <LegalSection title="3. Abonnements et crédits">
        <p>
          Certaines fonctionnalités nécessitent un abonnement ou des crédits, payés via Paystack en francs
          CFA (XOF) ou dans les devises proposées. Les paiements activent la période ou le solde
          correspondant. À l’expiration d’un abonnement, le compte peut revenir automatiquement à l’offre
          gratuite. Sauf mention contraire ou obligation légale, les sommes versées ne sont pas
          remboursables une fois le service consommé.
        </p>
      </LegalSection>

      <LegalSection title="4. Contenus générés par IA">
        <p>
          Vous êtes responsable des contenus que vous générez et publiez. Vous vous engagez à ne pas
          produire de contenus illicites, trompeurs, diffamatoires, contrefaisants ou portant atteinte aux
          droits d’autrui. Les résultats de l’IA peuvent comporter des imperfections ; il vous appartient
          de les vérifier avant publication.
        </p>
      </LegalSection>

      <LegalSection title="5. Publication sur les réseaux sociaux">
        <p>
          Lorsque vous connectez un réseau (Facebook, Instagram, TikTok…), vous nous autorisez à publier
          en votre nom les seuls contenus que vous programmez. Vous vous engagez à respecter les conditions
          d’utilisation propres à chaque réseau. Vous pouvez déconnecter un réseau à tout moment.
        </p>
      </LegalSection>

      <LegalSection title="6. Programme d’affiliation">
        <p>
          La plateforme peut générer des liens d’affiliation (par exemple Amazon). Les contenus concernés
          peuvent contenir des liens rémunérés. Vous vous engagez à respecter les règles des programmes
          d’affiliation utilisés, notamment l’obligation de transparence envers votre audience.
        </p>
      </LegalSection>

      <LegalSection title="7. Propriété intellectuelle">
        <p>
          Vous conservez les droits sur vos propres contenus (photos de produits, marques). La plateforme,
          son code, son design et sa marque restent la propriété d’Odalyan FashionSphere AI™. Vous ne
          pouvez pas copier ou revendre le service sans autorisation.
        </p>
      </LegalSection>

      <LegalSection title="8. Usage acceptable">
        <p>Il est interdit d’utiliser la plateforme pour :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>enfreindre la loi ou les droits de tiers ;</li>
          <li>diffuser des logiciels malveillants ou tenter d’accéder sans autorisation à nos systèmes ;</li>
          <li>contourner les limites d’usage, les quotas ou les mesures de sécurité.</li>
        </ul>
      </LegalSection>

      <LegalSection title="9. Disponibilité et responsabilité">
        <p>
          Nous nous efforçons d’assurer un service fiable, sans garantie d’absence d’interruption. Dans la
          limite permise par la loi, notre responsabilité ne saurait excéder les montants que vous avez
          versés au cours des douze derniers mois.
        </p>
      </LegalSection>

      <LegalSection title="10. Résiliation">
        <p>
          Vous pouvez fermer votre compte à tout moment. Nous pouvons suspendre ou résilier un compte en
          cas de manquement à ces conditions, notamment en cas d’usage frauduleux ou illicite.
        </p>
      </LegalSection>

      <LegalSection title="11. Droit applicable">
        <p>
          Ces conditions sont régies par le droit en vigueur en Côte d’Ivoire. Tout litige sera soumis aux
          juridictions compétentes, après recherche d’une solution amiable.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
