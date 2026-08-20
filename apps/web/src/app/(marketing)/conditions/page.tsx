import type { Metadata } from 'next';
import { LegalShell, LegalSection } from '@/components/legal-shell';
import { DEFAULT_COMMISSION_RATE, DEFAULT_PAYOUT_HOLD_DAYS } from '@odalyan/shared';

/**
 * Les chiffres cités viennent du paquet partagé, d'où le serveur tire aussi
 * ceux qu'il applique. Les recopier à la main aurait fini par publier une règle
 * que la plateforme n'applique plus.
 */
const COMMISSION = Math.round(DEFAULT_COMMISSION_RATE * 100);

export const metadata: Metadata = {
  title: 'Conditions d’utilisation',
  description:
    'Les règles de la plateforme Odalyan FashionSphere AI : commission, livraison, remboursements, versements aux vendeurs, engagements de chacun, contenus IA et affiliation.',
};

export default function ConditionsPage() {
  return (
    <LegalShell
      title="Conditions d’utilisation"
      updated="20 août 2026"
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

      <LegalSection title="4. Ventes sur la marketplace">
        <p>
          Chaque vente lie l’acheteur et la boutique vendeuse. La plateforme encaisse pour le compte du
          vendeur, puis lui reverse ce qui lui revient. Elle retient une commission de {COMMISSION}&nbsp;% sur
          le montant des articles, sauf taux négocié convenu avec la boutique. Les frais de livraison
          sont exclus de cette commission&nbsp;: ils couvrent une dépense du vendeur.
        </p>
        <p>
          Le taux appliqué est figé sur chaque commande au moment de l’encaissement. Une modification
          ultérieure du taux ne s’applique jamais aux ventes déjà conclues. Le vendeur consulte à tout
          moment son taux réel et le détail de ses ventes dans «&nbsp;Mes revenus&nbsp;».
        </p>
      </LegalSection>

      <LegalSection title="5. Livraison">
        <p>
          Les frais de livraison, les délais annoncés et l’acheminement relèvent de la boutique
          vendeuse. Les frais applicables sont affichés avant le paiement&nbsp;; aucun supplément ne peut
          être réclamé après la commande. Le vendeur s’engage à expédier dans le délai qu’il annonce et
          à renseigner le transporteur et le numéro de suivi dès l’expédition.
        </p>
      </LegalSection>

      <LegalSection title="6. Remboursements">
        <p>
          Un acheteur peut demander le remboursement d’une commande payée, en totalité ou pour
          certains articles seulement. Le montant est calculé à partir des articles rendus et de leur
          quantité, jamais d’une somme saisie librement. Une unité déjà remboursée ne peut pas l’être
          une seconde fois.
        </p>
        <p>
          Les frais de livraison ne sont remboursés que si la commande est retournée intégralement&nbsp;:
          un acheteur qui conserve un article a bénéficié de la livraison.
        </p>
        <p>
          Le vendeur accorde ou refuse la demande. Un refus doit être motivé. En l’absence de réponse
          dans un délai raisonnable, la plateforme peut trancher pour préserver l’acheteur comme la
          réputation de la marketplace.
        </p>
        <p>
          Un remboursement accordé sur une commande déjà reversée au vendeur devient une somme due par
          celui-ci. Elle est retenue sur son versement suivant, et affichée dans «&nbsp;Mes revenus&nbsp;» dès
          qu’elle existe&nbsp;: aucune retenue n’intervient sans avoir été annoncée.
        </p>
      </LegalSection>

      <LegalSection title="7. Versements aux vendeurs">
        <p>
          Une vente devient versable {DEFAULT_PAYOUT_HOLD_DAYS} jours après sa livraison. Ce délai de garantie permet
          qu’un remboursement demandé après coup porte sur des fonds encore détenus par la plateforme,
          plutôt que sur de l’argent déjà sorti.
        </p>
        <p>
          Le versement suppose des coordonnées de reversement valides et exactes — Mobile Money ou
          virement. Le vendeur répond de leur exactitude&nbsp;; un virement effectué sur des coordonnées
          erronées qu’il a saisies ne peut être réclamé à la plateforme.
        </p>
        <p>
          Un versement n’est jamais négatif. Lorsque les sommes dues par le vendeur dépassent son
          solde, elles sont reportées entièrement sur le versement suivant plutôt que prélevées
          partiellement.
        </p>
      </LegalSection>

      <LegalSection title="8. Engagements du vendeur">
        <p>
          Le vendeur garantit que ses produits existent, sont disponibles, conformes à leur
          description et licites. Il répond de leur qualité, de leur conformité et du service après
          vente auprès de l’acheteur.
        </p>
        <p>
          Les visuels produits par l’IA sont des représentations. Le vendeur vérifie avant publication
          qu’ils correspondent au produit réellement vendu&nbsp;: présenter comme photographie un rendu qui
          s’en écarte engage sa seule responsabilité.
        </p>
        <p>
          Un usage manifestement abusif — annonces fictives, remboursements réclamés de mauvaise foi,
          contournement de la commission en détournant les acheteurs hors de la plateforme — peut
          entraîner la suspension de la boutique et la retenue des sommes en litige.
        </p>
      </LegalSection>

      <LegalSection title="9. Engagements de l’acheteur">
        <p>
          L’acheteur fournit une adresse de livraison exacte et joignable. Une demande de remboursement
          doit être sincère&nbsp;: les demandes répétées et manifestement infondées peuvent entraîner la
          suspension du compte.
        </p>
      </LegalSection>

      <LegalSection title="10. Contenus générés par IA">
        <p>
          Vous êtes responsable des contenus que vous générez et publiez. Vous vous engagez à ne pas
          produire de contenus illicites, trompeurs, diffamatoires, contrefaisants ou portant atteinte aux
          droits d’autrui. Les résultats de l’IA peuvent comporter des imperfections ; il vous appartient
          de les vérifier avant publication.
        </p>
      </LegalSection>

      <LegalSection title="11. Publication sur les réseaux sociaux">
        <p>
          Lorsque vous connectez un réseau (Facebook, Instagram, TikTok…), vous nous autorisez à publier
          en votre nom les seuls contenus que vous programmez. Vous vous engagez à respecter les conditions
          d’utilisation propres à chaque réseau. Vous pouvez déconnecter un réseau à tout moment.
        </p>
      </LegalSection>

      <LegalSection title="12. Programme d’affiliation">
        <p>
          La plateforme peut générer des liens d’affiliation (par exemple Amazon). Les contenus concernés
          peuvent contenir des liens rémunérés. Vous vous engagez à respecter les règles des programmes
          d’affiliation utilisés, notamment l’obligation de transparence envers votre audience.
        </p>
      </LegalSection>

      <LegalSection title="13. Propriété intellectuelle">
        <p>
          Vous conservez les droits sur vos propres contenus (photos de produits, marques). La plateforme,
          son code, son design et sa marque restent la propriété d’Odalyan FashionSphere AI™. Vous ne
          pouvez pas copier ou revendre le service sans autorisation.
        </p>
      </LegalSection>

      <LegalSection title="14. Usage acceptable">
        <p>Il est interdit d’utiliser la plateforme pour :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>enfreindre la loi ou les droits de tiers ;</li>
          <li>diffuser des logiciels malveillants ou tenter d’accéder sans autorisation à nos systèmes ;</li>
          <li>contourner les limites d’usage, les quotas ou les mesures de sécurité.</li>
        </ul>
      </LegalSection>

      <LegalSection title="15. Disponibilité et responsabilité">
        <p>
          Nous nous efforçons d’assurer un service fiable, sans garantie d’absence d’interruption. Dans la
          limite permise par la loi, notre responsabilité ne saurait excéder les montants que vous avez
          versés au cours des douze derniers mois.
        </p>
      </LegalSection>

      <LegalSection title="16. Résiliation">
        <p>
          Vous pouvez fermer votre compte à tout moment. Nous pouvons suspendre ou résilier un compte en
          cas de manquement à ces conditions, notamment en cas d’usage frauduleux ou illicite.
        </p>
      </LegalSection>

      <LegalSection title="17. Droit applicable">
        <p>
          Ces conditions sont régies par le droit en vigueur en Côte d’Ivoire. Tout litige sera soumis aux
          juridictions compétentes, après recherche d’une solution amiable.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
