/**
 * Adresse publique du site — celle que voient les clients.
 *
 * Sert à fabriquer tout lien sortant : retour de paiement, retour d'OAuth,
 * lien de réinitialisation de mot de passe, renouvellement d'abonnement.
 *
 * `WEB_ORIGIN` ne convient pas seule : c'est la liste des origines autorisées
 * par le CORS, qui en contient plusieurs pendant une migration de domaine.
 * S'appuyer sur son premier élément faisait dépendre l'adresse envoyée aux
 * clients de l'ordre d'une liste dont l'ordre ne signifiait rien — un
 * réordonnancement anodin déplaçait silencieusement les liens de paiement
 * vers un autre domaine.
 *
 * `APP_URL` déclare donc l'adresse canonique. Le repli sur `WEB_ORIGIN`
 * conserve le comportement précédent tant qu'elle n'est pas renseignée.
 */
export function appUrl(): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.WEB_ORIGIN?.split(',')[0]?.trim() ||
    'http://localhost:3000'
  );
}
