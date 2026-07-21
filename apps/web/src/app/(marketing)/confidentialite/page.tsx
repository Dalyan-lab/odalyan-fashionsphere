import type { Metadata } from 'next';
import { LegalShell, LegalSection } from '@/components/legal-shell';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Odalyan FashionSphere AI',
  description:
    'Comment Odalyan FashionSphere AI collecte, utilise et protège vos données, y compris les connexions aux réseaux sociaux et la suppression des données.',
};

export default function ConfidentialitePage() {
  return (
    <LegalShell
      title="Politique de confidentialité"
      updated="21 juillet 2026"
      intro="Odalyan FashionSphere AI™ (« nous ») est une plateforme de commerce de mode assistée par IA, éditée depuis la Côte d’Ivoire. Cette politique explique quelles données nous collectons, pourquoi, et les moyens dont vous disposez pour les contrôler."
    >
      <LegalSection title="1. Données que nous collectons">
        <p>Nous collectons uniquement les données nécessaires au fonctionnement du service :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Compte</strong> : nom, adresse e-mail et mot de passe (stocké chiffré, jamais en clair).</li>
          <li><strong>Boutique</strong> : nom, description, logo, produits et contenus que vous créez.</li>
          <li><strong>Contenus générés par IA</strong> : visuels, vidéos et textes produits via la plateforme.</li>
          <li><strong>Paiements</strong> : traités par notre prestataire Paystack. Nous ne stockons jamais vos numéros de carte ni vos identifiants bancaires ; nous conservons seulement le statut et la référence de la transaction.</li>
          <li><strong>Connexions aux réseaux sociaux</strong> : lorsque vous connectez un compte (Facebook, Instagram, TikTok…), nous stockons les jetons d’accès fournis par le réseau afin de publier en votre nom, à votre demande.</li>
          <li><strong>Données techniques</strong> : journaux de connexion et d’utilisation, à des fins de sécurité et d’amélioration.</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Connexions aux réseaux sociaux et publication">
        <p>
          La connexion d’un réseau se fait via le protocole officiel OAuth de chaque plateforme. Nous
          recevons alors un <strong>jeton d’accès</strong> que nous utilisons exclusivement pour publier
          les contenus que vous avez explicitement programmés (image, vidéo, légende).
        </p>
        <p>
          Nous n’accédons pas à vos messages privés, ne lisons pas votre fil et ne publions rien sans
          votre action. Vous pouvez <strong>déconnecter un réseau à tout moment</strong> depuis la page
          « Publications » : le jeton correspondant est immédiatement supprimé de nos serveurs.
        </p>
        <p>
          L’usage des données issues de Meta (Facebook, Instagram) et de TikTok respecte les conditions
          de développeur de ces plateformes.
        </p>
      </LegalSection>

      <LegalSection title="3. Comment nous utilisons vos données">
        <ul className="list-disc space-y-1 pl-5">
          <li>Fournir et sécuriser votre compte et votre boutique.</li>
          <li>Générer les contenus IA que vous demandez.</li>
          <li>Publier vos contenus sur les réseaux que vous avez connectés.</li>
          <li>Traiter vos abonnements et vos achats de crédits.</li>
          <li>Vous envoyer des e-mails de service (réinitialisation de mot de passe, rappels d’expiration).</li>
        </ul>
        <p>Nous ne vendons jamais vos données personnelles.</p>
      </LegalSection>

      <LegalSection title="4. Prestataires tiers">
        <p>Nous nous appuyons sur des prestataires de confiance, chacun pour une finalité précise :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Paystack</strong> — traitement des paiements.</li>
          <li><strong>Cloudflare R2</strong> — hébergement des images et vidéos.</li>
          <li><strong>Fournisseurs d’IA</strong> — génération de visuels, de vidéos et de textes.</li>
          <li><strong>Meta et TikTok</strong> — publication sur les réseaux que vous connectez.</li>
          <li><strong>Service d’envoi d’e-mails</strong> — messages de service.</li>
        </ul>
        <p>Ces prestataires ne reçoivent que les données strictement nécessaires à leur mission.</p>
      </LegalSection>

      <LegalSection title="5. Conservation des données">
        <p>
          Nous conservons vos données tant que votre compte est actif. À la fermeture du compte, elles
          sont supprimées ou anonymisées dans un délai raisonnable, sauf obligation légale de conservation
          (par exemple pour la comptabilité).
        </p>
      </LegalSection>

      <LegalSection title="6. Suppression de vos données">
        <p>
          Vous pouvez demander la suppression de votre compte et de l’ensemble de vos données à tout
          moment en écrivant à{' '}
          <a href="mailto:technodalyan@gmail.com" className="text-brand-violet hover:underline">
            technodalyan@gmail.com
          </a>{' '}
          avec pour objet « Suppression de mes données ». Nous traitons la demande sous 30 jours et
          révoquons alors tous les jetons de réseaux sociaux associés.
        </p>
      </LegalSection>

      <LegalSection title="7. Sécurité">
        <p>
          Les mots de passe sont chiffrés, les échanges se font en HTTPS et les jetons d’accès sont
          stockés de manière restreinte. Aucun système n’étant infaillible, nous vous invitons à utiliser
          un mot de passe fort et unique.
        </p>
      </LegalSection>

      <LegalSection title="8. Vos droits">
        <p>
          Vous pouvez accéder à vos données, les corriger, les exporter ou en demander la suppression.
          Pour exercer ces droits, contactez-nous à l’adresse ci-dessous.
        </p>
      </LegalSection>

      <LegalSection title="9. Modifications">
        <p>
          Cette politique peut évoluer. En cas de changement important, nous vous en informerons via la
          plateforme ou par e-mail. La date de mise à jour figure en haut de cette page.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
